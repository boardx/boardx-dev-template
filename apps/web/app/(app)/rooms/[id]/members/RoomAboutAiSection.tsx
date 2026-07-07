"use client";
// ─── uc-rr-010（p20/F11）Room AI 上下文字段回补：About & AI 区块 ───────────────
// 独立组件，边界清晰，便于与同页面 F06 DANGER ZONE 区块并行开发时拼接，互不干扰。
// owner/admin 可编辑保存 description、ai_instruction（PATCH /api/rooms/[id]，与 F07
// 权限矩阵同一 canManageRoom 判定）；member 无编辑权限时该区块不渲染（由父页面控制）。
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const AI_INSTRUCTION_MAX_LEN = 4000;

interface RoomAboutAiSectionProps {
  roomId: string;
  initialDescription: string;
  initialAiInstruction: string;
}

export default function RoomAboutAiSection({
  roomId,
  initialDescription,
  initialAiInstruction,
}: RoomAboutAiSectionProps) {
  const [description, setDescription] = useState(initialDescription);
  const [aiInstruction, setAiInstruction] = useState(initialAiInstruction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);
  useEffect(() => {
    setAiInstruction(initialAiInstruction);
  }, [initialAiInstruction]);

  const overLimit = aiInstruction.length > AI_INSTRUCTION_MAX_LEN;

  async function save() {
    setError("");
    setSaved(false);
    if (overLimit) {
      setError(`AI instruction 不能超过 ${AI_INSTRUCTION_MAX_LEN} 字符`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, ai_instruction: aiInstruction }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.errors?.ai_instruction ?? d.errors?.description ?? d.error ?? "保存失败");
        setSaving(false);
        return;
      }
      setSaved(true);
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-testid="room-about-ai-section"
      className="flex flex-col gap-3 rounded-12 border border-border bg-surface-1 p-4"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-15 font-semibold text-foreground">About &amp; AI</h2>
        <p className="text-11 text-muted-foreground">房间描述会展示在房间页头；AI instruction 会注入本房间全部聊天线程的系统提示。</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room-settings-description">房间描述</Label>
        <Textarea
          id="room-settings-description"
          data-testid="room-settings-description"
          placeholder="介绍一下这个房间…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-16"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="room-settings-ai-instruction">AI Instruction</Label>
        <Textarea
          id="room-settings-ai-instruction"
          data-testid="room-settings-ai-instruction"
          placeholder="给房间内 AI 回复的指令，例如语气、角色设定…"
          value={aiInstruction}
          onChange={(e) => setAiInstruction(e.target.value)}
          className="min-h-28"
        />
        <p
          data-testid="room-settings-ai-instruction-count"
          className={overLimit ? "text-11 text-destructive" : "text-11 text-muted-foreground"}
        >
          {aiInstruction.length} / {AI_INSTRUCTION_MAX_LEN}
        </p>
      </div>

      {saving && (
        <p data-testid="loading" aria-busy="true" className="text-11 text-muted-foreground">
          保存中…
        </p>
      )}
      {error && (
        <p role="alert" data-testid="room-about-ai-err" className="text-11 text-destructive">
          {error}
        </p>
      )}
      {saved && !error && (
        <p data-testid="room-about-ai-saved" className="text-11 text-success">
          已保存
        </p>
      )}

      <Button
        type="button"
        data-testid="room-about-ai-save"
        size="sm"
        className="self-start"
        onClick={() => void save()}
        disabled={saving || overLimit}
      >
        {saving ? "保存中…" : "保存"}
      </Button>
    </section>
  );
}
