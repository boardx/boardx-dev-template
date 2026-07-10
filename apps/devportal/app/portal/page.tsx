// 兼容路径：产品面门户挂 /portal，协作面挂根路径。/portal 一律回根，
// 避免文档/书签里的两种链接形态各指一处。
import { redirect } from "next/navigation";

export const runtime = "edge";

export default function PortalAlias() {
  redirect("/");
}
