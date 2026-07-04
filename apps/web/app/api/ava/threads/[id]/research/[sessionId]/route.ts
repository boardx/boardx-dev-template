// apps/web/app/api/ava/threads/[id]/research/[sessionId]/route.ts — 推进研究阶段（P18 F03/F04）
//
// PATCH：客户端在两步确认（澄清 → 计划）与执行推进时调用，body 携带一个 `action`：
//   - "confirm-clarify": draft → clarified（用户显式确认澄清问题；计划从此才可确认）。
//   - "confirm-plan":    clarified → running（用户显式确认计划；服务端把 timeline 的
//                        第一个阶段标记为 running，其余 queued——这是"进入执行"的唯一
//                        入口，之前不允许从 draft 直接跳过来）。
//   - "advance":         running 状态下推进一个阶段（服务端计算下一个 timeline 快照并
//                        返回，不是前端 setTimeout 臆造出来的动画状态；调用方按自己的
//                        节奏轮询/调用，每次调用都真实持久化）。
// 每个 action 都在服务端校验"当前 status 是否允许这个转移"，不接受客户端直接把 status/
// timeline 摆成任意值——这是 F04 要求"执行时间线状态来自后端真实阶段进度"的落地点：
// 阶段推进逻辑（下一个阶段是谁、何时算 complete）由这个路由计算，前端只负责渲染服务端
// 返回的 session，不再自己维护一份并行的定时器状态机。
import { NextResponse } from "next/server";
import {
  getAvaThread,
  getAvaResearchSession,
  updateAvaResearchSessionProgress,
  type AvaResearchTimelineItem,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

interface AdvanceBody {
  action?: unknown;
}

/** running 状态下，把 timeline 里第一个非 complete 的阶段设为 complete、
 *  紧随其后的一个设为 running，其余保持不变——服务端权威的"推进一步"计算。
 *  全部已 complete 时返回原样（调用方据此判断整体是否已完成）。 */
function advanceTimeline(timeline: AvaResearchTimelineItem[]): {
  timeline: AvaResearchTimelineItem[];
  done: boolean;
} {
  const idx = timeline.findIndex((item) => item.status !== "complete");
  if (idx === -1) return { timeline, done: true };
  const next = timeline.map((item, i) => {
    if (i < idx) return { ...item, status: "complete" as const };
    if (i === idx) return { ...item, status: "complete" as const };
    if (i === idx + 1) return { ...item, status: "running" as const };
    return item;
  });
  const done = next.every((item) => item.status === "complete");
  return { timeline: next, done };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sessionId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  const sessionId = Number(params.sessionId);
  if (!Number.isFinite(threadId) || !Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "无效的 id" }, { status: 400 });
  }

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const session = await getAvaResearchSession(sessionId);
  // 注意：bigint 列经 node-postgres 以字符串形式返回（同 ava-thread-auth.ts 的既有约定），
  // 严格 !== 比较 number 和 string 恒为真，必须先归一化再比较。
  if (!session || String(session.thread_id) !== String(threadId)) {
    return NextResponse.json({ error: "研究会话不存在" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as AdvanceBody;
  const action = typeof body.action === "string" ? body.action : undefined;

  if (action === "confirm-clarify") {
    if (session.status !== "draft") {
      return NextResponse.json(
        { error: "澄清问题已确认过，无法重复确认。" },
        { status: 409 }
      );
    }
    const updated = await updateAvaResearchSessionProgress(sessionId, { status: "clarified" });
    return NextResponse.json({ session: updated });
  }

  if (action === "confirm-plan") {
    if (session.status !== "clarified") {
      return NextResponse.json(
        { error: "请先确认澄清问题，再确认研究计划。" },
        { status: 409 }
      );
    }
    const startTimeline: AvaResearchTimelineItem[] = session.timeline.map((item, index) => ({
      ...item,
      status: index === 0 ? "running" : "queued",
    }));
    const updated = await updateAvaResearchSessionProgress(sessionId, {
      status: "running",
      timeline: startTimeline,
    });
    return NextResponse.json({ session: updated });
  }

  if (action === "advance") {
    if (session.status !== "running") {
      return NextResponse.json(
        { error: "研究尚未进入执行阶段，无法推进。" },
        { status: 409 }
      );
    }
    const { timeline, done } = advanceTimeline(session.timeline);
    const updated = await updateAvaResearchSessionProgress(sessionId, {
      status: done ? "complete" : "running",
      timeline,
    });
    return NextResponse.json({ session: updated, done });
  }

  return NextResponse.json({ error: "缺少或不支持的 action" }, { status: 400 });
}
