// apps/web/lib/mailer.ts — dev 邮件传输（CAP-AUTH）
// 本轮：dev 环境把邮件内容打到控制台/日志；真 SMTP/Resend 留 deferred。
// 重要：接口响应绝不返回令牌；令牌只经"邮件"（此处=日志）+ 用户邮箱获取。

import { recordOutboundEmail, countRecentOutboundEmails } from "@repo/data";

export interface ResetEmail {
  to: string;
  token: string;
  resetUrl: string;
}

export async function sendResetPasswordEmail(mail: ResetEmail): Promise<void> {
  // TODO(deferred)：接真实邮件 provider（SMTP/Resend），用环境变量配置。
  // dev：打日志，便于本地/测试从日志或 dev 端点取链接。
  console.log(
    `[mailer:dev] password-reset to=${mail.to} url=${mail.resetUrl} token=${mail.token}`
  );
}

export interface ShareLinkEmail {
  to: string;
  shareUrl: string;
  threadTitle: string;
}

/**
 * p18 F08：分享聊天「发送到我的邮箱」。与上面 reset-password 同一 dev transport 口径：
 * 打日志 + 落库到 outbound_emails 本地 sink（e2e 经 /api/dev/outbox 断言发信内容含分享链接）。
 * TODO(deferred)：与 reset-password 一起切换到真实 provider（SMTP/Resend）。
 */
export async function sendShareLinkEmail(mail: ShareLinkEmail): Promise<void> {
  const subject = `AVA 聊天分享：${mail.threadTitle || "Untitled chat"}`;
  const body = `你分享的 AVA 聊天链接：${mail.shareUrl}`;
  console.log(`[mailer:dev] ava-share-link to=${mail.to} url=${mail.shareUrl}`);
  await recordOutboundEmail(mail.to, "ava_share_link", subject, body);
}

// p18 F11：消息「发送邮件」——把 AVA 单条消息内容发到当前用户邮箱。
// 与 ava_share_link 同一 dev transport 口径：打日志 + 落库到 outbound_emails。
// 频控（PR #321 review 登记的硬前置）：同一用户同一分钟内最多发送 1 封 ava_message_email，
// 防止连续点击重复触发；查询走既有 outbound_emails 表，不新增基础设施。
export const AVA_MESSAGE_EMAIL_KIND = "ava_message_email";
const AVA_MESSAGE_EMAIL_RATE_WINDOW_MS = 60_000;
const AVA_MESSAGE_EMAIL_RATE_LIMIT = 1;

export interface AvaMessageEmail {
  to: string;
  messageContent: string;
  threadTitle: string;
}

export class RateLimitedError extends Error {
  constructor() {
    super("rate limited");
    this.name = "RateLimitedError";
  }
}

/** 频控命中时抛 RateLimitedError，调用方（路由层）据此返回 429 + 独立提示。 */
export async function sendAvaMessageEmail(mail: AvaMessageEmail): Promise<void> {
  const recent = await countRecentOutboundEmails(
    mail.to,
    AVA_MESSAGE_EMAIL_KIND,
    AVA_MESSAGE_EMAIL_RATE_WINDOW_MS
  );
  if (recent >= AVA_MESSAGE_EMAIL_RATE_LIMIT) {
    throw new RateLimitedError();
  }
  const subject = `AVA 消息：${mail.threadTitle || "Untitled chat"}`;
  console.log(`[mailer:dev] ava-message-email to=${mail.to}`);
  await recordOutboundEmail(mail.to, AVA_MESSAGE_EMAIL_KIND, subject, mail.messageContent);
}

export interface RoomInviteEmail {
  to: string;
  roomName: string;
  inviterEmail: string;
  registerUrl: string;
}

/**
 * p20 F09：邀请未注册邮箱加入房间。与 reset-password/ava-share-link 同一 dev transport 口径：
 * 打日志 + 落库到 outbound_emails（e2e 经 /api/dev/outbox 断言发信内容含注册链接）。
 * 重要：token 只经这条"邮件"（此处=日志+落库）流转给被邀者本人，不进任何 API 响应体。
 * TODO(deferred)：与 reset-password/ava-share-link 一起切换到真实 provider（SMTP/Resend）。
 */
export async function sendRoomInviteEmail(mail: RoomInviteEmail): Promise<void> {
  const subject = `邀请你加入房间「${mail.roomName}」`;
  const body = `${mail.inviterEmail} 邀请你加入房间「${mail.roomName}」，注册即可加入：${mail.registerUrl}`;
  console.log(`[mailer:dev] room-invite to=${mail.to} room=${mail.roomName} url=${mail.registerUrl}`);
  await recordOutboundEmail(mail.to, "room_invite", subject, body);
}
