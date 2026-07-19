// /p/:slug 索引：落到 pulse（工作区默认落点）。鉴权由 /p/:slug/pulse 自身完成。
import { redirect } from "next/navigation";

export const runtime = "edge";

export default function ProjectIndexPage({ params }: { params: { slug: string } }) {
  redirect(`/p/${params.slug}/pulse`);
}
