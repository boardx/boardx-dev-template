import type { Env as RepoHubEnv } from "./src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv extends RepoHubEnv {}
}
