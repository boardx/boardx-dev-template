// apps/workflow-worker/src/presentationRevisionJob.ts — 演示文稿修订/单页优化任务处理（P12 F03）
// 消费 boardx.presentation-revision 队列：kind='plan' 时对整套幻灯片做方案层修订，
// kind='page' 时仅重生成目标页并原位替换。成功后原地更新 presentation_artifacts 的
// title/slides（不改变 status/产物 object_key）；失败只回写 presentation_revisions 的
// error 态，不触碰 presentation_artifacts——保证「修订失败不破坏原可查看结果」。
// 任务需幂等：重复消费同一 revisionId 时以数据库当前态为准。
import {
  revisePresentationPlan,
  optimizePresentationPage,
  type PresentationSlide,
} from "@repo/ai";

export interface PresentationRevisionJobData {
  revisionId: string;
  artifactId: string;
  kind: "plan" | "page";
  pageN?: number;
  instructions: string;
  currentTitle: string;
  currentSlides: PresentationSlide[];
}

export interface PresentationRevisionJobOutcome {
  status: "ready" | "error";
  title?: string;
  slides?: PresentationSlide[];
  summary?: { label: string }[];
  errorMessage?: string;
}

/** 处理一个修订/优化任务：按 kind 分派到方案修订或单页优化，返回终态供 worker 回写。
 *  IO（生成）与队列/DB 回写解耦，便于单测覆盖成功/失败分支。 */
export async function processPresentationRevisionJob(
  data: PresentationRevisionJobData
): Promise<PresentationRevisionJobOutcome> {
  try {
    if (data.kind === "plan") {
      const result = await revisePresentationPlan({
        currentSlides: data.currentSlides,
        currentTitle: data.currentTitle,
        instructions: data.instructions,
      });
      return { status: "ready", title: result.title, slides: result.slides, summary: result.summary };
    }

    // kind === 'page'：仅重生成目标页，其余页原样保留（原位替换）。
    const targetIndex = data.currentSlides.findIndex((s) => s.n === data.pageN);
    if (targetIndex === -1) {
      return { status: "error", errorMessage: "目标页不存在" };
    }
    const result = await optimizePresentationPage({
      currentSlide: data.currentSlides[targetIndex]!,
      instructions: data.instructions,
    });
    const slides = data.currentSlides.slice();
    slides[targetIndex] = result.slide;
    return { status: "ready", slides };
  } catch (err) {
    return { status: "error", errorMessage: err instanceof Error ? err.message : String(err) };
  }
}
