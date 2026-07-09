// packages/ai/src/researchGenerator.ts — Deep Research 真实生成（P18 F04）
//
// 替换此前 apps/web 里硬编码的 buildResearch()：不再返回固定文案，而是把研究主题/受众
// 组装成一个要求"仅输出 JSON"的提示词，交给 CAP-AI 网关（stub: 或 anthropic:，与聊天
// 消息同一条真实路径，见 gateway.ts / anthropicProvider.ts）生成，再解析成结构化结果。
//
// 之所以不新建一个 provider：网关契约本身就是"逐 token 生成文本"，研究生成只是给它一个
// 不同的提示词、把返回文本当 JSON 解析——复用 defaultGateway.streamChat 而不是另起一套
// 模型接入。stub provider（见 gateway.ts 的 RESEARCH_JSON_SYSTEM_MARKER 分支）据此在
// 无供应商额度环境下也能产出"不同主题产出不同内容"的确定性 JSON，供 e2e 在
// mock-provider 模式下验证。
// RESEARCH_FORCE_FAIL_MARKER 已从 gateway.ts 经 index.ts 的 `export * from "./gateway"` 对外可见，
// 这里只导入使用，不重复 re-export（避免 packages/ai/src/index.ts 里两个 `export *` 撞名）。
import { RESEARCH_FORCE_FAIL_MARKER, RESEARCH_JSON_SYSTEM_MARKER, type StreamChatInput } from "./gateway";

export interface ResearchPhase {
  name: string;
  tasks: string[];
}
export interface ResearchTimelineItem {
  phase: string;
  task: string;
  status: "queued" | "running" | "complete";
}
// p18-F05：报告双模板。researchType 是判别字段——"market" 展示 Executive summary /
// Key findings / Recommendation；"user-research" 展示 Summary / Personas / Top pain
// points / Opportunities。两套类型专属字段互斥存在（market 报告没有 personas 等，反之
// 亦然），title/conclusion 通用（conclusion 语义随类型分别对应 Executive summary 或
// Summary），sections 保留作为两种类型共享的兜底展示（对应"次要细节"，不是主字段）。
export type ResearchType = "market" | "user-research";
export interface ResearchReport {
  researchType: ResearchType;
  title: string;
  conclusion: string;
  sections: Array<{ heading: string; bullets: string[] }>;
  // market 专属
  keyFindings?: string[];
  recommendation?: string;
  // user-research 专属
  personas?: string[];
  topPainPoints?: string[];
  opportunities?: string[];
}
export interface ResearchPayload {
  clarifyingQuestions: string[];
  plan: {
    audience: string;
    phases: ResearchPhase[];
  };
  timeline: ResearchTimelineItem[];
  report: ResearchReport;
}

const RESEARCH_JSON_SYSTEM_PROMPT = [
  RESEARCH_JSON_SYSTEM_MARKER,
  "You are AVA's Deep Research planning engine.",
  "Given a research topic and target audience, respond with ONLY a single JSON object",
  "(no markdown fences, no prose before/after) matching exactly this shape:",
  "{",
  '  "clarifyingQuestions": string[3],',
  '  "plan": { "audience": string, "phases": [{ "name": string, "tasks": string[3] }, ...] } (exactly 3 phases),',
  '  "report": {',
  '    "researchType": "market" | "user-research" (pick whichever best fits the TOPIC itself —',
  "    the audience string is a fixed generic label and should not influence this choice),",
  '    "title": string,',
  '    "conclusion": string (Executive summary if researchType is "market", Summary if "user-research"),',
  '    "sections": [{ "heading": string, "bullets": string[3] }, ...] (exactly 2 sections),',
  '    // when researchType is "market", also include:',
  '    "keyFindings": string[3],',
  '    "recommendation": string,',
  '    // when researchType is "user-research", also include instead:',
  '    "personas": string[3],',
  '    "topPainPoints": string[3],',
  '    "opportunities": string[3]',
  "  }",
  "}",
  "Every field must be specific to the given topic and audience — do not use generic filler text.",
].join("\n");

function buildTimeline(phases: ResearchPhase[]): ResearchTimelineItem[] {
  const stageNames = ["Clarification", "Planning", "Execution", "Report"];
  return stageNames.map((phase, index) => ({
    phase,
    task:
      index === 0
        ? "Scope topic and audience"
        : index === 1
          ? "Create phased research plan"
          : index === 2
            ? (phases[0]?.tasks?.[0] ?? "Run research phases")
            : "Prepare structured findings",
    status: "queued" as const,
  }));
}

/** 从模型输出中提取 JSON——真实模型即便被要求"只输出 JSON"，也可能包裹在
 *  ```json fenced code block 或前后夹带说明文字里，这里做宽松提取而不是严格 JSON.parse。 */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("研究生成结果不是有效 JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.filter(isNonEmptyString).length > 0;
}

/** 关键词启发式：模型省略/输出非法 researchType 时的兜底判定，不依赖模型必须听话。
 *  "user"/"persona"/"customer"/"用户"/"访谈" 等词面向研究对象是人；否则默认按市场类处理
 *  （历史上报告模板本就是市场类的泛化写法，默认落回它风险最低）。
 *  只看 topic，不看 audience——前端 composer 目前对所有研究请求都发送同一句固定的
 *  audience 文案（"Product leaders and user research stakeholders"，见 apps/web/app/(app)/
 *  ava/page.tsx 的 RESEARCH_AUDIENCE 常量），这句话本身就含有 "user research" 四个字，
 *  一旦把 audience 也纳入判定，所有研究请求都会被误判成 user-research，market 模板永远
 *  测不到——这是本 feature 联调时发现的真实坑，不是假设性风险。 */
function inferResearchType(topic: string): ResearchType {
  const haystack = topic.toLowerCase();
  const userResearchHints = [
    "user research",
    "persona",
    "user interview",
    "customer interview",
    "pain point",
    "usability",
    "用户研究",
    "用户访谈",
    "用户画像",
  ];
  return userResearchHints.some((hint) => haystack.includes(hint)) ? "user-research" : "market";
}

/** 校验并归一化模型输出的 shape；不满足最低要求（分节/问题数组）时抛错，
 *  由调用方（route.ts）落成研究失败态，而不是把畸形数据透传给前端渲染。
 *  p18-F14：explicitType 是用户在 composer 研究类型选单里显式选中的类型（深度研究 →
 *  market / 用户研究 → user-research），优先级最高——模型输出什么都不能覆盖用户的
 *  显式选择；仅当无显式类型（历史会话/老客户端请求）时才回退到模型输出 + 关键词推断。 */
function normalizeResearchJson(
  raw: unknown,
  topic: string,
  audience: string,
  explicitType?: ResearchType
): ResearchPayload {
  if (!raw || typeof raw !== "object") throw new Error("研究生成结果缺少必需字段");
  const v = raw as Record<string, unknown>;

  const clarifyingQuestions = Array.isArray(v.clarifyingQuestions)
    ? v.clarifyingQuestions.filter(isNonEmptyString)
    : [];
  if (clarifyingQuestions.length === 0) throw new Error("研究生成结果缺少澄清问题");

  const planRaw = v.plan as Record<string, unknown> | undefined;
  const phasesRaw = Array.isArray(planRaw?.phases) ? (planRaw!.phases as unknown[]) : [];
  const phases: ResearchPhase[] = phasesRaw
    .map((p) => {
      if (!p || typeof p !== "object") return null;
      const pr = p as Record<string, unknown>;
      if (!isNonEmptyString(pr.name)) return null;
      const tasks = Array.isArray(pr.tasks) ? pr.tasks.filter(isNonEmptyString) : [];
      if (tasks.length === 0) return null;
      return { name: pr.name, tasks };
    })
    .filter((p): p is ResearchPhase => p !== null);
  if (phases.length === 0) throw new Error("研究生成结果缺少研究计划阶段");

  const reportRaw = v.report as Record<string, unknown> | undefined;
  if (!reportRaw || !isNonEmptyString(reportRaw.title) || !isNonEmptyString(reportRaw.conclusion)) {
    throw new Error("研究生成结果缺少报告内容");
  }
  const sectionsRaw = Array.isArray(reportRaw.sections) ? (reportRaw.sections as unknown[]) : [];
  const sections = sectionsRaw
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const sr = s as Record<string, unknown>;
      if (!isNonEmptyString(sr.heading)) return null;
      const bullets = Array.isArray(sr.bullets) ? sr.bullets.filter(isNonEmptyString) : [];
      if (bullets.length === 0) return null;
      return { heading: sr.heading, bullets };
    })
    .filter((s): s is { heading: string; bullets: string[] } => s !== null);
  if (sections.length === 0) throw new Error("研究生成结果缺少报告分节");

  const planAudience = isNonEmptyString(planRaw?.audience) ? (planRaw!.audience as string) : audience;

  // p18-F05：researchType 决定报告用哪套模板字段。模型输出非法/缺失时按关键词兜底判定，
  // 而不是直接报错——报告模板选择不应该因为模型少输出一个字段就让整个研究失败。
  // p18-F14：用户显式选择的类型（explicitType）优先于模型输出与关键词推断。
  const researchType: ResearchType =
    explicitType ??
    (reportRaw.researchType === "market" || reportRaw.researchType === "user-research"
      ? reportRaw.researchType
      : inferResearchType(topic));

  const report: ResearchReport = {
    researchType,
    title: reportRaw.title as string,
    conclusion: reportRaw.conclusion as string,
    sections,
  };
  if (researchType === "market") {
    report.keyFindings = isStringArray(reportRaw.keyFindings)
      ? (reportRaw.keyFindings as string[]).filter(isNonEmptyString)
      : sections[0]?.bullets ?? [];
    report.recommendation = isNonEmptyString(reportRaw.recommendation)
      ? (reportRaw.recommendation as string)
      : (reportRaw.conclusion as string);
  } else {
    report.personas = isStringArray(reportRaw.personas)
      ? (reportRaw.personas as string[]).filter(isNonEmptyString)
      : [`${planAudience} — primary persona derived from "${topic}"`];
    report.topPainPoints = isStringArray(reportRaw.topPainPoints)
      ? (reportRaw.topPainPoints as string[]).filter(isNonEmptyString)
      : sections[0]?.bullets ?? [];
    report.opportunities = isStringArray(reportRaw.opportunities)
      ? (reportRaw.opportunities as string[]).filter(isNonEmptyString)
      : sections[1]?.bullets ?? sections[0]?.bullets ?? [];
  }

  return {
    clarifyingQuestions,
    plan: { audience: planAudience, phases },
    timeline: buildTimeline(phases),
    report,
  };
}

/** 调用网关生成研究内容（真实 provider 或 stub，取决于 modelId 前缀）。
 *  失败（provider 抛错 / JSON 解析或 shape 校验失败）时原样向上抛出，
 *  调用方（route.ts）负责落成研究的失败态，不吞掉错误细节（服务端日志留痕）。 */
export async function generateResearch(input: {
  topic: string;
  audience: string;
  modelId: string;
  gateway: { streamChat(input: StreamChatInput): AsyncGenerator<string, void, void> };
  /** p18-F14：用户在研究类型选单里显式选中的类型。给定时 prompt 会锁定该类型，
   *  且归一化阶段无条件以它为准（模型输出/关键词推断都不能覆盖显式选择）；
   *  缺省时保持 F05 行为：模型自选 + inferResearchType 关键词兜底（兼容历史会话）。 */
  researchType?: ResearchType;
}): Promise<ResearchPayload> {
  if (input.topic.includes(RESEARCH_FORCE_FAIL_MARKER)) {
    throw new Error("研究内容生成失败（测试触发）");
  }

  const userPrompt = [
    `Research topic: ${input.topic}`,
    `Target audience: ${input.audience}`,
    // p18-F14：显式类型随提示词下发。真实 provider 按指令锁定该类型；stub provider
    // （gateway.ts buildStubResearchJson）解析这一行，优先于 topic 关键词嗅探。
    ...(input.researchType
      ? [
          `Research type: ${input.researchType}`,
          `The user explicitly selected the research type. "researchType" in your JSON MUST be exactly "${input.researchType}" — do not infer it from the topic.`,
        ]
      : []),
  ].join("\n");

  let full = "";
  for await (const chunk of input.gateway.streamChat({
    modelId: input.modelId,
    messages: [
      { role: "system", content: RESEARCH_JSON_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  })) {
    full += chunk;
  }

  const parsed = extractJson(full);
  return normalizeResearchJson(parsed, input.topic, input.audience, input.researchType);
}
