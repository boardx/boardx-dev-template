import type { Env as GatewayEnv } from "./src/index";

declare module "cloudflare:test" {
  interface ProvidedEnv extends GatewayEnv {}
}
