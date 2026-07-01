// apps/web/lib/studio.ts — Studio「房间文件」来源解析（P12 F01）
//
// KNOWN LIMITATION: kb_files 表没有 room_id 外键（p10 交付时是用户/团队级知识库，
// 不是房间级），所以这里只能按现有 schema 近似"房间文件"：
// - 团队房间（room.team_id != null）→ 该团队全部 ready 的 kb_files（team scope
//   本身就对同团队成员共享，语义上站得住）。
// - 个人房间（room.team_id == null）→ 房间 **owner** 的 personal scope 文件，
//   而不是当前请求者的——否则同一房间内不同成员会看到彼此互不相关的私人文件集，
//   "房间文件"这个说法在不同人眼里就对不上，且会把请求者的私人文件误标成"房间文件"。
// 这仍不是真正的"这个房间专属文件"，只是两个近似里更不离谱的一个。真要做房间级文件
// 关联，需要新增一张房间-文件关联表（留给后续 feature）。
import { listKbFiles, type KbFile, type Room } from "@repo/data";

export async function listRoomFiles(room: Room): Promise<KbFile[]> {
  if (room.team_id != null) {
    return listKbFiles({ ownerUserId: room.owner_user_id, scope: "team", teamId: room.team_id });
  }
  return listKbFiles({ ownerUserId: room.owner_user_id, scope: "personal" });
}
