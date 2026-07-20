// 反向投影冷启动回归（#814 review 要求）：/events 的默认语义从 #814 起改为
// "最近 N 条"（修 #813 的冻结缺陷），projectRepo 因此必须在 cursor 为 null（首次
// 投影/新仓冷启动）时显式传 since=MIN_EVENT_ID 走"从头分页"分支，而不是省略 since
// 依赖默认行为——否则冷启动会跳过 EVENTS_BATCH 条之前的所有历史事件（漏投）。
// 用真实 env.REPOHUB（cloudflare:test 活体 DO 绑定）包一层拦截层记录每次 stub.fetch
// 的 URL，断言 cursor 为 null 时请求的是 since=MIN_EVENT_ID，而非无 since。
import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { runProjectionTick } from "../src/projection";
import type { Env } from "../src/index";

let privatePem = "";

function pemFromPkcs8(der: ArrayBuffer): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"],
  )) as CryptoKeyPair;
  privatePem = pemFromPkcs8((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
});

/** 包一层拦截 env.REPOHUB.get(id).fetch，记录每次请求的 URL，转发给真实 stub。 */
function interceptRepoHub(
  real: DurableObjectNamespace,
  onFetch: (url: string) => void,
): DurableObjectNamespace {
  return {
    ...real,
    idFromName: (name: string) => real.idFromName(name),
    get: (id: DurableObjectId) => {
      const realStub = real.get(id);
      return {
        ...realStub,
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          onFetch(String(input));
          return realStub.fetch(input as never, init);
        }) as typeof fetch,
      } as unknown as DurableObjectStub;
    },
  } as unknown as DurableObjectNamespace;
}

describe("projection 冷启动 since 哨兵", () => {
  it("cursor 为 null（新仓/首次投影）时，请求 /events 显式带 since=MIN_EVENT_ID，不省略 since", async () => {
    const repo = "test/projection-bootstrap-1";
    // 冷启动前先有一条历史事件（模拟"事件早于第一次 cron tick 就已存在"）。
    await env.REPOHUB.get(env.REPOHUB.idFromName(repo)).fetch("https://repohub/relay/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "directory.agent.heartbeat",
        resource_id: "agent:agt_bootstrap",
        agent_id: "agt_bootstrap",
        payload: { agent_id: "agt_bootstrap", at: "2026-07-18T00:00:00Z" },
      }),
    });

    const urls: string[] = [];
    const testEnv: Env = {
      ...(env as unknown as Env),
      REPOHUB: interceptRepoHub(env.REPOHUB, (url) => urls.push(url)),
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: privatePem,
      PROJECTION_REPOS: repo,
    };

    await runProjectionTick(testEnv);

    const eventsCall = urls.find((u) => u.includes("/events?"));
    expect(eventsCall).toBeTruthy();
    expect(eventsCall).toContain("since=evt_00000000000000000000000000");

    // 冷启动确实处理了那条历史事件：游标从 null 推进到它的 event_id（没有被跳过）。
    const cursorRes = await env.REPOHUB.get(env.REPOHUB.idFromName(repo)).fetch("https://repohub/projector/cursor");
    const { cursor } = await cursorRes.json<{ cursor: string | null }>();
    expect(cursor).toMatch(/^evt_/);
  });

  it("cursor 非 null（已投影过）时，请求 /events 带该真实 cursor 作为 since", async () => {
    const repo = "test/projection-bootstrap-2";
    const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));
    await stub.fetch("https://repohub/relay/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "directory.agent.heartbeat",
        resource_id: "agent:agt_seed",
        agent_id: "agt_seed",
        payload: { agent_id: "agt_seed", at: "2026-07-18T00:00:00Z" },
      }),
    });
    // 先跑一次把游标推进，制造"已投影过"的状态。
    await runProjectionTick({ ...(env as unknown as Env), GITHUB_APP_ID: "12345", GITHUB_APP_PRIVATE_KEY: privatePem, PROJECTION_REPOS: repo });
    const { cursor: establishedCursor } = await (await stub.fetch("https://repohub/projector/cursor")).json<{ cursor: string | null }>();
    expect(establishedCursor).toMatch(/^evt_/);

    const urls: string[] = [];
    const testEnv: Env = {
      ...(env as unknown as Env),
      REPOHUB: interceptRepoHub(env.REPOHUB, (url) => urls.push(url)),
      GITHUB_APP_ID: "12345",
      GITHUB_APP_PRIVATE_KEY: privatePem,
      PROJECTION_REPOS: repo,
    };
    await runProjectionTick(testEnv);

    const eventsCall = urls.find((u) => u.includes("/events?"));
    expect(eventsCall).toBeTruthy();
    expect(eventsCall).toContain(`since=${establishedCursor}`);
  });
});
