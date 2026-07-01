import { NextResponse } from "next/server";
import {
  createSurvey,
  getSurveyStore,
  listOrCreateInitialSurvey,
  type CreateSurveyInput,
} from "@/lib/survey/survey-service";
import { jsonError, requireString } from "./_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const initialSurveyInput: CreateSurveyInput = {
  title: "2024年企业数字化转型调研",
  description: "了解企业在数字化转型过程中的现状、挑战和成熟度。",
  category: "business_diagnosis",
  businessGoal: "评估企业数字化成熟度，识别关键阻碍，并输出咨询式行动建议。",
  targetAudience: "企业负责人、业务负责人、IT 管理者与数字化转型相关岗位。",
  templateId: "business_digital_diagnosis",
};

export async function GET() {
  try {
    const surveys = await listOrCreateInitialSurvey(getSurveyStore(), initialSurveyInput);
    return NextResponse.json({ surveys });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreateSurveyInput>;
    const input: CreateSurveyInput = {
      title: requireString(body.title, "未命名问卷"),
      description: requireString(body.description),
      category: body.category ?? "custom",
      businessGoal: requireString(body.businessGoal, "收集业务反馈并生成可执行报告"),
      targetAudience: requireString(body.targetAudience, "目标受访者"),
      templateId: body.templateId,
    };

    if (!input.title.trim()) {
      return jsonError("title 必填", 400);
    }

    const survey = await createSurvey(getSurveyStore(), input);
    return NextResponse.json({ survey }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
