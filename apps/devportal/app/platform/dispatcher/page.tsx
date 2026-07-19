// /platform/dispatcher 调度中心（p30 UI 先行原型批次 4，ADR-003）：mock 数据、不接后端。
// UC-17：@platform/dispatcher 五 loop 巡检 + 「当前定位到的问题」；平台 admin 视角，
// 非 admin 的无权限态由页内 mock 视角开关演示（N1 第四态）。
import type { Metadata } from "next";
import { DispatcherCenter } from "@/components/p30/dispatcher-center";

export const runtime = "edge";

export const metadata: Metadata = { title: "调度中心 · Developer Portal" };

export default function DispatcherPage() {
  return <DispatcherCenter />;
}
