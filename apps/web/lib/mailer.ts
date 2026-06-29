// apps/web/lib/mailer.ts — dev 邮件传输（CAP-AUTH）
// 本轮：dev 环境把邮件内容打到控制台/日志；真 SMTP/Resend 留 deferred。
// 重要：接口响应绝不返回令牌；令牌只经"邮件"（此处=日志）+ 用户邮箱获取。

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
