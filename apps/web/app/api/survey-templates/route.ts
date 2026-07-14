import { NextResponse } from "next/server";
import {
  createSurveyTemplate,
  getMembership,
  isBlank,
  listVisibleSurveyTemplates,
  type NewQuestionInput,
  type QuestionType,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUESTION_TYPES: QuestionType[] = [
  "short_text",
  "text",
  "email",
  "number",
  "phone",
  "single",
  "multiple",
  "dropdown",
  "rating",
  "linear_scale",
  "nps",
  "date",
  "time",
  "file",
];

type TemplateCategory =
  | "user_information"
  | "satisfaction"
  | "market_research"
  | "product_safety"
  | "event_feedback"
  | "employee_feedback"
  | "education_feedback"
  | "nps_loyalty";

type QuestionCategory =
  | "user_info"
  | "behavior"
  | "preference"
  | "satisfaction"
  | "safety"
  | "pricing"
  | "open_feedback"
  | "demographics";

interface ReportTemplate {
  title: string;
  sections: string[];
  metrics: string[];
  chartSlots: string[];
  caveats: string[];
}

interface BuiltInTemplateQuestion extends NewQuestionInput {
  category: QuestionCategory;
}

interface BuiltInTemplate {
  id: string;
  source: "built_in";
  name: string;
  category: TemplateCategory;
  title: string;
  description: string;
  estimatedMinutes: number;
  questions: BuiltInTemplateQuestion[];
  reportTemplate: ReportTemplate;
}

interface TemplateQuestionInput extends NewQuestionInput {
  category?: QuestionCategory;
}

const DEFAULT_REPORT_SECTIONS = ["样本概览", "关键发现", "开放反馈", "行动建议"];

const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: "product-safety-research",
    source: "built_in",
    name: "商品安全市场调研",
    category: "product_safety",
    title: "商品安全市场调研问卷",
    description: "用于了解目标用户对商品安全、风险感知、购买顾虑和信任因素的反馈。",
    estimatedMinutes: 4,
    questions: [
      { title: "你的年龄段是？", type: "single", required: true, category: "demographics", options: ["18岁以下", "18-24岁", "25-34岁", "35-44岁", "45岁及以上"] },
      { title: "你是否购买过此类商品？", type: "single", required: true, category: "behavior", options: ["经常购买", "偶尔购买", "了解但未购买", "不了解"] },
      { title: "你最关注哪些安全信息？", type: "multiple", required: true, category: "safety", options: ["成分/材质", "认证标准", "生产日期", "品牌信誉", "用户评价"] },
      { title: "你认为该类商品的主要安全风险是什么？", type: "text", required: false, category: "safety", options: [] },
      { title: "安全认证会如何影响你的购买决策？", type: "single", required: true, category: "preference", options: ["显著提升购买意愿", "有一定影响", "影响较小", "不会影响"] },
      { title: "你愿意为更高安全标准支付多少溢价？", type: "single", required: true, category: "pricing", options: ["不愿溢价", "5%以内", "5%-10%", "10%以上"] },
      { title: "你对当前市场上同类商品安全性的整体信任程度是？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "还有哪些安全信息希望商家主动披露？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "商品安全市场调研报告",
      sections: ["样本概览", "安全关注点", "风险感知", "购买信任因素", "价格溢价意愿", "行动建议"],
      metrics: ["response_count", "safety_concern_distribution", "trust_rating_average", "pricing_premium_distribution"],
      chartSlots: ["安全关注点条形图", "信任评分分布", "溢价意愿分布"],
      caveats: ["样本量低于30时仅输出方向性判断", "未覆盖真实购买数据时需标注自陈偏差"],
    },
  },
  {
    id: "product-feedback",
    source: "built_in",
    name: "商品反馈问卷",
    category: "satisfaction",
    title: "商品反馈问卷",
    description: "用于了解用户对新品包装、价格、整体体验和复购意愿的反馈。",
    estimatedMinutes: 3,
    questions: [
      { title: "您之前是否使用过同类商品？", type: "single", required: true, category: "behavior", options: ["经常使用", "偶尔使用", "第一次使用"] },
      { title: "您购买或试用这款新品的主要原因是什么？", type: "multiple", required: true, category: "preference", options: ["功能吸引", "价格合适", "朋友推荐", "品牌信任"] },
      { title: "您对新品外观和包装的满意度是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "您对新品价格的接受程度如何？", type: "single", required: true, category: "pricing", options: ["非常合理", "基本合理", "偏贵", "无法接受"] },
      { title: "您对新品整体体验的评分是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "您愿意再次购买的可能性是多少？", type: "nps", required: true, category: "preference", options: [] },
      { title: "还有哪些建议希望告诉我们？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "商品反馈分析报告",
      sections: ["样本概览", "体验满意度", "价格接受度", "复购意愿", "改进建议"],
      metrics: ["response_count", "satisfaction_average", "nps_score", "pricing_acceptance_distribution"],
      chartSlots: ["满意度评分分布", "价格接受度饼图", "NPS分布"],
      caveats: ["样本来自试用用户时需标注体验场景偏差"],
    },
  },
  {
    id: "user-profile",
    source: "built_in",
    name: "用户信息收集",
    category: "user_information",
    title: "用户信息收集问卷",
    description: "用于收集基础画像、联系方式、使用场景和后续访谈意愿。",
    estimatedMinutes: 3,
    questions: [
      { title: "你的姓名或称呼是？", type: "short_text", required: true, category: "user_info", options: [] },
      { title: "你的邮箱是？", type: "email", required: true, category: "user_info", options: [] },
      { title: "你的年龄段是？", type: "single", required: false, category: "demographics", options: ["18岁以下", "18-24岁", "25-34岁", "35-44岁", "45岁及以上"] },
      { title: "你所在的行业是？", type: "short_text", required: false, category: "demographics", options: [] },
      { title: "你通常在什么场景下使用我们的产品？", type: "multiple", required: true, category: "behavior", options: ["工作", "学习", "个人项目", "团队协作", "其他"] },
      { title: "你希望我们后续联系你做访谈吗？", type: "single", required: true, category: "preference", options: ["愿意", "暂不需要"] },
    ],
    reportTemplate: {
      title: "用户信息分析报告",
      sections: DEFAULT_REPORT_SECTIONS,
      metrics: ["response_count", "profile_completion_rate", "contact_opt_in_rate"],
      chartSlots: ["年龄段分布", "使用场景分布"],
      caveats: ["联系方式仅用于用户授权的后续研究。"],
    },
  },
  {
    id: "market-demand-research",
    source: "built_in",
    name: "市场需求调研",
    category: "market_research",
    title: "市场需求调研问卷",
    description: "用于验证目标市场痛点、替代方案、预算和购买触发因素。",
    estimatedMinutes: 5,
    questions: [
      { title: "你目前如何解决这个问题？", type: "multiple", required: true, category: "behavior", options: ["人工处理", "使用竞品", "内部工具", "暂未解决"] },
      { title: "这个问题出现的频率是？", type: "single", required: true, category: "behavior", options: ["每天", "每周", "每月", "偶尔"] },
      { title: "你认为现有方案最大的不足是什么？", type: "text", required: false, category: "open_feedback", options: [] },
      { title: "选择新方案时最重要的因素有哪些？", type: "multiple", required: true, category: "preference", options: ["价格", "易用性", "安全性", "集成能力", "服务支持"] },
      { title: "你的可接受预算区间是？", type: "single", required: true, category: "pricing", options: ["免费", "低于100元/月", "100-500元/月", "500元/月以上"] },
      { title: "如果有合适方案，你的采购紧迫度是？", type: "rating", required: true, category: "preference", options: [] },
      { title: "你希望方案必须满足哪些条件？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "市场需求调研报告",
      sections: ["样本概览", "痛点频率", "替代方案", "购买因素", "预算区间", "机会判断"],
      metrics: ["response_count", "problem_frequency_distribution", "budget_distribution", "purchase_urgency_average"],
      chartSlots: ["现有方案分布", "选择因素条形图", "预算区间分布"],
      caveats: ["预算答案为自陈数据，需结合真实转化验证。"],
    },
  },
  {
    id: "event-feedback",
    source: "built_in",
    name: "活动反馈问卷",
    category: "event_feedback",
    title: "活动反馈问卷",
    description: "用于活动结束后评估内容、组织、讲师和参会者后续意向。",
    estimatedMinutes: 3,
    questions: [
      { title: "你参加的是哪一场活动？", type: "short_text", required: true, category: "user_info", options: [] },
      { title: "你对活动整体满意度是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "你最有收获的环节是？", type: "multiple", required: true, category: "preference", options: ["主题分享", "圆桌讨论", "互动问答", "社交交流", "资料包"] },
      { title: "活动时间和节奏是否合适？", type: "single", required: true, category: "satisfaction", options: ["非常合适", "基本合适", "偏紧", "偏松"] },
      { title: "你会向朋友推荐类似活动吗？", type: "nps", required: true, category: "preference", options: [] },
      { title: "下次你希望看到哪些主题？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "活动反馈分析报告",
      sections: ["样本概览", "整体满意度", "内容偏好", "组织体验", "推荐意愿", "下次主题建议"],
      metrics: ["response_count", "satisfaction_average", "nps_score", "preferred_session_distribution"],
      chartSlots: ["满意度分布", "收获环节排行", "推荐意愿分布"],
      caveats: ["活动现场填写可能存在即时情绪偏差。"],
    },
  },
  {
    id: "employee-pulse",
    source: "built_in",
    name: "员工脉搏反馈",
    category: "employee_feedback",
    title: "员工脉搏反馈问卷",
    description: "用于快速了解团队工作状态、协作体验、压力和支持需求。",
    estimatedMinutes: 4,
    questions: [
      { title: "你所在的团队或职能是？", type: "short_text", required: false, category: "demographics", options: [] },
      { title: "你对当前工作负荷的感受是？", type: "single", required: true, category: "satisfaction", options: ["偏低", "适中", "偏高", "明显过载"] },
      { title: "你本周完成关键工作的信心是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "当前阻碍你工作的主要因素有哪些？", type: "multiple", required: false, category: "behavior", options: ["需求不清", "依赖等待", "会议过多", "工具问题", "资源不足"] },
      { title: "你对团队协作氛围的评分是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "你希望管理者提供哪些支持？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "员工脉搏反馈报告",
      sections: ["样本概览", "工作负荷", "交付信心", "协作阻碍", "支持需求", "管理建议"],
      metrics: ["response_count", "workload_distribution", "confidence_average", "collaboration_average"],
      chartSlots: ["工作负荷分布", "阻碍因素排行", "协作评分趋势"],
      caveats: ["匿名反馈需避免反推个人身份。"],
    },
  },
  {
    id: "course-feedback",
    source: "built_in",
    name: "课程反馈问卷",
    category: "education_feedback",
    title: "课程反馈问卷",
    description: "用于评估课程内容、讲师表现、难度、节奏和学习效果。",
    estimatedMinutes: 4,
    questions: [
      { title: "你参加的课程名称是？", type: "short_text", required: true, category: "user_info", options: [] },
      { title: "课程内容与你的预期匹配程度是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "课程难度对你来说如何？", type: "single", required: true, category: "preference", options: ["太简单", "适中", "偏难", "太难"] },
      { title: "你最喜欢哪些学习形式？", type: "multiple", required: true, category: "preference", options: ["讲解", "案例", "练习", "讨论", "测验"] },
      { title: "讲师表达和答疑的满意度是多少？", type: "rating", required: true, category: "satisfaction", options: [] },
      { title: "你学完后最想继续了解什么？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "课程反馈分析报告",
      sections: ["样本概览", "内容匹配", "难度节奏", "教学满意度", "学习偏好", "课程迭代建议"],
      metrics: ["response_count", "content_match_average", "instructor_rating_average", "difficulty_distribution"],
      chartSlots: ["内容评分分布", "难度分布", "学习形式偏好"],
      caveats: ["学习效果需结合课后测验或行为数据验证。"],
    },
  },
  {
    id: "nps-loyalty",
    source: "built_in",
    name: "NPS 忠诚度调研",
    category: "nps_loyalty",
    title: "NPS 忠诚度调研问卷",
    description: "用于衡量推荐意愿、流失风险、满意驱动因素和客户留存机会。",
    estimatedMinutes: 3,
    questions: [
      { title: "你使用我们的产品多久了？", type: "single", required: true, category: "behavior", options: ["少于1个月", "1-6个月", "6-12个月", "1年以上"] },
      { title: "你向朋友或同事推荐我们的可能性是多少？", type: "nps", required: true, category: "preference", options: [] },
      { title: "你给出这个评分的主要原因是什么？", type: "text", required: false, category: "open_feedback", options: [] },
      { title: "你最满意的方面有哪些？", type: "multiple", required: true, category: "satisfaction", options: ["功能", "性能", "价格", "服务", "易用性"] },
      { title: "哪些问题最可能让你停止使用？", type: "multiple", required: false, category: "behavior", options: ["价格上涨", "稳定性", "缺少功能", "支持不足", "替代方案更好"] },
      { title: "你希望我们优先改进什么？", type: "text", required: false, category: "open_feedback", options: [] },
    ],
    reportTemplate: {
      title: "NPS 忠诚度分析报告",
      sections: ["样本概览", "NPS分层", "推荐原因", "满意驱动", "流失风险", "留存行动"],
      metrics: ["response_count", "nps_score", "promoter_ratio", "detractor_ratio"],
      chartSlots: ["NPS分布", "满意因素排行", "流失风险因素"],
      caveats: ["NPS为态度指标，需结合续费或活跃数据判断。"],
    },
  },
];

function defaultReportTemplate(title: string): ReportTemplate {
  return {
    title: `${title} 分析报告`,
    sections: DEFAULT_REPORT_SECTIONS,
    metrics: ["response_count"],
    chartSlots: ["题目分布图"],
    caveats: ["保存模板未配置专用报告模板，使用默认分析框架。"],
  };
}

function parseQuestionCategory(value: unknown): QuestionCategory | undefined {
  const categories: QuestionCategory[] = [
    "user_info",
    "behavior",
    "preference",
    "satisfaction",
    "safety",
    "pricing",
    "open_feedback",
    "demographics",
  ];
  return categories.includes(value as QuestionCategory) ? (value as QuestionCategory) : undefined;
}

function parseQuestions(raw: unknown): TemplateQuestionInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const q = (item ?? {}) as Record<string, unknown>;
    const title = String(q.title ?? "").trim();
    if (isBlank(title)) return [];
    const type = QUESTION_TYPES.includes(q.type as QuestionType) ? (q.type as QuestionType) : "text";
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
    const category = parseQuestionCategory(q.category);
    return [{ title, type, required: q.required === true, options, ...(category ? { category } : {}) }];
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const saved = (await listVisibleSurveyTemplates(user.id)).filter((template) => !template.builtin);
  return NextResponse.json({
    templates: [
      ...BUILT_IN_TEMPLATES,
      ...saved.map((template) => ({
        id: String(template.id),
        source: "saved",
        name: template.title,
        category: "user_information",
        title: template.title,
        description: template.description,
        estimatedMinutes: Math.max(1, Math.ceil(template.questions.length / 4)),
        questions: template.questions,
        reportTemplate: defaultReportTemplate(template.title),
      })),
    ],
  });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const questions = parseQuestions(body.questions);
    if (isBlank(title)) return NextResponse.json({ errors: { title: "模板标题不能为空" } }, { status: 400 });
    if (questions.length === 0) return NextResponse.json({ errors: { questions: "模板至少需要一道题" } }, { status: 400 });

    const teamId = currentTeamId();
    if (teamId == null || !(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "保存团队模板需要有效团队上下文" }, { status: 403 });
    }
    const template = await createSurveyTemplate({
      ownerId: user.id,
      teamId,
      title,
      description: String(body.description ?? "").trim(),
      questions,
    });

    return NextResponse.json({
      template: {
        id: String(template.id),
        source: "saved",
        name: String(body.name ?? template.title).trim() || template.title,
        category: "user_information",
        title: template.title,
        description: template.description,
        estimatedMinutes: Math.max(1, Math.ceil(template.questions.length / 4)),
        questions: template.questions,
        reportTemplate: defaultReportTemplate(template.title),
      },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
