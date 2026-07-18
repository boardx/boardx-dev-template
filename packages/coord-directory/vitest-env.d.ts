import type { Env as DirectoryEnv } from "./src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv extends DirectoryEnv {}
}
