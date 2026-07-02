// apps/web/lib/webhook-auth.ts — CAP-PAYMENT webhook 共享密钥校验（F05 安全修复）
// 安全动机（security review on PR #147）：/api/payment/webhook 之前对谁都开放——
// 任何人只要猜到/枚举到一个 orderId，就能自己 POST { orderId, event: "payment.succeeded" }
// 把订单标成已付款并触发发放。这里加一个共享密钥校验，fail-closed：
// - 环境变量 WEBHOOK_SECRET 未设置 → 一律拒绝（不能因为漏配置就悄悄放行）。
// - 请求头缺失密钥或密钥不匹配 → 一律拒绝。
// - 比较用 timingSafeEqual，避免密钥比对本身被计时攻击猜出来。
// 真实网关接入时，把这里换成网关自己的 HMAC-签名校验方案即可，调用方（webhook 路由）不用大改。
import { timingSafeEqual } from "node:crypto";

export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

/** 校验请求头里的共享密钥是否等于 WEBHOOK_SECRET。fail-closed：秘钥未配置视为校验失败。 */
export function verifyWebhookSecret(headerValue: string | null, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = env.WEBHOOK_SECRET;
  if (!expected) return false; // 未配置密钥 → 拒绝所有请求，不允许"忘配置=放行"。
  if (!headerValue) return false;

  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(expected, "utf8");
  // 长度不同直接 false（timingSafeEqual 要求等长），不影响安全性——密钥长度不是秘密。
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
