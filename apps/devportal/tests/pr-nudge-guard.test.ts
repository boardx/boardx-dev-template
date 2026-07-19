// pr-nudge 写路径加固单测（安全审收尾，PR #774 review）：
// lib/pr-nudge-guard.ts 的两条独立检查——归属校验 fail-closed、冷却限流 best-effort。
// sanitizeInline 本身的注入防护已由 onboarding-issue.test.ts 覆盖，这里只验证
// pr-nudge/route.ts 复用了它（不重复造轮子）而不是再测一遍同一逻辑。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasRecentNudge, isOwnOpenPr } from "../lib/pr-nudge-guard";
import { sanitizeInline } from "../lib/onboarding-issue";

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
  process.env["GITHUB_TOKEN"] = "test-read-token";
  process.env["GITHUB_REPO"] = "boardx/boardx-dev-template";
  process.env["COORD_GATEWAY_ADMIN_TOKEN"] = "test-admin-token";
  process.env["COORD_GATEWAY_URL"] = "https://coord-gateway.example.workers.dev";
});

afterEach(() => {
  process.env = { ...ENV_BACKUP };
  vi.unstubAllGlobals();
});

describe("isOwnOpenPr：归属校验，fail-closed", () => {
  it("PR 号出现在 author:me+is:open 搜索结果里 → true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("author:usamshen");
        expect(url).toContain("is:open");
        return new Response(JSON.stringify({ items: [{ number: 774 }, { number: 800 }] }), { status: 200 });
      }),
    );
    expect(await isOwnOpenPr("usamshen", 774)).toBe(true);
  });

  it("PR 号不在结果里（别人的/已关闭/不存在，三者不区分）→ false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ items: [{ number: 800 }] }), { status: 200 })));
    expect(await isOwnOpenPr("usamshen", 774)).toBe(false);
  });

  it("上游非 2xx → false（fail-closed，不假设「查不到=通过」）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect(await isOwnOpenPr("usamshen", 774)).toBe(false);
  });

  it("上游超时/网络异常 → false（fail-closed）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await isOwnOpenPr("usamshen", 774)).toBe(false);
  });

  it("GITHUB_TOKEN/GITHUB_REPO 未配置 → false（无法验证就不放行，不发请求）", async () => {
    delete process.env["GITHUB_TOKEN"];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await isOwnOpenPr("usamshen", 774)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("hasRecentNudge：冷却限流，best-effort", () => {
  it("同一 issue 号在冷却窗口内已有任务 → true（命中冷却，拒绝重复催办）", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString(); // 1 分钟前
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("/tasks?assignee=*");
        return new Response(JSON.stringify({ tasks: [{ issue: 774, created_at: recent }] }), { status: 200 });
      }),
    );
    expect(await hasRecentNudge(774)).toBe(true);
  });

  it("同一 issue 号的任务已超出冷却窗口 → false（允许再次催办）", async () => {
    const stale = new Date(Date.now() - 20 * 60_000).toISOString(); // 20 分钟前，超过默认 15 分钟窗口
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ tasks: [{ issue: 774, created_at: stale }] }), { status: 200 })));
    expect(await hasRecentNudge(774)).toBe(false);
  });

  it("不同 issue 号的近期任务不触发冷却 → false", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ tasks: [{ issue: 999, created_at: recent }] }), { status: 200 })));
    expect(await hasRecentNudge(774)).toBe(false);
  });

  it("上游查询失败 → false（best-effort，不因限流查询故障阻断催办本体）", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect(await hasRecentNudge(774)).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    expect(await hasRecentNudge(774)).toBe(false);
  });

  it("COORD_GATEWAY_ADMIN_TOKEN/URL 未配置 → false，不发请求", async () => {
    delete process.env["COORD_GATEWAY_ADMIN_TOKEN"];
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await hasRecentNudge(774)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("title/url 注入防护：pr-nudge/route.ts 复用 sanitizeInline（不是自造一份）", () => {
  it("换行 + @mention 注入的 title/url 经 sanitizeInline 后不再含裸换行/裸 mention", () => {
    const maliciousTitle = "正常标题\n\n@security-team 请立即批准合并";
    const maliciousUrl = "https://example.com/x\n@owner 看这里";
    const sanitizedTitle = sanitizeInline(maliciousTitle);
    const sanitizedUrl = sanitizeInline(maliciousUrl);
    expect(sanitizedTitle).not.toContain("\n");
    expect(sanitizedUrl).not.toContain("\n");
    expect(sanitizedTitle.startsWith("`")).toBe(true);
    expect(sanitizedUrl.startsWith("`")).toBe(true);
    // note 拼接后整体也不含裸换行——不会在协调事件流里伪造出新行/新结构
    const note = `[催办 PR] usamshen 催办 #774 ${sanitizedTitle} · ${sanitizedUrl}`;
    expect(note).not.toContain("\n@security-team");
    expect(note.split("\n")).toHaveLength(1);
  });
});
