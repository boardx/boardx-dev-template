import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  calculateSurveyReport,
  generateReportTemplate,
  type AnalysisRole,
  type QuestionOption,
  type QuestionType,
  type ReportTemplate,
  type Survey,
  type SurveyBundle,
  type SurveyQuestion,
  type SurveyResponse,
  type SurveySection,
  type SurveyCategory,
  type GeneratedSurveyReport,
} from "./survey-engine";

export interface SurveyShareLink {
  id: string;
  surveyId: string;
  token: string;
  url: string;
  status: "active" | "disabled" | "expired";
  expiresAt?: string;
  maxResponses?: number;
  createdAt: string;
}

export interface SurveyRecord extends SurveyBundle {
  shareLinks: SurveyShareLink[];
  responses: SurveyResponse[];
  reportTemplate?: ReportTemplate;
  reports: GeneratedSurveyReport[];
}

export interface SurveyStoreState {
  surveys: SurveyRecord[];
}

export interface SurveyStore {
  read(): Promise<SurveyStoreState>;
  write(state: SurveyStoreState): Promise<void>;
}

export interface CreateSurveyInput {
  title: string;
  description?: string;
  category: SurveyCategory;
  businessGoal: string;
  targetAudience: string;
  templateId?: string;
}

export interface AddQuestionInput {
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: Array<Omit<QuestionOption, "id"> & { id?: string }>;
  analysisRole?: AnalysisRole;
  dimensionKey?: string;
}

export interface SurveyTemplateSection {
  title: string;
  description: string;
  questions: AddQuestionInput[];
}

export interface SurveyTemplateDefinition {
  id: string;
  title: string;
  description: string;
  category: SurveyCategory;
  businessGoal: string;
  targetAudience: string;
  estimatedMinutes: string;
  tags: string[];
  sections: SurveyTemplateSection[];
}

export interface SubmitSurveyResponseInput {
  durationSeconds?: number;
  metadata?: SurveyResponse["metadata"];
  answers: SurveyResponse["answers"];
}

export const surveyTemplates: SurveyTemplateDefinition[] = [
  {
    id: "business_digital_diagnosis",
    title: "企业数字化转型诊断",
    description: "评估数字化成熟度、关键阻碍和未来投入方向，适合企业咨询和管理层复盘。",
    category: "business_diagnosis",
    businessGoal: "评估企业数字化成熟度，识别关键阻碍，并输出咨询式行动建议。",
    targetAudience: "企业负责人、业务负责人、IT 管理者与数字化转型相关岗位。",
    estimatedMinutes: "8-10分钟",
    tags: ["数字化", "成熟度", "咨询诊断"],
    sections: [
      {
        title: "第一部分：企业基本信息",
        description: "用于识别受访企业画像和分群维度",
        questions: [
          {
            type: "industry_selector",
            title: "您所在企业的行业是？",
            required: true,
            options: industryOptions(),
            analysisRole: "profile",
          },
          {
            type: "company_size",
            title: "您所在企业的员工规模是？",
            required: true,
            options: companySizeOptions(),
            analysisRole: "segment",
          },
        ],
      },
      {
        title: "第二部分：数字化现状评估",
        description: "围绕战略、流程、数据、系统与组织能力评估成熟度",
        questions: [
          dimensionQuestion("企业是否已形成清晰的数字化转型战略？", "digital_strategy"),
          dimensionQuestion("核心业务流程的线上化和自动化程度如何？", "process_digitization"),
          dimensionQuestion("企业数据采集、治理和分析应用能力如何？", "data_capability"),
          dimensionQuestion("现有系统是否能支撑跨部门协同和经营决策？", "system_integration"),
        ],
      },
      {
        title: "第三部分：挑战与优先级",
        description: "收集转型阻碍、投入计划和开放反馈",
        questions: [
          {
            type: "single_choice",
            title: "当前数字化转型面临的主要阻碍是什么？",
            required: true,
            options: [
              { label: "战略目标不清晰", value: "strategy_unclear" },
              { label: "数据基础薄弱", value: "data_weak" },
              { label: "系统割裂严重", value: "system_silo" },
              { label: "人才和组织能力不足", value: "talent_gap" },
              { label: "预算投入有限", value: "budget_limit" },
            ],
            analysisRole: "metric",
          },
          {
            type: "single_choice",
            title: "未来 12 个月最希望优先推进的数字化方向是？",
            required: true,
            options: [
              { label: "客户体验与营销增长", value: "customer_growth" },
              { label: "业务流程自动化", value: "automation" },
              { label: "数据分析与经营看板", value: "analytics" },
              { label: "供应链和生产协同", value: "operation_collaboration" },
              { label: "AI 应用与智能决策", value: "ai_decision" },
            ],
            analysisRole: "metric",
          },
          openQuestion("请补充说明企业数字化转型中最需要解决的问题。"),
        ],
      },
    ],
  },
  {
    id: "customer_satisfaction_nps",
    title: "客户满意度与 NPS 调研",
    description: "跟踪客户体验、推荐意愿、服务短板和续约风险。",
    category: "customer_satisfaction",
    businessGoal: "识别客户体验短板，提升满意度、复购率和推荐意愿。",
    targetAudience: "最近 90 天内完成购买、使用或服务触达的客户。",
    estimatedMinutes: "5-7分钟",
    tags: ["客户体验", "NPS", "服务优化"],
    sections: [
      {
        title: "第一部分：客户画像",
        description: "识别客户类型与触达渠道",
        questions: [
          {
            type: "single_choice",
            title: "您属于哪类客户？",
            required: true,
            options: [
              { label: "个人用户", value: "individual" },
              { label: "中小企业客户", value: "smb" },
              { label: "大型企业客户", value: "enterprise" },
              { label: "渠道/合作伙伴", value: "partner" },
            ],
            analysisRole: "profile",
          },
          {
            type: "single_choice",
            title: "您最近一次接触我们的主要场景是？",
            required: true,
            options: [
              { label: "购买咨询", value: "sales" },
              { label: "产品使用", value: "product" },
              { label: "售后服务", value: "support" },
              { label: "续约/增购", value: "renewal" },
            ],
            analysisRole: "segment",
          },
        ],
      },
      {
        title: "第二部分：体验评价",
        description: "评估客户满意度和推荐意愿",
        questions: [
          dimensionQuestion("您对整体服务体验的满意度如何？", "customer_experience"),
          dimensionQuestion("产品或服务是否满足您的核心需求？", "value_fit"),
          {
            type: "nps",
            title: "您向朋友或同事推荐我们的可能性有多大？",
            required: true,
            options: npsOptions(),
            analysisRole: "dimension",
            dimensionKey: "loyalty",
          },
          {
            type: "single_choice",
            title: "最需要优先改进的体验环节是？",
            required: true,
            options: [
              { label: "响应速度", value: "response_speed" },
              { label: "服务专业度", value: "professionalism" },
              { label: "产品稳定性", value: "stability" },
              { label: "价格与价值匹配", value: "price_value" },
              { label: "问题闭环", value: "issue_closure" },
            ],
            analysisRole: "metric",
          },
          openQuestion("请描述一次让您印象最深的体验或改进建议。"),
        ],
      },
    ],
  },
  {
    id: "employee_engagement_health",
    title: "员工敬业度与组织健康",
    description: "了解员工投入度、团队协同、管理支持和留任风险。",
    category: "employee_engagement",
    businessGoal: "识别组织健康短板，提升员工敬业度、协同效率和留任意愿。",
    targetAudience: "全体员工、核心团队或特定部门成员。",
    estimatedMinutes: "6-8分钟",
    tags: ["员工体验", "组织健康", "人才管理"],
    sections: [
      {
        title: "第一部分：员工画像",
        description: "识别部门、职级和任职阶段",
        questions: [
          {
            type: "role_selector",
            title: "您的岗位类型是？",
            required: true,
            options: [
              { label: "业务/销售", value: "business" },
              { label: "产品/研发", value: "product_rd" },
              { label: "运营/交付", value: "operation" },
              { label: "职能支持", value: "function" },
              { label: "管理者", value: "manager" },
            ],
            analysisRole: "profile",
          },
          {
            type: "single_choice",
            title: "您在公司的工作年限是？",
            required: true,
            options: [
              { label: "1年以内", value: "under_1" },
              { label: "1-3年", value: "1_3" },
              { label: "3-5年", value: "3_5" },
              { label: "5年以上", value: "over_5" },
            ],
            analysisRole: "segment",
          },
        ],
      },
      {
        title: "第二部分：组织体验",
        description: "评估敬业度、管理支持和协同机制",
        questions: [
          dimensionQuestion("我清楚理解团队目标和个人工作优先级。", "goal_alignment"),
          dimensionQuestion("直属管理者能提供及时有效的支持。", "manager_support"),
          dimensionQuestion("跨部门协作过程顺畅且责任清晰。", "collaboration"),
          dimensionQuestion("我愿意继续在公司长期发展。", "retention_intent"),
          {
            type: "single_choice",
            title: "当前最影响工作投入度的因素是？",
            required: true,
            options: [
              { label: "目标变化频繁", value: "goal_change" },
              { label: "资源不足", value: "resource_gap" },
              { label: "协同成本高", value: "collaboration_cost" },
              { label: "成长机会不足", value: "growth_gap" },
              { label: "激励与贡献不匹配", value: "reward_gap" },
            ],
            analysisRole: "metric",
          },
          openQuestion("您希望组织或团队优先改善什么？"),
        ],
      },
    ],
  },
  {
    id: "product_feedback_priority",
    title: "产品体验与功能优先级",
    description: "收集用户使用场景、满意度、痛点和功能路线图优先级。",
    category: "product_feedback",
    businessGoal: "识别产品体验问题和高价值功能机会，支持路线图优先级决策。",
    targetAudience: "现有用户、试用用户、目标客户或内部使用者。",
    estimatedMinutes: "5-7分钟",
    tags: ["产品反馈", "功能优先级", "用户体验"],
    sections: [
      {
        title: "第一部分：使用画像",
        description: "了解用户角色和使用频率",
        questions: [
          {
            type: "role_selector",
            title: "您在使用产品时的主要角色是？",
            required: true,
            options: [
              { label: "决策者", value: "decision_maker" },
              { label: "管理员", value: "admin" },
              { label: "一线使用者", value: "user" },
              { label: "技术/实施人员", value: "technical" },
            ],
            analysisRole: "profile",
          },
          {
            type: "single_choice",
            title: "您的使用频率是？",
            required: true,
            options: [
              { label: "每天使用", value: "daily" },
              { label: "每周数次", value: "weekly" },
              { label: "每月数次", value: "monthly" },
              { label: "很少使用", value: "rarely" },
            ],
            analysisRole: "segment",
          },
        ],
      },
      {
        title: "第二部分：产品体验",
        description: "评估易用性、价值感和优先功能",
        questions: [
          dimensionQuestion("产品是否易于上手和持续使用？", "usability"),
          dimensionQuestion("当前产品是否有效提升了您的工作效率？", "productivity_value"),
          dimensionQuestion("产品性能和稳定性是否满足预期？", "stability"),
          {
            type: "single_choice",
            title: "下一步最希望增强的能力是？",
            required: true,
            options: [
              { label: "自动化流程", value: "automation" },
              { label: "数据分析报表", value: "analytics" },
              { label: "权限与协同", value: "permission_collab" },
              { label: "第三方集成", value: "integration" },
              { label: "AI 辅助能力", value: "ai" },
            ],
            analysisRole: "metric",
          },
          openQuestion("请描述一个最希望产品解决的具体问题。"),
        ],
      },
    ],
  },
  {
    id: "market_research_demand",
    title: "市场需求与竞品调研",
    description: "验证目标客户需求、购买预算、竞品选择和决策因素。",
    category: "market_research",
    businessGoal: "评估目标市场需求强度、购买意向和竞争格局，支持市场进入或增长策略。",
    targetAudience: "目标行业客户、潜在购买者、渠道伙伴或行业专家。",
    estimatedMinutes: "7-9分钟",
    tags: ["市场需求", "竞品", "购买意向"],
    sections: [
      {
        title: "第一部分：市场画像",
        description: "确认行业、规模和预算阶段",
        questions: [
          { type: "industry_selector", title: "贵公司所属行业是？", required: true, options: industryOptions(), analysisRole: "profile" },
          { type: "company_size", title: "贵公司员工规模是？", required: true, options: companySizeOptions(), analysisRole: "segment" },
          {
            type: "budget_range",
            title: "未来 12 个月相关预算范围是？",
            required: true,
            options: [
              { label: "暂未规划", value: "none", score: 1 },
              { label: "10万以内", value: "under_100k", score: 2 },
              { label: "10-50万", value: "100k_500k", score: 3 },
              { label: "50-200万", value: "500k_2m", score: 4 },
              { label: "200万以上", value: "over_2m", score: 5 },
            ],
            analysisRole: "dimension",
            dimensionKey: "market_readiness",
          },
        ],
      },
      {
        title: "第二部分：需求与决策",
        description: "识别采购意向和核心决策因素",
        questions: [
          dimensionQuestion("贵公司对该类解决方案的需求迫切程度如何？", "demand_urgency"),
          dimensionQuestion("当前内部是否已有明确采购或评估计划？", "purchase_readiness"),
          {
            type: "single_choice",
            title: "选择供应商时最看重的因素是？",
            required: true,
            options: [
              { label: "产品能力", value: "capability" },
              { label: "行业案例", value: "case" },
              { label: "价格", value: "price" },
              { label: "服务与交付", value: "delivery" },
              { label: "品牌可信度", value: "brand" },
            ],
            analysisRole: "metric",
          },
          openQuestion("目前您正在比较或使用哪些替代方案？"),
        ],
      },
    ],
  },
  {
    id: "brand_awareness_intent",
    title: "品牌认知与购买意向",
    description: "衡量品牌知名度、形象联想、信任度和购买转化机会。",
    category: "brand_research",
    businessGoal: "了解目标群体对品牌的认知、偏好和购买意向，支持品牌策略优化。",
    targetAudience: "潜在客户、目标消费者、现有客户或渠道伙伴。",
    estimatedMinutes: "5-7分钟",
    tags: ["品牌认知", "购买意向", "转化"],
    sections: [
      {
        title: "第一部分：受访者画像",
        description: "识别受访者与品牌的接触关系",
        questions: [
          {
            type: "single_choice",
            title: "您此前是否听说过我们的品牌？",
            required: true,
            options: [
              { label: "非常熟悉", value: "very_familiar", score: 5 },
              { label: "听说过并了解一些", value: "known", score: 4 },
              { label: "只听说过名字", value: "heard", score: 3 },
              { label: "没有听说过", value: "unknown", score: 1 },
            ],
            analysisRole: "dimension",
            dimensionKey: "brand_awareness",
          },
          {
            type: "single_choice",
            title: "您主要通过什么渠道了解相关品牌？",
            required: true,
            options: [
              { label: "朋友/同事推荐", value: "referral" },
              { label: "搜索/内容平台", value: "search_content" },
              { label: "社交媒体", value: "social" },
              { label: "线下活动", value: "offline" },
              { label: "销售/渠道触达", value: "sales_channel" },
            ],
            analysisRole: "profile",
          },
        ],
      },
      {
        title: "第二部分：品牌评价",
        description: "评估品牌信任、差异化和购买意向",
        questions: [
          dimensionQuestion("您认为该品牌值得信任。", "brand_trust"),
          dimensionQuestion("该品牌与竞品相比具备清晰差异化。", "brand_differentiation"),
          dimensionQuestion("未来 6 个月您考虑购买或推荐该品牌的可能性如何？", "purchase_intent"),
          {
            type: "single_choice",
            title: "阻碍您选择该品牌的主要原因是？",
            required: true,
            options: [
              { label: "了解不足", value: "low_awareness" },
              { label: "价格顾虑", value: "price_concern" },
              { label: "缺少案例或口碑", value: "case_gap" },
              { label: "竞品更熟悉", value: "competitor" },
              { label: "暂时没有需求", value: "no_need" },
            ],
            analysisRole: "metric",
          },
          openQuestion("提到该品牌，您最先想到的三个词是什么？"),
        ],
      },
    ],
  },
  {
    id: "event_feedback_review",
    title: "活动满意度与会后反馈",
    description: "评估活动内容、组织体验、线索质量和后续跟进意愿。",
    category: "event_feedback",
    businessGoal: "评估活动效果和参会体验，优化后续活动策划、转化和跟进。",
    targetAudience: "活动参会者、嘉宾、客户、合作伙伴或内部成员。",
    estimatedMinutes: "4-6分钟",
    tags: ["活动反馈", "会后复盘", "线索质量"],
    sections: [
      {
        title: "第一部分：参会画像",
        description: "了解参会身份和参与方式",
        questions: [
          {
            type: "single_choice",
            title: "您的参会身份是？",
            required: true,
            options: [
              { label: "潜在客户", value: "prospect" },
              { label: "现有客户", value: "customer" },
              { label: "合作伙伴", value: "partner" },
              { label: "媒体/嘉宾", value: "media_guest" },
              { label: "内部员工", value: "employee" },
            ],
            analysisRole: "profile",
          },
          {
            type: "single_choice",
            title: "您的参与方式是？",
            required: true,
            options: [
              { label: "线下全程参与", value: "offline_full" },
              { label: "线下部分参与", value: "offline_partial" },
              { label: "线上直播", value: "online_live" },
              { label: "观看回放", value: "replay" },
            ],
            analysisRole: "segment",
          },
        ],
      },
      {
        title: "第二部分：活动体验",
        description: "评估内容、组织和后续意向",
        questions: [
          dimensionQuestion("活动内容对您有实际价值。", "content_value"),
          dimensionQuestion("活动组织和现场体验符合预期。", "event_operation"),
          dimensionQuestion("您愿意参加我们后续类似活动。", "future_attendance"),
          {
            type: "single_choice",
            title: "最希望后续增加哪类内容？",
            required: true,
            options: [
              { label: "行业趋势", value: "trend" },
              { label: "客户案例", value: "case" },
              { label: "实操工作坊", value: "workshop" },
              { label: "专家问答", value: "qa" },
              { label: "商务交流", value: "networking" },
            ],
            analysisRole: "metric",
          },
          openQuestion("请留下您对本次活动的建议。"),
        ],
      },
    ],
  },
  {
    id: "custom_quick_feedback",
    title: "通用轻量反馈问卷",
    description: "适用于快速收集意见、满意度、优先级和开放建议。",
    category: "custom",
    businessGoal: "快速收集目标人群反馈，识别满意度、问题和下一步改进优先级。",
    targetAudience: "目标受访者、内部团队、客户或合作伙伴。",
    estimatedMinutes: "3-5分钟",
    tags: ["通用", "快速创建", "轻量反馈"],
    sections: [
      {
        title: "第一部分：基础信息",
        description: "用于基础分群和结果解读",
        questions: [
          {
            type: "single_choice",
            title: "您的身份或角色是？",
            required: true,
            options: [
              { label: "客户", value: "customer" },
              { label: "员工", value: "employee" },
              { label: "合作伙伴", value: "partner" },
              { label: "潜在用户", value: "prospect" },
            ],
            analysisRole: "profile",
          },
        ],
      },
      {
        title: "第二部分：反馈评价",
        description: "收集总体评价和优先改进方向",
        questions: [
          dimensionQuestion("您对当前体验的总体评价如何？", "overall_experience"),
          {
            type: "single_choice",
            title: "您认为最需要优先改进的是？",
            required: true,
            options: [
              { label: "流程效率", value: "efficiency" },
              { label: "服务质量", value: "service" },
              { label: "产品能力", value: "product" },
              { label: "沟通协同", value: "communication" },
              { label: "价格/成本", value: "cost" },
            ],
            analysisRole: "metric",
          },
          openQuestion("请补充您的具体建议。"),
        ],
      },
    ],
  },
];

export function listSurveyTemplates(): SurveyTemplateDefinition[] {
  return surveyTemplates;
}

export function getSurveyTemplate(templateId?: string): SurveyTemplateDefinition {
  return (
    surveyTemplates.find((template) => template.id === templateId) ??
    surveyTemplates.find((template) => template.id === "business_digital_diagnosis") ??
    surveyTemplates[0]!
  );
}

const defaultStorePath = join(process.cwd(), ".data", "survey-store.json");

let defaultStore: SurveyStore | undefined;
let seedSurveyPromise: Promise<SurveyRecord> | undefined;

export function getSurveyStore(): SurveyStore {
  defaultStore ??= createSurveyStore(defaultStorePath);
  return defaultStore;
}

export function createSurveyStore(filePath: string): SurveyStore {
  return {
    async read() {
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw) as SurveyStoreState;
        return { surveys: parsed.surveys ?? [] };
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return { surveys: [] };
        }

        throw error;
      }
    },
    async write(state) {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    },
  };
}

export async function listSurveys(store = getSurveyStore()): Promise<SurveyRecord[]> {
  return (await store.read()).surveys;
}

export async function listOrCreateInitialSurvey(
  store: SurveyStore,
  input: CreateSurveyInput
): Promise<SurveyRecord[]> {
  const surveys = await listSurveys(store);
  if (surveys.length > 0) {
    return surveys;
  }

  seedSurveyPromise ??= createSurvey(store, input).finally(() => {
    seedSurveyPromise = undefined;
  });
  return [await seedSurveyPromise];
}

export async function getSurvey(
  store: SurveyStore,
  surveyId: string
): Promise<SurveyRecord | undefined> {
  return (await store.read()).surveys.find((survey) => survey.survey.id === surveyId);
}

export async function getSurveyByToken(
  store: SurveyStore,
  token: string
): Promise<{ record: SurveyRecord; shareLink: SurveyShareLink } | undefined> {
  const state = await store.read();
  for (const record of state.surveys) {
    const shareLink = record.shareLinks.find((link) => link.token === token);
    if (shareLink) {
      return { record, shareLink };
    }
  }

  return undefined;
}

export async function createSurvey(
  store: SurveyStore,
  input: CreateSurveyInput
): Promise<SurveyRecord> {
  const now = new Date().toISOString();
  const surveyId = prefixedId("survey");
  const template = getSurveyTemplate(
    input.templateId ?? surveyTemplates.find((item) => item.category === input.category)?.id
  );
  const survey: Survey = {
    id: surveyId,
    workspaceId: "workspace_boardx",
    title: input.title.trim() || template.title,
    description: input.description ?? template.description,
    category: input.category ?? template.category,
    businessGoal: input.businessGoal.trim() || template.businessGoal,
    targetAudience: input.targetAudience.trim() || template.targetAudience,
    status: "draft",
    version: 1,
    createdBy: "local_user",
    createdAt: now,
    updatedAt: now,
  };
  const sections: SurveySection[] = template.sections.map((section, index) => ({
    id: prefixedId("section"),
    surveyId,
    title: section.title,
    description: section.description,
    order: index + 1,
  }));
  let questionOrder = 0;
  const questions: SurveyQuestion[] = template.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question) => {
      questionOrder += 1;
      return createQuestion(surveyId, sections[sectionIndex]!.id, questionOrder, question);
    })
  );

  const record: SurveyRecord = {
    survey,
    sections,
    questions,
    shareLinks: [],
    responses: [],
    reports: [],
  };

  await mutateSurveyState(store, (state) => {
    state.surveys.unshift(record);
  });

  return record;
}

export async function updateSurvey(
  store: SurveyStore,
  surveyId: string,
  patch: Partial<Pick<Survey, "title" | "description" | "businessGoal" | "targetAudience" | "category">>
): Promise<SurveyRecord> {
  return mutateSurveyRecord(store, surveyId, (record) => {
    record.survey = {
      ...record.survey,
      ...compactObject(patch),
      updatedAt: new Date().toISOString(),
      version: record.survey.version + 1,
    };
  });
}

export async function deleteSurvey(store: SurveyStore, surveyId: string): Promise<void> {
  await mutateSurveyState(store, (state) => {
    state.surveys = state.surveys.filter((record) => record.survey.id !== surveyId);
  });
}

export async function addSurveyQuestion(
  store: SurveyStore,
  surveyId: string,
  input: AddQuestionInput
): Promise<SurveyQuestion> {
  let addedQuestion: SurveyQuestion | undefined;
  await mutateSurveyRecord(store, surveyId, (record) => {
    const section = record.sections[record.sections.length - 1];
    if (!section) {
      throw new Error("survey section not found");
    }

    addedQuestion = createQuestion(surveyId, section.id, record.questions.length + 1, input);
    record.questions.push(addedQuestion);
    record.survey.updatedAt = new Date().toISOString();
    record.survey.version += 1;
  });

  return addedQuestion!;
}

export async function updateSurveyQuestion(
  store: SurveyStore,
  surveyId: string,
  questionId: string,
  patch: Partial<Pick<SurveyQuestion, "title" | "description" | "required" | "options">>
): Promise<SurveyQuestion> {
  let updatedQuestion: SurveyQuestion | undefined;
  await mutateSurveyRecord(store, surveyId, (record) => {
    const question = record.questions.find((item) => item.id === questionId);
    if (!question) {
      throw new Error("question not found");
    }

    Object.assign(question, compactObject(patch));
    record.survey.updatedAt = new Date().toISOString();
    record.survey.version += 1;
    updatedQuestion = question;
  });

  return updatedQuestion!;
}

export async function deleteSurveyQuestion(
  store: SurveyStore,
  surveyId: string,
  questionId: string
): Promise<SurveyRecord> {
  return mutateSurveyRecord(store, surveyId, (record) => {
    record.questions = record.questions
      .filter((question) => question.id !== questionId)
      .map((question, index) => ({ ...question, order: index + 1 }));
    record.survey.updatedAt = new Date().toISOString();
    record.survey.version += 1;
  });
}

export async function generateSurveyReportTemplate(
  store: SurveyStore,
  surveyId: string
): Promise<ReportTemplate> {
  let template: ReportTemplate | undefined;
  await mutateSurveyRecord(store, surveyId, (record) => {
    template = generateReportTemplate(record).reportTemplate;
    record.reportTemplate = template;
    record.survey.updatedAt = new Date().toISOString();
  });

  return template!;
}

export async function publishSurvey(
  store: SurveyStore,
  surveyId: string
): Promise<{ survey: Survey; shareLink: SurveyShareLink; reportTemplate: ReportTemplate }> {
  let published:
    | { survey: Survey; shareLink: SurveyShareLink; reportTemplate: ReportTemplate }
    | undefined;

  await mutateSurveyRecord(store, surveyId, (record) => {
    const now = new Date().toISOString();
    const reportTemplate = record.reportTemplate ?? generateReportTemplate(record).reportTemplate;
    const shareLink =
      record.shareLinks.find((link) => link.status === "active") ??
      ({
        id: prefixedId("share"),
        surveyId,
        token: prefixedId("s"),
        url: `/s/${prefixedId("token")}`,
        status: "active",
        createdAt: now,
      } satisfies SurveyShareLink);
    shareLink.url = `/s/${shareLink.token}`;

    record.reportTemplate = reportTemplate;
    record.shareLinks = [shareLink, ...record.shareLinks.filter((link) => link.id !== shareLink.id)];
    record.survey = {
      ...record.survey,
      status: "published",
      publishedAt: record.survey.publishedAt ?? now,
      updatedAt: now,
    };

    published = {
      survey: record.survey,
      shareLink,
      reportTemplate,
    };
  });

  return published!;
}

export async function createShareLink(
  store: SurveyStore,
  surveyId: string
): Promise<SurveyShareLink> {
  let shareLink: SurveyShareLink | undefined;
  await mutateSurveyRecord(store, surveyId, (record) => {
    const token = prefixedId("s");
    shareLink = {
      id: prefixedId("share"),
      surveyId,
      token,
      url: `/s/${token}`,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    record.shareLinks.unshift(shareLink);
  });

  return shareLink!;
}

export async function submitSurveyResponse(
  store: SurveyStore,
  token: string,
  input: SubmitSurveyResponseInput
): Promise<SurveyResponse> {
  const lookup = await getSurveyByToken(store, token);
  if (!lookup) {
    throw new Error("share link not found");
  }

  if (lookup.shareLink.status !== "active") {
    throw new Error("share link is not active");
  }

  const now = new Date().toISOString();
  const response: SurveyResponse = {
    id: prefixedId("response"),
    surveyId: lookup.record.survey.id,
    status: "completed",
    startedAt: now,
    submittedAt: now,
    durationSeconds: input.durationSeconds ?? 0,
    metadata: input.metadata ?? {},
    answers: input.answers,
  };

  await mutateSurveyRecord(store, lookup.record.survey.id, (record) => {
    record.responses.unshift(response);
  });

  return response;
}

export async function generateSurveyReport(
  store: SurveyStore,
  surveyId: string
): Promise<GeneratedSurveyReport> {
  let report: GeneratedSurveyReport | undefined;
  await mutateSurveyRecord(store, surveyId, (record) => {
    const reportTemplate = record.reportTemplate ?? generateReportTemplate(record).reportTemplate;
    record.reportTemplate = reportTemplate;
    report = calculateSurveyReport(record, record.responses, reportTemplate);
    record.reports.unshift(report);
  });

  return report!;
}

async function mutateSurveyRecord(
  store: SurveyStore,
  surveyId: string,
  mutator: (record: SurveyRecord) => void
): Promise<SurveyRecord> {
  let mutated: SurveyRecord | undefined;
  await mutateSurveyState(store, (state) => {
    const record = state.surveys.find((survey) => survey.survey.id === surveyId);
    if (!record) {
      throw new Error("survey not found");
    }

    mutator(record);
    mutated = record;
  });

  return mutated!;
}

async function mutateSurveyState(
  store: SurveyStore,
  mutator: (state: SurveyStoreState) => void
): Promise<void> {
  const state = await store.read();
  mutator(state);
  await store.write(state);
}

function createQuestion(
  surveyId: string,
  sectionId: string,
  order: number,
  input: AddQuestionInput
): SurveyQuestion {
  return {
    id: prefixedId("question"),
    surveyId,
    sectionId,
    type: input.type,
    title: input.title.trim(),
    description: input.description,
    required: input.required,
    order,
    options: input.options?.map((option) => ({
      ...option,
      id: option.id ?? prefixedId("option"),
    })),
    settings: { displayStyle: "list" },
    analysisConfig: {
      includeInReport: true,
      role: input.analysisRole ?? inferAnalysisRole(input.type),
      dimensionKey: input.dimensionKey,
      recommendedChart: input.type === "textarea" ? "word_cloud" : "bar",
      crossAnalysisEnabled: input.analysisRole === "profile" || input.analysisRole === "segment",
      weight: input.dimensionKey ? 1 : undefined,
    },
  };
}

function inferAnalysisRole(type: QuestionType): AnalysisRole {
  if (type === "textarea" || type === "text") {
    return "open_feedback";
  }
  if (type === "industry_selector" || type === "company_size" || type === "role_selector") {
    return "profile";
  }
  if (type === "rating" || type === "scale" || type === "satisfaction_score" || type === "nps") {
    return "dimension";
  }

  return "metric";
}

function maturityOptions(): Array<Omit<QuestionOption, "id">> {
  return [
    { label: "非常低", value: "1", score: 1 },
    { label: "较低", value: "2", score: 2 },
    { label: "一般", value: "3", score: 3 },
    { label: "较高", value: "4", score: 4 },
    { label: "非常高", value: "5", score: 5 },
  ];
}

function dimensionQuestion(title: string, dimensionKey: string): AddQuestionInput {
  return {
    type: "rating",
    title,
    required: true,
    options: maturityOptions(),
    analysisRole: "dimension",
    dimensionKey,
  };
}

function openQuestion(title: string): AddQuestionInput {
  return {
    type: "textarea",
    title,
    required: false,
    analysisRole: "open_feedback",
  };
}

function industryOptions(): Array<Omit<QuestionOption, "id">> {
  return [
    { label: "制造业", value: "manufacturing" },
    { label: "服务业", value: "service" },
    { label: "IT/互联网", value: "internet" },
    { label: "金融业", value: "finance" },
    { label: "零售/消费", value: "retail" },
    { label: "其他", value: "other" },
  ];
}

function companySizeOptions(): Array<Omit<QuestionOption, "id">> {
  return [
    { label: "50人以下", value: "under_50", score: 1 },
    { label: "50-200人", value: "50_200", score: 2 },
    { label: "201-500人", value: "201_500", score: 3 },
    { label: "501-1000人", value: "501_1000", score: 4 },
    { label: "1000人以上", value: "over_1000", score: 5 },
  ];
}

function npsOptions(): Array<Omit<QuestionOption, "id">> {
  return Array.from({ length: 11 }, (_, score) => ({
    label: `${score}分`,
    value: String(score),
    score: score === 0 ? 1 : Math.max(1, Math.round(score / 2)),
  }));
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function prefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}
