// 纯逻辑：健康检查响应体（可单测，路由直接复用）
export interface HealthPayload {
  ok: boolean;
  service: string;
}

export function healthPayload(): HealthPayload {
  return { ok: true, service: "web" };
}
