import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { createConnection } from "node:net";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const REDIS_CHANNEL = "boardx:collab:transport";
const serverId = randomUUID();
const port = Number(process.env.COLLAB_WS_PORT ?? "3001");

const boards = new Map();
let publisher;
let redisReady;

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname !== "/api/collab/ws") {
    socket.destroy();
    return;
  }
  const boardId = url.searchParams.get("boardId")?.trim();
  const key = req.headers["sec-websocket-key"];
  if (!boardId || typeof key !== "string") {
    socket.destroy();
    return;
  }

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
      const parsed = readFrame(client.buffer);
      if (!parsed) break;
      client.buffer = client.buffer.subarray(parsed.bytes);
      if (parsed.opcode === 0x8) {
        socket.end();
        return;
      }
      if (parsed.opcode !== 0x1) continue;
      void redisReady
        .then(() => publisher.publish(REDIS_CHANNEL, JSON.stringify({
          serverId,
          boardId,
          payload: {
            type: "message",
            boardId,
            data: parsed.payload,
            fromClientId: client.id,
          },
        })))
        .catch((err) => {
          sendFrame(socket, JSON.stringify({ type: "error", message: String(err?.message ?? err) }));
        });
    }
  });
  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

function addClient(client) {
  const set = boards.get(client.boardId) ?? new Set();
  set.add(client);
  boards.set(client.boardId, set);
}

function removeClient(client) {
  const set = boards.get(client.boardId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) boards.delete(client.boardId);
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

async function initRedis() {
  publisher = new RedisCommandClient(process.env.REDIS_URL);
  const subscriber = new RedisSubscriber(process.env.REDIS_URL);
  await publisher.connect();
  await subscriber.connect();
  await subscriber.subscribe(REDIS_CHANNEL, (message) => {
    let envelope;
    try {
      envelope = JSON.parse(message);
    } catch {
      return;
    }
    if (!envelope || typeof envelope.boardId !== "string") return;
    broadcast(envelope.boardId, JSON.stringify({ ...envelope.payload, via: "redis" }));
  });
}

redisReady = initRedis();
void redisReady.catch((err) => {
  console.warn(`collab gateway redis unavailable: ${String(err?.message ?? err)}`);
});

server.listen(port, () => {
  console.log(`collab gateway ready on http://localhost:${port}`);
});
