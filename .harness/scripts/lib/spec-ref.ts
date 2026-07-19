// spec-ref.ts — feature ↔ story 追溯校验（人类拍板 2026-07-19：每个 feature 必须
// 有一个 story 落在 phases/<phase>/requirements/ 下，用 requirements.template.md
// 的 R1..Rn 编号章节；这样才能形成"需求→feature→PR→GitHub issue"的闭环）。
//
// spec_ref 格式：`<requirements 目录下的文件名>#R<n>`，如 `auth.md#R3`。
// 校验分三层，任一层失败都判定不可解析（不是"格式对就算数"）：
//   1. 文件确实存在于 phases/<phase>/requirements/ 下；
//   2. 该文件不是未填写的裸模板；
//   3. 引用的章节 ID（## R<n> ...）确实存在于该文件里。
//
// "裸模板"怎么判定：不能只看 {{PHASE_NAME}} 这类占位符——new-phase.ts 用
// renderTemplateFile() 在 scaffold 那一刻就把 {{...}} 全替换成真实值了（见
// render.ts），文件落地时早就不含 {{}}，这个信号在人类填写之前就已经消失。
// 真正的信号是「内容是不是和刚 scaffold 出来那份一字不差」——把
// requirements.template.md 用这个 phase 的真实 PHASE_NAME/PHASE_ID 重新渲染一遍，
// 逐字比对：一样 = 没人碰过，仍是裸模板。
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findPhaseDir } from "./paths";
import { loadRoadmap } from "./roadmap";
import { renderTemplateFile } from "./render";

const SPEC_REF_RE = /^([^#]+\.md)#(R\d+)$/;
const SECTION_HEADING_RE = (id: string) => new RegExp(`^##\\s+${id}\\b`, "m");

/** 某份需求文档是不是刚 scaffold 出来、没人碰过的裸模板。 */
function isUnfilledTemplate(phaseId: string, body: string): boolean {
  if (!body.trim()) return true;
  if (/\{\{\w+\}\}/.test(body)) return true; // 防御：万一渲染步骤被跳过
  const rm = loadRoadmap();
  const name = rm.phases.find((p) => p.id === phaseId)?.name;
  if (!name) return false; // roadmap 里查不到（异常情况），不误判为裸模板
  try {
    const virgin = renderTemplateFile("requirements.template.md", { PHASE_ID: phaseId, PHASE_NAME: name });
    return body.trim() === virgin.trim();
  } catch {
    return false; // 模板文件本身读不到，不阻塞——那是另一个更严重的问题
  }
}

export interface SpecRefResult {
  ok: boolean;
  /** 不合格时的一句话原因，直接可作为 die()/Finding 的消息用 */
  reason?: string;
}

export function requirementsDir(phaseId: string): string {
  return join(findPhaseDir(phaseId), "requirements");
}

/** requirements/ 文件夹是否存在、非空、且至少一份非 README 的 *.md 已经填了内容
 *  （不是原样保留的裸模板）。UI 先行关卡（ui-signoff）用这个判定"有没有对应的 requirements"。 */
export function hasRequirementsCoverage(phaseId: string): SpecRefResult {
  let dir: string;
  try {
    dir = requirementsDir(phaseId);
  } catch (e) {
    return { ok: false, reason: `找不到 Phase ${phaseId} 的目录：${(e as Error).message}` };
  }
  if (!existsSync(dir)) return { ok: false, reason: `requirements/ 目录不存在（${dir}）` };
  const mdFiles = readdirSync(dir).filter((f) => f.toLowerCase() !== "readme.md" && f.endsWith(".md"));
  if (mdFiles.length === 0) return { ok: false, reason: `requirements/ 目录下没有需求文档（除 README.md 外为空）` };
  const filled = mdFiles.some((f) => !isUnfilledTemplate(phaseId, readFileSync(join(dir, f), "utf8")));
  if (!filled) {
    return {
      ok: false,
      reason: `requirements/ 里的 ${mdFiles.length} 份文档都还是刚 scaffold 出来、没人填写的裸模板`,
    };
  }
  return { ok: true };
}

/** 校验单个 feature 的 spec_ref：格式 + 文件存在 + 章节存在。 */
export function resolveSpecRef(phaseId: string, specRef: string | undefined | null): SpecRefResult {
  if (!specRef || !specRef.trim()) {
    return { ok: false, reason: "缺少 spec_ref（每个 feature 必须指向 requirements/ 下的一个 story 章节）" };
  }
  const m = SPEC_REF_RE.exec(specRef.trim());
  if (!m) {
    return { ok: false, reason: `spec_ref 格式不对："${specRef}"，应为 "<文件名>.md#R<n>"（如 auth.md#R3）` };
  }
  const [, file, sectionId] = m as unknown as [string, string, string];
  let dir: string;
  try {
    dir = requirementsDir(phaseId);
  } catch (e) {
    return { ok: false, reason: `找不到 Phase ${phaseId} 的目录：${(e as Error).message}` };
  }
  const path = join(dir, file);
  if (!existsSync(path)) {
    return { ok: false, reason: `spec_ref 指向的文件不存在：requirements/${file}` };
  }
  const body = readFileSync(path, "utf8");
  if (!SECTION_HEADING_RE(sectionId).test(body)) {
    return { ok: false, reason: `spec_ref 指向的章节 "${sectionId}" 在 requirements/${file} 里找不到（标题需形如 "## ${sectionId} ..."）` };
  }
  return { ok: true };
}
