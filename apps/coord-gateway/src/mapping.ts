// GitHub webhook payload → RepoHub 镜像增量（F03/F04）。
// 只映射 issues / pull_request 两类为镜像；其余事件 F03 阶段 ack 后忽略
// （check_run/status 的镜像增强随 F09 门户实时化补充）。

export interface QueuedWebhook {
  delivery_id: string;
  event: string; // X-GitHub-Event
  repo: string; // owner/name
  payload: Record<string, unknown>;
}

export interface IngestBody {
  delivery_id: string;
  mirror?: { kind: "issue" | "pr"; data: Record<string, unknown> };
}

function names(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((x) => (typeof x === "object" && x !== null ? ((x as Record<string, unknown>)["name"] ?? (x as Record<string, unknown>)["login"]) : x))
    .filter((v): v is string => typeof v === "string");
}

export function toIngestBody(msg: QueuedWebhook): IngestBody {
  const p = msg.payload;
  if (msg.event === "issues" && typeof p["issue"] === "object" && p["issue"]) {
    const issue = p["issue"] as Record<string, unknown>;
    return {
      delivery_id: msg.delivery_id,
      mirror: {
        kind: "issue",
        data: {
          number: issue["number"],
          state: issue["state"],
          title: issue["title"],
          labels: names(issue["labels"]),
          assignees: names(issue["assignees"]),
        },
      },
    };
  }
  if (msg.event === "pull_request" && typeof p["pull_request"] === "object" && p["pull_request"]) {
    const pr = p["pull_request"] as Record<string, unknown>;
    const head = (pr["head"] ?? {}) as Record<string, unknown>;
    const mergeable = pr["mergeable"];
    return {
      delivery_id: msg.delivery_id,
      mirror: {
        kind: "pr",
        data: {
          number: pr["number"],
          state: pr["merged"] === true ? "merged" : pr["state"],
          title: pr["title"],
          body: typeof pr["body"] === "string" ? pr["body"] : null, // 投影解析 "Closes #N" 关联（F06）
          head_sha: head["sha"] ?? null,
          mergeable: mergeable === true ? "MERGEABLE" : mergeable === false ? "CONFLICTING" : "UNKNOWN",
          merge_state: typeof pr["mergeable_state"] === "string" ? (pr["mergeable_state"] as string).toUpperCase() : null,
          labels: names(pr["labels"]),
          assignees: names(pr["assignees"]),
          draft: pr["draft"] === true,
        },
      },
    };
  }
  // 未映射事件：仅做 delivery 去重登记（保持幂等语义一致）
  return { delivery_id: msg.delivery_id };
}
