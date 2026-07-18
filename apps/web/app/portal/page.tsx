// Developer Portal 已迁至协作平面 develop.boardx.us（#523 两平面分离，#544 收口）。
// 产品面保留本跳转页：devapp 上的旧书签/文档链接不断链。协作平面代码在 apps/devportal。
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PortalMoved() {
  redirect("https://develop.boardx.us");
}
