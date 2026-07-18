"use client";
// coord 实时源适配器（p29/F09）：整页共享一条到 gateway 的 WebSocket，
// 各卡片用 useCoordStream 订阅感兴趣的事件类型，收到即触发自己的重新拉取
// （数据本体仍走各自的 /api/portal/* 代理——WS 只是"该刷新了"的信号，不换权威源）。
//
// 协议（events.md §订阅）：连接先补发 ?since= 之后积压再进实时；断线指数退避重连，
// 用最后收到的 event_id 续传，不重不漏。
// 鉴权：每次连接前经 /api/portal/coord-stream（Access 门禁 + 服务端持 token）换
// 60s 一次性 ticket——浏览器永远拿不到长期 token。
// Access 会话过期：ticket 请求走 portalFetch，401 → 整页重认证（#588 行为不回退）。
import { useEffect, useRef } from "react";
import { portalFetch } from "./portal-fetch";

export interface CoordEvent {
  protocol: string;
  event_id: string;
  type: string;
  resource_id: string;
  agent_id: string;
  at: string;
  payload: Record<string, unknown>;
}

type TicketPayload =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; ticket: string; expires_at: string; ws_url: string };

type Listener = (e: CoordEvent) => void;

// 模块级单例：整页一条连接（多卡片订阅共享），HMR/多 hook 挂载不会开第二条
const listeners = new Set<Listener>();
let started = false;
let ws: WebSocket | null = null;
let lastEventId: string | null = null;
let attempt = 0;
let unconfigured = false; // 数据源未接线 → 永久停止尝试（轮询兜底仍在）
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const RECONNECT_MAX_MS = 30_000;
const HEARTBEAT_MS = 30_000; // DO 侧 hibernation auto-response："ping" → "pong"

function scheduleReconnect(): void {
  if (unconfigured || reconnectTimer) return;
  attempt += 1;
  // 指数退避 + 抖动：1s, 2s, 4s, … 封顶 30s
  const delay = Math.min(RECONNECT_MAX_MS, 1000 * 2 ** Math.min(attempt - 1, 5)) + Math.random() * 500;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delay);
}

function teardownSocket(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  ws = null;
}

async function connect(): Promise<void> {
  if (unconfigured || ws) return;
  try {
    const res = await portalFetch("/api/portal/coord-stream");
    if (!res) return; // 401 → 整页重认证进行中（portal-fetch.ts），无需重试
    if (!res.ok) {
      scheduleReconnect();
      return;
    }
    const body = (await res.json()) as TicketPayload;
    if (!body.configured) {
      unconfigured = true; // 部署中间态：不刷错误、不重试，卡片轮询兜底
      return;
    }
    if ("error" in body) {
      scheduleReconnect();
      return;
    }
    const url = new URL(body.ws_url);
    url.searchParams.set("ticket", body.ticket);
    if (lastEventId) url.searchParams.set("since", lastEventId); // 断点续传
    const sock = new WebSocket(url.toString());
    sock.onopen = () => {
      attempt = 0;
      heartbeatTimer = setInterval(() => {
        try { sock.send("ping"); } catch { /* 关闭竞态，onclose 兜底 */ }
      }, HEARTBEAT_MS);
    };
    sock.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data as string) as CoordEvent;
        if (typeof e.event_id === "string" && typeof e.type === "string") {
          lastEventId = e.event_id;
          listeners.forEach((l) => {
            try { l(e); } catch { /* 单个订阅者异常不拖垮广播 */ }
          });
        }
      } catch { /* "pong" 等非 JSON 帧，忽略 */ }
    };
    sock.onclose = () => {
      teardownSocket();
      scheduleReconnect();
    };
    sock.onerror = () => {
      try { sock.close(); } catch { /* 已关闭 */ }
    };
    ws = sock;
  } catch {
    scheduleReconnect();
  }
}

/** 订阅 coord 实时事件。types 支持前缀通配（"lease.*"）；回调里做自己的数据重拉。 */
export function useCoordStream(types: string[], onEvent: (e: CoordEvent) => void): void {
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;
  const typesKey = types.join(",");
  useEffect(() => {
    const wanted = typesKey.split(",").filter(Boolean);
    const listener: Listener = (e) => {
      const hit = wanted.some((t) =>
        t.endsWith(".*") ? e.type.startsWith(t.slice(0, -1)) : e.type === t,
      );
      if (hit) cbRef.current(e);
    };
    listeners.add(listener);
    if (!started) {
      started = true;
      void connect();
    }
    return () => {
      listeners.delete(listener);
    };
  }, [typesKey]);
}

/** 事件风暴保护：突发多条事件只触发一次尾部重拉。 */
export function debounceTrailing(fn: () => void, ms = 500): () => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn();
    }, ms);
  };
}
