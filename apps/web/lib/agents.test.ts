import { describe, it, expect } from "vitest";
import { filterAgents, type Agent } from "./agents";

const agents: Agent[] = [
  { id: 1, name: "Research Bot", description: "deep research helper", tags: ["research", "web"] },
  { id: 2, name: "Sticky Summarizer", description: "summarize notes", tags: ["summary"] },
  { id: 3, name: "Translator", description: "translate text", tags: ["language", "translate"] },
];

describe("filterAgents", () => {
  it("空查询返回全部", () => {
    expect(filterAgents(agents, "")).toHaveLength(3);
    expect(filterAgents(agents, "   ")).toHaveLength(3);
  });

  it("按名称匹配（大小写不敏感）", () => {
    expect(filterAgents(agents, "research").map((a) => a.id)).toEqual([1]);
    expect(filterAgents(agents, "STICKY").map((a) => a.id)).toEqual([2]);
  });

  it("按描述匹配", () => {
    expect(filterAgents(agents, "summarize").map((a) => a.id)).toEqual([2]);
  });

  it("按标签匹配", () => {
    expect(filterAgents(agents, "language").map((a) => a.id)).toEqual([3]);
  });

  it("无匹配返回空", () => {
    expect(filterAgents(agents, "zzz")).toHaveLength(0);
  });
});
