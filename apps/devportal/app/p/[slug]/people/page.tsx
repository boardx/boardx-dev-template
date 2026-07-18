// W5 /p/:slug/people 花名册（p30 UI 先行原型，ADR-003）：mock 数据、不接后端。
// slug 直接透传给原型组件展示（mock 项目：boardx / acme-crm）。
import type { Metadata } from "next";
import { PeopleRoster } from "@/components/p30/people-roster";

export const runtime = "edge";

export const metadata: Metadata = { title: "花名册 · Developer Portal" };

export default function PeoplePage({ params }: { params: { slug: string } }) {
  return <PeopleRoster slug={params.slug} />;
}
