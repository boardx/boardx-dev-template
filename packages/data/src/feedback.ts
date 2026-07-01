// packages/data/src/feedback.ts — CAP-WEB 用户反馈仓储
import { query } from "./index";

export interface FeedbackAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

export interface FeedbackSubmission {
  id: number;
  user_id: number;
  message: string;
  attachments: FeedbackAttachment[];
  user_agent: string;
  created_at: string;
}

export async function createFeedbackSubmission(input: {
  userId: number;
  message: string;
  attachments: FeedbackAttachment[];
  userAgent: string;
}): Promise<FeedbackSubmission> {
  const rows = await query<FeedbackSubmission>(
    `INSERT INTO feedback_submissions (user_id, message, attachments, user_agent)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, user_id, message, attachments, user_agent, created_at`,
    [input.userId, input.message, JSON.stringify(input.attachments), input.userAgent]
  );
  return rows[0]!;
}
