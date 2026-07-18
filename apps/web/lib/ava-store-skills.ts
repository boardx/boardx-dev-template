import { AVA_TOOL_OPTIONS, type AvaToolOption } from "@repo/ai";
import { listUsableSubscribedAiStoreItems } from "@repo/data";

export const STORE_SKILL_ID_PREFIX = "store-skill-";

export async function listAvaSkillOptions(userId: number, teamId: number | null): Promise<AvaToolOption[]> {
  if (teamId == null) return [...AVA_TOOL_OPTIONS];
  try {
    const items = await listUsableSubscribedAiStoreItems(userId, teamId);
    return [
      ...AVA_TOOL_OPTIONS,
      ...items.filter((item) => item.type === "skill").map((item) => ({
        id: `${STORE_SKILL_ID_PREFIX}${item.id}`,
        label: item.name,
        description: item.description,
        version: item.version,
        skillKind: item.config.skillKind === "image" ? "image" as const : "text" as const,
        config: item.config,
      })),
    ];
  } catch (err) {
    console.error("[ava-skills] subscription query failed", err);
    return [...AVA_TOOL_OPTIONS];
  }
}
