// apps/web/lib/mailer.ts — dev 邮件传输（CAP-AUTH）
// 本轮：dev 环境把邮件内容打到控制台/日志；真 SMTP/Resend 留 deferred。
// 重要：接口响应绝不返回令牌；令牌只经"邮件"（此处=日志）+ 用户邮箱获取。

import { recordOutboundEmail } from "@repo/data";

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
