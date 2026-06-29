// packages/memory/src/index.ts
// 三层记忆系统：working（本回合）→ session（本会话）→ durable（跨会话持久）
// 见 agentic-patterns.md："durable 必须可序列化、可恢复"

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ─── 层 1：WorkingMemory（本回合，进程内 Map，会话结束丢弃）─────────────────

export class WorkingMemory {
  private store = new Map<string, unknown>();

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  /** 导出本回合快照（用于降级到 SessionMemory） */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries(this.store);
  }

  clear(): void {
    this.store.clear();
  }
}

// ─── 层 2：SessionMemory（本会话，文件持久，进程退出仍存在）──────────────────

export class SessionMemory {
  private data: Record<string, unknown> = {};

  constructor(private readonly filePath: string) {
    if (existsSync(filePath)) {
      try {
        this.data = JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
      } catch {
        this.data = {};
      }
    }
  }

  set(key: string, value: unknown): void {
    this.data[key] = value;
    this.flush();
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }

  delete(key: string): void {
    delete this.data[key];
    this.flush();
  }

  /** 合并 WorkingMemory 快照到 SessionMemory */
  mergeSnapshot(snapshot: Record<string, unknown>): void {
    Object.assign(this.data, snapshot);
    this.flush();
  }

  private flush(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + "\n", "utf8");
  }
}

// ─── 层 3：DurableMemory（跨会话，结构化 JSON，可恢复路径 in progress.md）

export class DurableMemory {
  private records: Map<string, DurableRecord> = new Map();

  constructor(private readonly filePath: string) {
    if (existsSync(filePath)) {
      try {
        const raw = JSON.parse(readFileSync(filePath, "utf8")) as DurableRecord[];
        for (const r of raw) this.records.set(r.key, r);
      } catch {
        this.records = new Map();
      }
    }
  }

  /** 写入一条持久记录（idempotent — 同 key 覆盖） */
  write(key: string, value: unknown, tags: string[] = []): void {
    this.records.set(key, {
      key,
      value,
      tags,
      updatedAt: new Date().toISOString(),
    });
    this.flush();
  }

  read<T = unknown>(key: string): T | undefined {
    return this.records.get(key)?.value as T | undefined;
  }

  /** 按 tag 查找所有记录 */
  findByTag(tag: string): DurableRecord[] {
    return [...this.records.values()].filter((r) => r.tags.includes(tag));
  }

  all(): DurableRecord[] {
    return [...this.records.values()];
  }

  private flush(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify([...this.records.values()], null, 2) + "\n", "utf8");
  }
}

export interface DurableRecord {
  key: string;
  value: unknown;
  tags: string[];
  updatedAt: string;
}

// ─── 便捷工厂：从 sprint 目录创建完整三层记忆 ──────────────────────────────

export interface MemoryStack {
  working: WorkingMemory;
  session: SessionMemory;
  durable: DurableMemory;
}

/** 把 agentId 规整成文件名安全的片段（多 agent 并发隔离用） */
function safeAgentSlug(agentId: string): string {
  return agentId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * 从 sprint 目录创建三层记忆。
 *
 * 并发隔离（前向兼容，见 ADR-001）：
 * - 传入 `agentId` 时，**session** 文件按 agent 隔离为 `session.<agentId>.json`，
 *   避免同 sprint 多 agent 并发覆写（session 本就是按会话私有，隔离无副作用）。
 * - **durable** 始终共享 `durable.json`：它是跨会话的共享知识，按 agent 拆分会割裂。
 *   等真正出现并发写竞争，再用「原子写 + 读时合并」或单写者锁处理，而非分文件。
 * - 不传 `agentId` 时行为与旧版完全一致（单 agent 模式）。
 */
export function createMemoryStack(sprintDir: string, agentId?: string): MemoryStack {
  const sessionFile = agentId ? `session.${safeAgentSlug(agentId)}.json` : "session.json";
  return {
    working: new WorkingMemory(),
    session: new SessionMemory(join(sprintDir, ".memory", sessionFile)),
    durable: new DurableMemory(join(sprintDir, ".memory", "durable.json")),
  };
}
