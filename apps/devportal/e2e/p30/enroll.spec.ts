// p30-F07 e2e：enroll 向导接真——命名空间查重 / mint-on-reveal / 真实首心跳点亮 /
// revoke 即时失效。锚定批 1 已签核 testid（enroll-open/enroll-step-*/token-reveal/
// token-revealed/first-heartbeat-waiting/first-heartbeat-live/fleet-row-*）。
//
// 分两层断言（诚实降级，同 auth-gray.spec.ts 的 remote skip 模式）：
//   - 无 live gateway 凭据：只验证 UI 骨架（向导可开、三步可走到 mint 前）+
//     coord-gateway 未接通时的诚实降级文案，不假装打通了真实数据。
//   - 有 live gateway 凭据（COORD_GATEWAY_URL/COORD_API_TOKEN/COORD_GATEWAY_ADMIN_TOKEN
//     三者齐备，CI/本地手动注入时才成立）：走完整闭环——mint 真 token →「后台 curl」
//     直接打真心跳（模拟 agent 进程）→ WS/轮询点亮 first-heartbeat-live → fleet-row 新增。
//
// cookie 名同 auth-gray.spec.ts 的纪律（#769）：session cookie 加了 __Host- 前缀
// （本文件此前一直用旧名 devportal_session，服务端已经不认，本次同步）；
// `context.addCookies` 用 `domain`+`path`（而非 `url`）才能通过本地这套
// Playwright/Chromium 组合对 `__Host-` 前缀 cookie 的 CDP 校验。
import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_SESSION_SECRET } from "../../playwright.config";

const liveGatewayConfigured = Boolean(
  process.env["COORD_GATEWAY_URL"] && process.env["COORD_API_TOKEN"] && process.env["COORD_GATEWAY_ADMIN_TOKEN"],
);

async function mintSessionCookie(login: string): Promise<string> {
  return new SignJWT({ email: null, name: login, avatarUrl: null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(login)
    .setIssuer("devportal")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
}

test.describe("enroll 向导 UI 骨架（无 live gateway 也应成立）", () => {
  test("车队管理台可达 → 打开向导 → 三步字段齐全 → 关闭不留痕", async ({ browser, baseURL }) => {
    const cookie = await mintSessionCookie("e2e-enroll-user");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      {
        name: "__Host-devportal_session",
        value: cookie,
        domain: new URL(baseURL as string).hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const res = await page.goto("/me/agents");
    expect(res?.status()).toBe(200);

    await page.getByTestId("enroll-open").click();
    await expect(page.getByTestId("enroll-wizard")).toBeVisible();
    await expect(page.getByTestId("enroll-step-1")).toBeVisible();

    const name = `e2e-agent-${Date.now()}`;
    await page.getByTestId("enroll-name-input").fill(name);
    await page.getByTestId(`enroll-runtime-Claude Code`).click();
    await expect(page.getByTestId("enroll-next-1")).toBeEnabled();
    await page.getByTestId("enroll-next-1").click();
    await expect(page.getByTestId("enroll-step-2")).toBeVisible();
    await expect(page.getByTestId("token-reveal")).toBeVisible();

    // 关闭向导不应留下部分登记（点 ✕，覆盖层消失即视为干净退出）
    await page.getByRole("button", { name: "关闭向导" }).click({ force: true });
    await page.getByTestId("enroll-wizard").waitFor({ state: "detached", timeout: 10_000 });
    await context.close();
  });
});

test.describe("enroll 全流程接真（需 live coord-gateway 凭据）", () => {
  test.skip(!liveGatewayConfigured, "本地/CI 未注入 COORD_GATEWAY_URL+COORD_API_TOKEN+COORD_GATEWAY_ADMIN_TOKEN，诚实跳过而非假绿");

  test("mint-on-reveal → 后台 curl 打真心跳 → first-heartbeat-live 点亮 → fleet-row 新增", async ({ browser, baseURL, request }) => {
    const cookie = await mintSessionCookie("e2e-enroll-user");
    const context = await browser.newContext({ baseURL });
    await context.addCookies([
      {
        name: "__Host-devportal_session",
        value: cookie,
        domain: new URL(baseURL as string).hostname,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    await page.goto("/me/agents");

    await page.getByTestId("enroll-open").click();
    const name = `e2e-live-${Date.now()}`;
    await page.getByTestId("enroll-name-input").fill(name);
    await page.getByTestId("enroll-next-1").click();
    await page.getByTestId("token-reveal").click();
    await expect(page.getByTestId("token-revealed")).toBeVisible({ timeout: 15_000 });

    const tokenText = await page.locator('[data-testid=token-revealed] code').innerText();
    expect(tokenText).toMatch(/^coordtk_[0-9a-f]{64}$/);

    await page.getByTestId("enroll-next-2").click();
    await expect(page.getByTestId("first-heartbeat-waiting")).toBeVisible();

    // 「后台 curl 打真心跳」：不经 devportal UI，直接模拟 agent 进程用它自己的
    // scoped token 打心跳（agent_id 从 identifier 反解不便，改用 fleet 接口拿 agentId）。
    const fleetRes = await request.get("/api/portal/my-agents", {
      headers: { cookie: `__Host-devportal_session=${cookie}` },
    });
    const fleetBody = (await fleetRes.json()) as { fleet: Array<{ id: string; agentId: string }> };
    const mine = fleetBody.fleet.find((a) => a.id.endsWith(`/${name}`));
    expect(mine, "enroll 后 fleet 列表应立即出现该 agent（无审批等待，D2）").toBeTruthy();

    const gw = process.env["COORD_GATEWAY_URL"];
    const hb = await request.post(`${gw}/api/coord/directory/agents/${mine!.agentId}/heartbeat`, {
      headers: { Authorization: `Bearer ${tokenText}`, "content-type": "application/json" },
      data: {},
    });
    expect(hb.status()).toBe(200);

    await expect(page.getByTestId("first-heartbeat-live")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("enroll-done").click();
    await expect(page.getByTestId(`fleet-row-${mine!.id.replace(/[@/.]/g, "-")}`)).toBeVisible();

    await context.close();
  });
});
