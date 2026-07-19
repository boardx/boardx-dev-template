// SLA 超时判定——纯函数（p30/F06，UC-04）。
//
// 输入 membership 的 created_at + 项目的 sla.promiseH（审批承诺时限，默认 24h），
// 输出「剩余多少小时 / 是否已超时 / 是否临界（≤4h，W6 审批队列变红阈值）」。
// 刻意做成纯函数（无 I/O、无 Date.now() 隐式依赖——now 显式传入）：
//   - 供 DO 内 /directory/memberships/:id/sla 端点直接调用；
//   - 供未来 F10 dispatcher 的超时升级 loop 复用（同一份判定逻辑，不重造）；
//   - 单测可完全确定性（不 mock 时钟）。
export interface SlaStatus {
  /** 审批截止时间（ISO，created_at + promiseH）。 */
  deadline: string;
  /** 距截止还剩多少小时（可为负——已超时）。四舍五入到小数点后 2 位。 */
  hoursLeft: number;
  /** 已超过截止时间。 */
  timedOut: boolean;
  /** 临界：0 < hoursLeft <= 4（W6 审批队列 SLA 徽章变红阈值）。 */
  urgent: boolean;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** 计算 SLA 状态。createdAtIso 非法（无法解析）时视为已超时（fail-closed：宁可误报超时，
 *  也不让脏数据显示成「安全」的绿色倒计时）。 */
export function computeSlaStatus(createdAtIso: string, promiseH: number, nowMs: number = Date.now()): SlaStatus {
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) {
    return { deadline: iso(nowMs), hoursLeft: 0, timedOut: true, urgent: false };
  }
  const safePromiseH = Number.isFinite(promiseH) && promiseH > 0 ? promiseH : 24;
  const deadlineMs = createdMs + safePromiseH * 3_600_000;
  const hoursLeft = Math.round(((deadlineMs - nowMs) / 3_600_000) * 100) / 100;
  return {
    deadline: iso(deadlineMs),
    hoursLeft,
    timedOut: hoursLeft <= 0,
    urgent: hoursLeft > 0 && hoursLeft <= 4,
  };
}
