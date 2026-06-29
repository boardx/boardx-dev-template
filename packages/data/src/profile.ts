// packages/data/src/profile.ts — CAP-AUTH 账号资料与偏好仓储
import { query } from "./index";

export interface Profile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar: string | null;
}

export async function getProfile(userId: number): Promise<Profile | undefined> {
  const rows = await query<Profile>(
    "SELECT id, email, first_name, last_name, display_name, avatar FROM users WHERE id = $1",
    [userId]
  );
  return rows[0];
}

export async function updateProfile(
  userId: number,
  fields: { displayName?: string; avatar?: string }
): Promise<void> {
  if (fields.displayName !== undefined)
    await query("UPDATE users SET display_name = $2 WHERE id = $1", [userId, fields.displayName]);
  if (fields.avatar !== undefined)
    await query("UPDATE users SET avatar = $2 WHERE id = $1", [userId, fields.avatar]);
}

export interface UserSettings {
  ai_model: string;
  default_privacy: string;
}

/** 取偏好，无记录则返回默认值。 */
export async function getSettings(userId: number): Promise<UserSettings> {
  const rows = await query<UserSettings>(
    "SELECT ai_model, default_privacy FROM user_settings WHERE user_id = $1",
    [userId]
  );
  return rows[0] ?? { ai_model: "claude-opus-4-8", default_privacy: "private" };
}

export async function upsertSettings(userId: number, s: UserSettings): Promise<void> {
  await query(
    `INSERT INTO user_settings (user_id, ai_model, default_privacy, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET ai_model = $2, default_privacy = $3, updated_at = now()`,
    [userId, s.ai_model, s.default_privacy]
  );
}
