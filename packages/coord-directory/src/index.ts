// 开发/测试宿主 Worker：/directory/* 一律路由到平台单例 PlatformDirectory。
// 生产由 apps/coord-gateway 复用同一 DO class 并做认证（p30/F01）。
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
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/directory/"))
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    // 平台单例：全平台一个目录（与 RepoHub 的 idFromName(owner/repo) 分片相对）
    const stub = env.DIRECTORY.get(env.DIRECTORY.idFromName("platform"));
    return stub.fetch(req);
  },
};
