// packages/ai/src/studioGenerator.ts — CAP-AI Studio 生成器（P12 F01 地基）
//
// Studio 面板的音频概览/信息图/演示文稿生成：同 AVA（gateway.ts）的 sanctioned stub 模式——
// 未接入真实生成管线（TTS/图片渲染/PPTX 生成），产出确定性占位制品，使上层可在无供应商
// 额度环境下跑通「配置 → 生成中 → 结果/失败」端到端闭环。真实管线接入不改变本层契约
// （generateStudioArtifact 的输入输出形状），只需替换内部实现。

export type StudioArtifactType = "audio" | "infographic" | "presentation";
export type StudioArtifactSource = "room_files" | "current_chat";

export interface StudioGenerateInput {
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
  /** 供来源上下文（房间文件名 / 当前聊天消息数）用于占位内容的确定性描述。 */
  sourceLabel: string;
}

export interface StudioGenerateResult {
  /** 占位产物内容（文本/base64 等，按类型区分），写入对象存储。 */
  content: Buffer;
  contentType: string;
  /** 产物文件扩展名，用于对象 key 命名。 */
  ext: string;
  /** 结果卡片标题。 */
  title: string;
}

/** e2e/测试专用触发词：prompt 含此串时生成器主动抛错，用于确定性验证「生成失败 + 重试」
 *  （F01 验收）。与 packages/ai/gateway.ts 的 FORCE_FAIL_MARKER 同一 sanctioned 模式。 */
export const STUDIO_FORCE_FAIL_MARKER = "__studio_force_fail__";

const TYPE_LABEL: Record<StudioArtifactType, string> = {
  audio: "音频概览",
  infographic: "信息图",
  presentation: "演示文稿",
};

/** 确定性生成一个占位制品（stub，无真实 AI/TTS/渲染管线）。
 *  失败态由 STUDIO_FORCE_FAIL_MARKER 触发，供 e2e 确定性验证失败 + 重试分支。 */
export async function generateStudioArtifact(
  input: StudioGenerateInput
): Promise<StudioGenerateResult> {
  if (input.prompt.includes(STUDIO_FORCE_FAIL_MARKER)) {
    throw new Error("Studio 生成失败（测试触发）");
  }

  const label = TYPE_LABEL[input.type];
  const title = `${label} · ${input.sourceLabel}`;

  if (input.type === "audio") {
    // 占位音频：非真实音频编码，仅用于走通「可播放」链路的确定性 stub 内容。
    const content = Buffer.from(
      `STUDIO_AUDIO_STUB\ntype=audio\nsource=${input.source}\nprompt=${input.prompt}\n`,
      "utf8"
    );
    return { content, contentType: "audio/mpeg", ext: "mp3", title };
  }

  if (input.type === "infographic") {
    // 占位信息图：1x1 透明 PNG（真实、有效的最小 PNG，供前端 <img> 直接渲染而非纯文本占位）。
    const onePixelPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const content = Buffer.from(onePixelPngBase64, "base64");
    return { content, contentType: "image/png", ext: "png", title };
  }

  // presentation：占位纯文本充当 PPTX 内容（真实生成管线留给 F02）。
  const content = Buffer.from(
    `STUDIO_PRESENTATION_STUB\ntitle=${title}\nsource=${input.source}\nprompt=${input.prompt}\n`,
    "utf8"
  );
  return { content, contentType: "application/octet-stream", ext: "pptx", title };
}
