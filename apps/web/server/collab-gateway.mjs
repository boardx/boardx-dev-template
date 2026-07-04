import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createConnection } from "node:net";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const serverId = randomUUID();
const port = Number(process.env.COLLAB_WS_PORT ?? "3001");
// 主 app 的 /api/auth/session 是唯一的会话真相来源；网关不直连 DB，靠回调复用既有
// session cookie 校验（零新增依赖，和网关其余部分手撸协议的风格一致）。
const WEB_ORIGIN =
  process.env.COLLAB_WEB_ORIGIN ?? `http://localhost:${process.env.E2E_PORT ?? process.env.PORT ?? "3000"}`;
// 单帧上限：防止畸形/恶意巨帧把整个连接的内存缓冲区吃爆。
const MAX_FRAME_BYTES = 1024 * 1024;
function channelFor(boardId) {
  return `boardx:collab:board:${boardId}`;
}

const boards = new Map();
let publisher;
let subscriber;
let redisReady;

const server = createServer((req, res) => {
  if (req.url === "/health") {
    // redis 字段是诊断信息；状态码维持 200（HTTP 网关本身已就绪），不影响
    // playwright webServer 的就绪判定语义。真正的消息收发仍会等 redisReady。
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, redis: redisState }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

// upgrade 到完成鉴权之间有一次真实网络往返；期间客户端随时可能掉线，若 socket 在
// 无监听者时触发 'error' 会是未捕获异常，直接崩掉整个网关进程（殃及所有 board）。
const AUTH_TIMEOUT_MS = 5000;

/** 校验 upgrade 请求携带的会话 cookie；无效/未登录/超时返回 false。 */
async function isAuthenticated(req) {
  const cookie = req.headers.cookie;
  if (!cookie) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${WEB_ORIGIN}/api/auth/session`, { headers: { cookie }, signal: controller.signal });
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body?.user);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function rejectUpgrade(socket, status) {
  if (socket.destroyed) return;
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

// boardId 直接拼进 Redis channel 名；限制字符集，避免奇怪输入产生不可控的 channel。
const BOARD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

server.on("upgrade", (req, socket) => {
  // 必须在任何 await 之前挂上，否则鉴权网络请求期间客户端掉线触发的 'error'
  // 会因为无监听者而变成未捕获异常，崩掉整个进程。
  socket.on("error", () => {});

  const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/collab/ws") {
    socket.destroy();
    return;
  }
  const boardId = url.searchParams.get("boardId")?.trim();
  const key = req.headers["sec-websocket-key"];
  if (!boardId || !BOARD_ID_PATTERN.test(boardId) || typeof key !== "string") {
    socket.destroy();
    return;
  }

  void isAuthenticated(req).then((ok) => {
    if (socket.destroyed) return; // 鉴权期间客户端已经掉线，不必再写响应。
    if (!ok) {
      rejectUpgrade(socket, "401 Unauthorized");
      return;
    }
    completeUpgrade(socket, boardId, key);
  });
});

function completeUpgrade(socket, boardId, key) {
  const accept = createHash("sha1").update(key + WS_MAGIC).digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"));

  const client = { id: randomUUID(), boardId, socket, buffer: Buffer.alloc(0) };
  addClient(client);
  sendFrame(socket, JSON.stringify({ type: "connected", boardId, via: "gateway" }));

  socket.on("data", (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    for (;;) {
      let parsed;
      try {
        parsed = readFrame(client.buffer);
      } catch {
        // 帧头声明的长度超过上限（含伪造巨帧）：按协议发 1009(Message Too Big) 关闭帧
        // 再断开，而不是直接砍连接——客户端至少能诊断出是什么原因。
        sendClose(socket, 1009);
        socket.destroy();
        return;
      }
      if (!parsed) break;
      client.buffer = client.buffer.subarray(parsed.bytes);
      if (parsed.opcode === 0x8) {
        socket.end();
        return;
      }
      if (parsed.opcode !== 0x1) continue;
      void redisReady
        .then(() => publisher.publish(channelFor(boardId), JSON.stringify({
          serverId,
          payload: {
            type: "message",
            boardId,
            data: parsed.payload,
            fromClientId: client.id,
          },
        })))
        .catch((err) => {
          // 不回传内部错误细节（err.message 可能带连接串/路径等信息）给客户端，只给
          // 通用文案；真实原因记到服务端日志，否则发布失败在运维侧完全不可见。
          console.error(`collab gateway publish failed: ${String(err?.message ?? err)}`);
          sendFrame(socket, JSON.stringify({ type: "error", message: "message delivery failed" }));
        });
    }
  });
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
}

// subscribe/unsubscribe 各自独立挂在 redisReady 上会有真实的乱序风险（同一 board
// 快速离开又加入时，两个 fire-and-forget 的 .then 谁先落地取决于微任务调度，不能
// 保证跟 boards map 的同步变更顺序一致）。用单一队列把所有 Redis 订阅操作强制
// 串行化，谁先调用谁先真正执行到 Redis，跟 addClient/removeClient 的同步顺序对齐。
let redisOpQueue = Promise.resolve();
function enqueueRedisOp(op) {
  redisOpQueue = redisOpQueue
    .catch(() => {}) // 前一个操作失败不影响后一个继续排队执行
    .then(() => redisReady)
    .then(op)
    .catch((err) => {
      console.warn(`collab gateway redis subscribe/unsubscribe failed: ${String(err?.message ?? err)}`);
    });
  return redisOpQueue;
}

function addClient(client) {
  const isFirstForBoard = !boards.has(client.boardId);
  const set = boards.get(client.boardId) ?? new Set();
  set.add(client);
  boards.set(client.boardId, set);
  if (isFirstForBoard) {
    // 每个 board 独立 channel（非单一全局 channel + 应用层过滤）：只有真正有本
    // 实例客户端的 board 才订阅，Redis 自己做隔离与扇出裁剪，而不是本进程收全库
    // 流量再按 boardId 比对丢弃。
    enqueueRedisOp(() => subscriber.subscribe(channelFor(client.boardId), (message) => {
      let envelope;
      try {
        envelope = JSON.parse(message);
      } catch {
        return;
      }
      if (!envelope?.payload) return;
      broadcast(client.boardId, JSON.stringify({ ...envelope.payload, via: "redis" }));
    }));
  }
}

function removeClient(client) {
  const set = boards.get(client.boardId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) {
    boards.delete(client.boardId);
    enqueueRedisOp(() => subscriber.unsubscribe(channelFor(client.boardId)));
  }
}

function broadcast(boardId, text) {
  const set = boards.get(boardId);
  if (!set) return;
  for (const client of set) {
    if (!client.socket.destroyed) sendFrame(client.socket, text);
  }
}

function sendFrame(socket, text) {
  const payload = Buffer.from(text, "utf8");
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function sendClose(socket, code) {
  if (socket.destroyed) return;
  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(code, 0);
  socket.write(Buffer.concat([Buffer.from([0x88, payload.length]), payload]));
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const big = buffer.readBigUInt64BE(offset);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("WebSocket frame too large");
    length = Number(big);
    offset += 8;
  }
  if (length > MAX_FRAME_BYTES) throw new Error("WebSocket frame too large");
  const maskOffset = offset;
  if (masked) offset += 4;
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    const mask = buffer.subarray(maskOffset, maskOffset + 4);
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return { opcode, payload: payload.toString("utf8"), bytes: offset + length };
}

function redisTarget(redisUrl) {
  const u = new URL(redisUrl ?? "redis://localhost:6379");
  return { host: u.hostname, port: Number(u.port || 6379) };
}

function encodeRedis(args) {
  return `*${args.length}\r\n${args.map((arg) => {
    const text = String(arg);
    return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
  }).join("")}`;
}

class RedisCommandClient {
  constructor(redisUrl) {
    this.target = redisTarget(redisUrl);
    this.socket = null;
    this.buffer = "";
    this.pending = [];
  }

  connect() {
    if (this.socket) return Promise.resolve();
    this.socket = createConnection(this.target);
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => this.onData(chunk));
    return new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });
  }

  publish(channel, message) {
    return this.command("PUBLISH", channel, message);
  }

  command(...args) {
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.socket.write(encodeRedis(args));
    });
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const parsed = parseResp(this.buffer);
      if (!parsed) return;
      this.buffer = this.buffer.slice(parsed.bytes);
      const next = this.pending.shift();
      if (!next) continue;
      if (parsed.value instanceof Error) next.reject(parsed.value);
      else next.resolve(parsed.value);
    }
  }
}

class RedisSubscriber {
  constructor(redisUrl) {
    this.target = redisTarget(redisUrl);
    this.socket = null;
    this.buffer = "";
    this.handlers = new Map();
  }

  connect() {
    if (this.socket) return Promise.resolve();
    this.socket = createConnection(this.target);
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => this.onData(chunk));
    return new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });
  }

  subscribe(channel, handler) {
    this.handlers.set(channel, handler);
    this.socket.write(encodeRedis(["SUBSCRIBE", channel]));
  }

  unsubscribe(channel) {
    this.handlers.delete(channel);
    this.socket.write(encodeRedis(["UNSUBSCRIBE", channel]));
  }

  onData(chunk) {
    this.buffer += chunk;
    for (;;) {
      const parsed = parseResp(this.buffer);
      if (!parsed) return;
      this.buffer = this.buffer.slice(parsed.bytes);
      const value = parsed.value;
      if (Array.isArray(value) && value[0] === "message") {
        const handler = this.handlers.get(value[1]);
        if (handler) handler(value[2]);
      }
    }
  }
}

function parseResp(input) {
  const parsed = parseRespAt(input, 0);
  if (!parsed) return null;
  return { value: parsed.value, bytes: parsed.next };
}

function parseRespAt(input, offset) {
  if (offset >= input.length) return null;
  const type = input[offset];
  const lineEnd = input.indexOf("\r\n", offset);
  if (lineEnd < 0) return null;
  const line = input.slice(offset + 1, lineEnd);
  const next = lineEnd + 2;
  if (type === "+") return { value: line, next };
  if (type === "-") return { value: new Error(line), next };
  if (type === ":") return { value: Number(line), next };
  if (type === "$") {
    const length = Number(line);
    if (length < 0) return { value: null, next };
    const end = next + length;
    if (input.length < end + 2) return null;
    return { value: input.slice(next, end), next: end + 2 };
  }
  if (type === "*") {
    const count = Number(line);
    const arr = [];
    let cursor = next;
    for (let i = 0; i < count; i += 1) {
      const item = parseRespAt(input, cursor);
      if (!item) return null;
      arr.push(item.value);
      cursor = item.next;
    }
    return { value: arr, next: cursor };
  }
  return null;
}

let redisState = "connecting";

async function initRedis() {
  publisher = new RedisCommandClient(process.env.REDIS_URL);
  subscriber = new RedisSubscriber(process.env.REDIS_URL);
  await publisher.connect();
  await subscriber.connect();
  redisState = "ready";
  // 注：断线期间发布的消息不做队列/重放——这是尽力而为的实时传输，不保证
  // at-least-once。F02(Yjs 同步)必须自带和解机制(如重连后拉全量快照)，
  // 不能假设这条通道会补发错过的消息。
}

redisReady = initRedis();
void redisReady.catch((err) => {
  redisState = "error";
  console.warn(`collab gateway redis unavailable: ${String(err?.message ?? err)}`);
});

server.listen(port, () => {
  console.log(`collab gateway ready on http://localhost:${port}`);
});
