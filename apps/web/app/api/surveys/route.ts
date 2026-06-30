import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-001-create-survey — 问卷存储（内存版）。
// 说明：本 feature 不引入 DB 表（UC「不包含问卷后端存储实现」）。
// 采用进程内 Map 保存问卷，按创建者归属，供列表 + 创建端到端可见。
// 唯一命名 globalThis key，避免与其它内存 store 冲突；dev 热重载下保持单例。
export interface SurveyQuestion {
  id: string;
  title: string;
  type: "text" | "single" | "multiple" | "rating";
  required: boolean;
  options: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  scope: string;
  status: string;
  responses: number;
  questions: SurveyQuestion[];
  userId: number;
  updatedAt: number;
}

const STORE_KEY = "__boardx_survey_store_uc001__";
type Store = Map<number, Survey[]>;
function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map();
  return g[STORE_KEY]!;
}

function newId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const all = (store().get(user.id) ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const surveys = q ? all.filter((s) => s.title.toLowerCase().includes(q)) : all;
  return NextResponse.json({ surveys });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as {
      title?: unknown;
      description?: unknown;
      scope?: unknown;
      questions?: unknown;
    };
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ errors: { title: "问卷标题不能为空" } }, { status: 400 });

    const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
    const questions: SurveyQuestion[] = rawQuestions
      .map((raw): SurveyQuestion | null => {
        const obj = (raw ?? {}) as Record<string, unknown>;
        const qTitle = String(obj.title ?? "").trim();
        if (!qTitle) return null;
        const type =
          obj.type === "single" || obj.type === "multiple" || obj.type === "rating"
            ? obj.type
            : "text";
        const options = Array.isArray(obj.options)
          ? obj.options.map((o) => String(o ?? "").trim()).filter(Boolean)
          : [];
        return {
          id: newId(),
          title: qTitle,
          type,
          required: obj.required === true,
          options,
        };
      })
      .filter((q): q is SurveyQuestion => q !== null);

    const scope = body.scope === "team" ? "Team" : "Private";
    const survey: Survey = {
      id: newId(),
      title,
      description: String(body.description ?? "").trim(),
      scope,
      status: "Draft",
      responses: 0,
      questions,
      userId: user.id,
      updatedAt: Date.now(),
    };
    const list = store().get(user.id) ?? [];
    list.push(survey);
    store().set(user.id, list);
    return NextResponse.json({ survey }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
