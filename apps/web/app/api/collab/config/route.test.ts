import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

const ENV_KEYS = ["COLLAB_WS_PUBLIC_URL", "COLLAB_WS_PORT"] as const;
const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);

afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("GET /api/collab/config", () => {
  it("COLLAB_WS_PUBLIC_URL 设置时整体覆盖（生产反代场景）", async () => {
    process.env.COLLAB_WS_PUBLIC_URL = "wss://devapp.boardx.us/api/collab/ws";
    const res = await GET(new Request("https://devapp.boardx.us/api/collab/config"));
    expect(await res.json()).toEqual({ wsUrl: "wss://devapp.boardx.us/api/collab/ws" });
  });

  it("未设置覆盖 + https 请求 → wss（不再产出被混合内容拦截的 ws://）", async () => {
    delete process.env.COLLAB_WS_PUBLIC_URL;
    delete process.env.COLLAB_WS_PORT;
    const res = await GET(new Request("https://example.com/api/collab/config"));
    expect(await res.json()).toEqual({ wsUrl: "wss://example.com:3001/api/collab/ws" });
  });

  it("未设置覆盖 + http 请求 → 保持原开发行为 ws://host:port", async () => {
    delete process.env.COLLAB_WS_PUBLIC_URL;
    process.env.COLLAB_WS_PORT = "3111";
    const res = await GET(new Request("http://localhost:3000/api/collab/config"));
    expect(await res.json()).toEqual({ wsUrl: "ws://localhost:3111/api/collab/ws" });
  });
});
