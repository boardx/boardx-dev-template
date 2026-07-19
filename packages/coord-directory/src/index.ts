// 开发/测试宿主 Worker：/directory/* 一律路由到平台单例 PlatformDirectory。
// 生产由 apps/coord-gateway 复用同一 DO class 并做认证（p30/F01）——gateway 直接
// import { PlatformDirectory } class 绑定同一 DO binding，从不经过本文件的默认
// fetch handler，所以本文件本身「不会被误部署到生产」只是口头约定；#770 跟进 3/3
// 把它变成代码 fail-closed 断言：写路径没有 COORD_DIRECTORY_TEST_HOST="1" 这个
// 仅测试环境会设置的 env 标志位，一律 403，不转发给 DO。
import { PlatformDirectory } from "./directory";

export { PlatformDirectory };
export {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  PROJECT_VISIBILITIES,
  type MembershipRole,
  type MembershipStatus,
} from "./directory";

export interface Env {
  DIRECTORY: DurableObjectNamespace;
  // 仅测试环境显式设置为 "1"（见 wrangler.toml [vars]）；生产/其余环境缺省即拒绝写。
  COORD_DIRECTORY_TEST_HOST?: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/directory/"))
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    // fail-closed：非 GET（写路径）必须带测试环境标志位，否则直接拒绝，不转发给 DO。
    if (req.method !== "GET" && env.COORD_DIRECTORY_TEST_HOST !== "1") {
      return new Response(
        JSON.stringify({
          error: "test_host_writes_disabled",
          details: ["独立测试 host 的写路径需要 COORD_DIRECTORY_TEST_HOST=1；缺失即 fail-closed 拒绝，防止误部署到生产"],
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }
    // 平台单例：全平台一个目录（与 RepoHub 的 idFromName(owner/repo) 分片相对）
    const stub = env.DIRECTORY.get(env.DIRECTORY.idFromName("platform"));
    return stub.fetch(req);
  },
};
