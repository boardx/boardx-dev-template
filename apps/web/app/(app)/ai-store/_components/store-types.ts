export type StoreType = "agent" | "skill" | "template";
export type SkillKind = "text" | "image";
export type StoreScope = "personal" | "team" | "platform";
export type StoreStatus = "draft" | "published" | "pending" | "approved" | "rejected";
export type StoreDestination =
  | "explore"
  | "featured"
  | "subscribe"
  | "create"
  | "authorized"
  | "shared"
  | "team-review"
  | "boardx-review";

export interface StoreItem {
  id: number;
  version: number;
  origin_team_id: number;
  name: string;
  description: string;
  type: StoreType;
  scope: StoreScope;
  status: StoreStatus;
  cover: string | null;
  tags: string[];
  examples: string[];
  config?: Record<string, unknown>;
  author: string;
  likes: number;
  views: number;
  featured: boolean;
  allow_copy: boolean;
  copied_from_item_id?: number | null;
  copied_from_version?: number | null;
  liked?: boolean;
  unavailable?: boolean;
  subscriptionScopes?: Array<"personal" | "team">;
  origin_team_name?: string;
  updated_at?: string;
}
