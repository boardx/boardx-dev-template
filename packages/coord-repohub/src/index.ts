// 开发/测试宿主 Worker：按 /repos/:owner/:repo/* 路由到该仓的 RepoHub 实例。
// 生产由 apps/coord-gateway 复用 RepoHub class 并做认证/webhook 接入（F03）。
import { RepoHub } from "./repohub";

export { RepoHub };

export interface Env {
  REPOHUB: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(\/.*)$/);
    if (!m) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    const stub = env.REPOHUB.get(env.REPOHUB.idFromName(`${m[1]}/${m[2]}`));
    return stub.fetch(new Request(new URL(m[3]! + url.search, url.origin), req));
  },
};
