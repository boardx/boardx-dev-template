// coord-client.ts — coordinator-lock.ts 与 module-lock.ts 共用的 coord-gateway
// client 取用逻辑（2026-07-19 压缩：此前两处逐字节重复，errDetail 完全同构，
// requireClient 只是提示文案不同）。
//
// 只抽这两个纯函数，不碰 acquire/heartbeat/release/status 的业务逻辑——那部分两边
// 有真实的行为差异（coordinator 侧维护带心跳时间戳的本地锁文件、--session 必填、
// acquire 失败要回滚本地锁；module 侧只记 remoteClaimId、--session 可选、无本地
// 锁回滚），强行合并会有把边界情况揉错的真实风险，不做。
import { die } from "./log";
import { createCoordClientFromEnv } from "@repo/coord-protocol/client";
import type { CoordClient, CoordCallError } from "@repo/coord-protocol/client";

export function requireClient(hint: string): CoordClient {
  const client = createCoordClientFromEnv();
  if (!client) die(hint);
  return client;
}

export function errDetail(e: CoordCallError): string {
  return e.status !== undefined ? `HTTP ${e.status}` : `网络异常：${e.message}`;
}
