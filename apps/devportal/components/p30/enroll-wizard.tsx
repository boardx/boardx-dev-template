"use client";
// M2 enroll 三步向导（p30 UI 先行原型，UC-06 / D2 / D6）：
// ① 起名（@handle/agent-name 命名空间查重）+ 选运行时（供应商中立）
// ② 一次性 token（mint-on-reveal 样式）+ 复制接入命令
// ③ 等待首个心跳——mock 定时器 4 秒后点亮（aha moment）。
// ⚠️ 全部 mock：token 是示例文本，心跳点亮由前端定时器模拟。
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENROLL_RUNTIMES, MOCK_ME, MOCK_ONE_TIME_TOKEN, mockInstallCommand, type EnrollRuntime } from "@/lib/mock/p30";

type Step = 1 | 2 | 3;

function StepRail({ step }: { step: Step }) {
  const items: ReadonlyArray<{ n: Step; label: string }> = [
    { n: 1, label: "起名与运行时" },
    { n: 2, label: "一次性 token" },
    { n: 3, label: "等待首个心跳" },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="enroll 步骤">
      {items.map((it, i) => (
        <li key={it.n} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-12 font-semibold transition-colors ${
              step === it.n ? "bg-primary text-primary-foreground" : step > it.n ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            }`}
            aria-current={step === it.n ? "step" : undefined}
          >
            {step > it.n ? "✓" : it.n}
          </span>
          <span className={`text-12 ${step === it.n ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{it.label}</span>
        </li>
      ))}
    </ol>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function EnrollWizard({
  existingNames,
  onDone,
  onCancel,
}: {
  /** 我命名空间内已存在的 agent 短名（查重用，D6：仅自己空间内唯一） */
  existingNames: readonly string[];
  onDone: (fullId: string, runtime: EnrollRuntime) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState<EnrollRuntime>("Claude Code");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"token" | "cmd" | null>(null);
  const [heartbeatLive, setHeartbeatLive] = useState(false);

  const trimmed = name.trim();
  const validFormat = /^[a-z0-9][a-z0-9-]{1,38}$/.test(trimmed);
  const duplicate = existingNames.includes(trimmed);
  const fullId = `@${MOCK_ME.handle}/${trimmed || "…"}`;

  // 第 3 步：mock 定时器模拟「首个心跳点亮」（aha moment）。真实实现时换 WS/轮询。
  useEffect(() => {
    if (step !== 3) return;
    const t = setTimeout(() => setHeartbeatLive(true), 4000);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-surface-darkest/60 p-4 pt-14" role="presentation" onClick={onCancel}>
      <div
        data-testid="enroll-wizard"
        role="dialog"
        aria-modal="true"
        aria-label="Enroll 新 agent"
        className="w-full max-w-xl rounded-14 border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-17 font-bold text-foreground">Enroll 新 agent</h2>
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label="关闭向导">
            ✕
          </Button>
        </div>
        <div className="mt-3">
          <StepRail step={step} />
        </div>

        {step === 1 && (
          <div data-testid="enroll-step-1" className="mt-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agent-name">agent 名（命名空间：@{MOCK_ME.handle}/）</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-lg bg-tag-purple px-2.5 py-2 font-mono text-13 text-foreground">@{MOCK_ME.handle}/</span>
                <Input
                  id="agent-name"
                  data-testid="enroll-name-input"
                  value={name}
                  autoComplete="off"
                  placeholder="my-implementer"
                  aria-describedby="agent-name-hint"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {duplicate ? (
                <p id="agent-name-hint" role="alert" data-testid="err-ns-dup" className="text-12 text-destructive">
                  你的命名空间里已存在 <span className="font-mono">{fullId}</span>——换个名字（仅自己空间内查重，不与他人冲突）。
                </p>
              ) : trimmed && !validFormat ? (
                <p id="agent-name-hint" role="alert" data-testid="err-ns-format" className="text-12 text-destructive">
                  仅小写字母/数字/连字符，2-39 位；sub-agent 之后可用点号延伸（如 {fullId}.reviewer）。
                </p>
              ) : (
                <p id="agent-name-hint" className="text-12 text-muted-foreground">
                  完整标识：<span className="font-mono text-foreground">{fullId}</span> · 内部主键为不可变 ULID，改名不断链（D6）。
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label id="runtime-label">运行时（供应商中立）</Label>
              <div role="radiogroup" aria-labelledby="runtime-label" className="flex flex-wrap gap-2">
                {ENROLL_RUNTIMES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={runtime === r}
                    data-testid={`enroll-runtime-${r}`}
                    onClick={() => setRuntime(r)}
                    className={`rounded-10 border px-3 py-1.5 text-13 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      runtime === r ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-surface-1"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <p className="rounded-8 bg-surface-2 p-2.5 text-12 text-muted-foreground">
              无审批等待（D2）：信任锚点是你本人——你已是成员，你的 agent enroll 即生效。
            </p>
            <div className="flex justify-end">
              <Button data-testid="enroll-next-1" disabled={!validFormat || duplicate} onClick={() => setStep(2)}>
                下一步：领取 token →
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div data-testid="enroll-step-2" className="mt-4 space-y-4">
            <div className="rounded-10 border border-border bg-surface-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-13 font-medium text-foreground">一次性 scoped token</span>
                <Badge variant="outline" className="text-11">mint-on-reveal</Badge>
              </div>
              {revealed ? (
                <div data-testid="token-revealed" className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-8 bg-surface-dark px-2.5 py-2 font-mono text-12 text-surface-dark-foreground">
                    {MOCK_ONE_TIME_TOKEN}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="copy-token"
                    onClick={() => void copyText(MOCK_ONE_TIME_TOKEN).then((ok) => ok && setCopied("token"))}
                  >
                    {copied === "token" ? "已复制 ✓" : "复制"}
                  </Button>
                </div>
              ) : (
                <Button className="mt-2" variant="secondary" data-testid="token-reveal" onClick={() => setRevealed(true)}>
                  点击揭示 token（仅此一次，关闭后不可找回）
                </Button>
              )}
              <p className="mt-2 text-12 text-destructive">⚠ 关闭本向导后 token 不可找回，只能轮换重发。</p>
            </div>

            <div className="rounded-10 border border-border bg-surface-1 p-3">
              <span className="text-13 font-medium text-foreground">接入命令（在 agent 运行环境执行）</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-8 bg-surface-dark px-2.5 py-2 font-mono text-12 text-surface-dark-foreground">
                  {mockInstallCommand(fullId)}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="copy-install-cmd"
                  onClick={() => void copyText(mockInstallCommand(fullId)).then((ok) => ok && setCopied("cmd"))}
                >
                  {copied === "cmd" ? "已复制 ✓" : "复制"}
                </Button>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                ← 上一步
              </Button>
              <Button data-testid="enroll-next-2" disabled={!revealed} onClick={() => setStep(3)}>
                我已保存，等待首个心跳 →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div data-testid="enroll-step-3" className="mt-4 space-y-4">
            {heartbeatLive ? (
              <div data-testid="first-heartbeat-live" className="flex flex-col items-center gap-2 rounded-10 border border-success/40 bg-tag-green/50 py-8 text-center transition-colors">
                <span aria-hidden className="h-3 w-3 rounded-full bg-success" />
                <p className="text-15 font-semibold text-foreground">🎉 已接入！{fullId} 心跳正常</p>
                <p className="text-12 text-muted-foreground">运行时 {runtime} · 已开始拉取 ready work</p>
              </div>
            ) : (
              <div data-testid="first-heartbeat-waiting" className="flex flex-col items-center gap-2 rounded-10 border border-dashed border-border py-8 text-center">
                <span aria-hidden className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground" />
                <p className="text-13 text-muted-foreground">等待 {fullId} 的首个心跳…（在 agent 环境执行接入命令后自动点亮）</p>
                <p className="text-11 text-muted-foreground">原型说明：4 秒后由 mock 定时器模拟点亮</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button data-testid="enroll-done" disabled={!heartbeatLive} onClick={() => onDone(fullId, runtime)}>
                完成，回到车队 →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
