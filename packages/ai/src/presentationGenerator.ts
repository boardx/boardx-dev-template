// packages/ai/src/presentationGenerator.ts — CAP-AI 演示文稿生成器（P12 F02）
//
// 同 studioGenerator.ts / gateway.ts 的 sanctioned stub 模式——未接入真实生成管线
// （AI 大纲 + PPTX/PDF 渲染），产出确定性占位幻灯片 + 占位 PPTX/PDF 二进制内容，
// 使上层可在无供应商额度环境下跑通「配置 → 生成中 → 预览卡片/失败」端到端闭环。
// 真实管线接入不改变本层契约（generatePresentation 的输入输出形状），只需替换内部实现。

export type PresentationSource = "current_chat" | "room_files" | "instructions";
export type PresentationStyle = "minimal" | "vibrant" | "calm";

export interface PresentationSlide {
  n: number;
  title: string;
  bullets: string[];
}

export interface PresentationGenerateInput {
  topic: string;
  source: PresentationSource;
  instructions: string;
  pages: number;
  style: string;
  /** 供来源上下文（聊天消息数/房间文件名/说明文本）用于占位内容的确定性描述。 */
  sourceLabel: string;
}

export interface PresentationGenerateResult {
  title: string;
  slides: PresentationSlide[];
  pptxContent: Buffer;
  pdfContent: Buffer;
}

/** e2e/测试专用触发词：instructions/topic 含此串时生成器主动抛错，用于确定性验证
 *  「生成失败 + 重试」（F02 验收）。与 studioGenerator.ts 的 STUDIO_FORCE_FAIL_MARKER 同一模式。 */
export const PRESENTATION_FORCE_FAIL_MARKER = "__presentation_force_fail__";

const STYLE_LABEL: Record<string, string> = {
  minimal: "Minimal",
  vibrant: "Vibrant",
  calm: "Calm",
};

function buildSlides(topic: string, pages: number): PresentationSlide[] {
  return Array.from({ length: pages }, (_, i) => {
    const n = i + 1;
    if (n === 1) {
      return { n, title: topic, bullets: [`主题：${topic}`] };
    }
    return {
      n,
      title: `${topic} — 第 ${n} 页`,
      bullets: [`要点 ${n}-1`, `要点 ${n}-2`],
    };
  });
}

/** 确定性生成一份占位演示文稿（stub，无真实 AI 大纲/PPTX/PDF 渲染管线）。
 *  失败态由 PRESENTATION_FORCE_FAIL_MARKER 触发，供 e2e 确定性验证失败 + 重试分支。 */
export async function generatePresentation(
  input: PresentationGenerateInput
): Promise<PresentationGenerateResult> {
  if (
    input.topic.includes(PRESENTATION_FORCE_FAIL_MARKER) ||
    input.instructions.includes(PRESENTATION_FORCE_FAIL_MARKER)
  ) {
    throw new Error("演示文稿生成失败（测试触发）");
  }

  const pages = Math.min(30, Math.max(1, Math.round(input.pages) || 8));
  const styleLabel = STYLE_LABEL[input.style] ?? input.style;
  const title = input.topic.trim() || "未命名演示";
  const slides = buildSlides(title, pages);

  // 占位 PPTX：真实纯文本内容充当二进制产物（保证「可真实下载」的验收要求——
  // 是有效可读的 Buffer 内容，而非空文件，只是不是真正的 Office Open XML 格式）。
  const pptxContent = Buffer.from(
    `STUDIO_PRESENTATION_PPTX_STUB\ntitle=${title}\nstyle=${styleLabel}\nsource=${input.source}\nsourceLabel=${input.sourceLabel}\npages=${pages}\n\n` +
      slides.map((s) => `[${s.n}] ${s.title}\n${s.bullets.map((b) => `  - ${b}`).join("\n")}`).join("\n\n"),
    "utf8"
  );
  const pdfContent = Buffer.from(
    `STUDIO_PRESENTATION_PDF_STUB\ntitle=${title}\nstyle=${styleLabel}\npages=${pages}\n`,
    "utf8"
  );

  return { title, slides, pptxContent, pdfContent };
}

// ─── 修订 / 单页优化（P12 F03，同一 sanctioned stub 模式）───────────────────────

export interface PresentationRevisePlanInput {
  /** 修订前的当前幻灯片（供 stub 在原基础上做确定性变换，而非从零生成）。 */
  currentSlides: PresentationSlide[];
  currentTitle: string;
  /** 修改要求（改结构/受众/风格等自然语言描述）。 */
  instructions: string;
}

export interface PresentationRevisePlanResult {
  title: string;
  slides: PresentationSlide[];
  /** 方案变更摘要（供修订面板展示「更新后方案」，见 mockup .planrow）。 */
  summary: { label: string }[];
}

export interface PresentationOptimizePageInput {
  currentSlide: PresentationSlide;
  /** 优化要求（如「加一张架构图并精简文字」）。 */
  instructions: string;
}

export interface PresentationOptimizePageResult {
  slide: PresentationSlide;
}

/** 与 PRESENTATION_FORCE_FAIL_MARKER 同一模式：instructions 含此串时确定性失败，
 *  供 e2e 验证「修订/优化失败不破坏原可查看结果」。 */
export const PRESENTATION_REVISION_FORCE_FAIL_MARKER = "__presentation_revision_force_fail__";

/** 方案层修订（整体）：在当前幻灯片基础上按 instructions 做确定性占位调整——
 *  不接入真实 AI 重生成，只保证「提修改要求 → 得到更新方案」的端到端契约可跑通。 */
export async function revisePresentationPlan(
  input: PresentationRevisePlanInput
): Promise<PresentationRevisePlanResult> {
  if (input.instructions.includes(PRESENTATION_REVISION_FORCE_FAIL_MARKER)) {
    throw new Error("方案修订失败（测试触发）");
  }

  const trimmed = input.instructions.trim();
  const slides = input.currentSlides.map((s) => ({
    ...s,
    bullets: [...s.bullets, `修订：${trimmed}`],
  }));

  return {
    title: input.currentTitle,
    slides,
    summary: [
      { label: `修改要求：${trimmed}` },
      { label: `结构：${input.currentSlides.length} 页（保持不变）` },
    ],
  };
}

/** 单页优化：仅重生成目标页，原位替换——不影响其余页面（uc-presentations-002 业务规则）。 */
export async function optimizePresentationPage(
  input: PresentationOptimizePageInput
): Promise<PresentationOptimizePageResult> {
  if (input.instructions.includes(PRESENTATION_REVISION_FORCE_FAIL_MARKER)) {
    throw new Error("单页优化失败（测试触发）");
  }

  const trimmed = input.instructions.trim();
  return {
    slide: {
      ...input.currentSlide,
      bullets: [...input.currentSlide.bullets, `优化：${trimmed}`],
    },
  };
}
