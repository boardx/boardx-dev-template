// packages/data/src/teamMemories.ts — 团队 Memory（04-F13，uc-team-009）
// 列表按 content 文本排序；(team_id, content) 唯一约束兜底去重。
import { query } from "./index";

export interface TeamMemory {
  id: number;
  team_id: number;
  content: string;
  created_by: number;
  created_at: string;
}

export async function listTeamMemories(teamId: number): Promise<TeamMemory[]> {
  return query<TeamMemory>(
    `SELECT id, team_id, content, created_by, created_at
     FROM team_memories WHERE team_id = $1 ORDER BY content`,
    [teamId]
  );
}

/** 新增一条团队 Memory；同团队内容重复返回 null（调用方提示已存在）。 */
export async function addTeamMemory(teamId: number, content: string, createdBy: number): Promise<TeamMemory | null> {
  const rows = await query<TeamMemory>(
    `INSERT INTO team_memories (team_id, content, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (team_id, content) DO NOTHING
     RETURNING id, team_id, content, created_by, created_at`,
    [teamId, content, createdBy]
  );
  return rows[0] ?? null;
}

/** 删除团队 Memory；返回是否真的删掉了一条。 */
export async function deleteTeamMemory(teamId: number, memoryId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `DELETE FROM team_memories WHERE id = $1 AND team_id = $2 RETURNING id`,
    [memoryId, teamId]
  );
  return rows.length > 0;
}
