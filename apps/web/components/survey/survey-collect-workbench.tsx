"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CollectionStatus = "active" | "paused";
type ResponseMode = "anonymous" | "identified";

interface SurveyCollectWorkbenchProps {
  survey: {
    id: number;
    status: CollectionStatus;
    shareUrl: string;
    publishStartAt: string | null;
    publishEndAt: string | null;
  };
  responseMode: ResponseMode;
  publishStartAt: string;
  publishEndAt: string;
  responseLimit: string;
  oneResponsePerUser: boolean;
  confirmationMessage: string;
  message: string;
  statusTogglePending: boolean;
  onResponseModeChange: (value: ResponseMode) => void;
  onPublishStartAtChange: (value: string) => void;
  onPublishEndAtChange: (value: string) => void;
  onResponseLimitChange: (value: string) => void;
  onOneResponsePerUserChange: (value: boolean) => void;
  onConfirmationMessageChange: (value: string) => void;
  onToggleStatus: () => void;
  onReset: () => void;
  onSave: () => Promise<void>;
}

function isInvalidTimeRange(start: string, end: string) {
  if (!start || !end) return false;
  return new Date(end).getTime() <= new Date(start).getTime();
}

export function SurveyCollectWorkbench({
  survey,
  responseMode,
  publishStartAt,
  publishEndAt,
  responseLimit,
  oneResponsePerUser,
  confirmationMessage,
  message,
  statusTogglePending,
  onResponseModeChange,
  onPublishStartAtChange,
  onPublishEndAtChange,
  onResponseLimitChange,
  onOneResponsePerUserChange,
  onConfirmationMessageChange,
  onToggleStatus,
  onReset,
  onSave,
}: SurveyCollectWorkbenchProps) {
  const [startImmediately, setStartImmediately] = useState(!publishStartAt);
  const [noEndDate, setNoEndDate] = useState(!publishEndAt);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const isCollecting = survey.status === "active";
  const invalidTimeRange = isInvalidTimeRange(
    startImmediately ? "" : publishStartAt,
    noEndDate ? "" : publishEndAt,
  );
  const shareUrl = survey.shareUrl || `/s/${survey.id}`;
  const feedbackIsSuccess = message.startsWith("已");

  function updateStartImmediately(checked: boolean) {
    setStartImmediately(checked);
    if (checked) onPublishStartAtChange("");
  }

  function updateNoEndDate(checked: boolean) {
    setNoEndDate(checked);
    if (checked) onPublishEndAtChange("");
  }

  function resetSettings() {
    setStartImmediately(survey.publishStartAt == null);
    setNoEndDate(survey.publishEndAt == null);
    setCopied(false);
    onReset();
  }

  async function saveSettings() {
    if (invalidTimeRange || saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  async function copyShareUrl() {
    if (!isCollecting) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div data-testid="workspace-collect-workbench" className="w-full">
      <section
        data-testid="collect-settings-panel"
        className="overflow-hidden rounded-lg border border-survey/20 bg-background shadow-sm"
      >
        <div
          data-testid="collect-status-panel"
          className="flex flex-col gap-5 border-b border-border p-5 md:flex-row md:items-center md:justify-between md:p-6"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-20 font-bold text-foreground">发布回收</h2>
              <Badge
                variant="outline"
                className={isCollecting ? "border-success/30 bg-tag-green text-success" : "bg-muted text-muted-foreground"}
              >
                {statusTogglePending ? "处理中" : isCollecting ? "回收中" : "已暂停"}
              </Badge>
            </div>
            <p className="mt-2 text-13 text-muted-foreground">设置问卷的开放状态和有效时间。</p>
          </div>

          <div className="flex items-center justify-between gap-4 md:justify-end">
            <div>
              <Label htmlFor="collect-enabled-switch" className="text-14 font-semibold text-foreground">
                启用回收
              </Label>
              <p className="mt-1 text-12 text-muted-foreground">
                {isCollecting ? "受访者现在可以提交答卷" : "当前不会接收新的答卷"}
              </p>
            </div>
            <Button
              id="collect-enabled-switch"
              data-testid="collect-enabled-switch"
              type="button"
              role="switch"
              aria-checked={isCollecting}
              aria-label="启用回收"
              variant="secondary"
              size="icon"
              onClick={onToggleStatus}
              disabled={statusTogglePending}
              className={`h-6 w-11 shrink-0 rounded-full p-0 transition-colors ${
                isCollecting ? "justify-end bg-survey hover:bg-survey/90" : "justify-start bg-muted hover:bg-muted"
              }`}
            >
              <span className="mx-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform" />
            </Button>
          </div>
        </div>

        {message ? (
          <p
            role={feedbackIsSuccess ? "status" : "alert"}
            data-testid={feedbackIsSuccess ? "collect-settings-saved" : "err-collect-settings"}
            className={`mx-5 mt-5 rounded-lg border px-4 py-3 text-13 md:mx-6 ${
              feedbackIsSuccess
                ? "border-success/30 bg-tag-green text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive"
            }`}
          >
            {message}
          </p>
        ) : null}

        <div className="border-b border-border p-5 md:p-6">
          <h3 className="text-18 font-bold text-foreground">开放时间</h3>
          <p className="mt-1 text-13 text-muted-foreground">可立即开放，也可以设置指定的回收时间窗口。</p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="collect-publish-start">开始时间</Label>
                <label className="flex cursor-pointer items-center gap-2 text-12 font-medium text-foreground">
                  <Input
                    type="checkbox"
                    aria-label="立即开始"
                    checked={startImmediately}
                    onChange={(event) => updateStartImmediately(event.target.checked)}
                    className="h-4 w-4"
                  />
                  立即开始
                </label>
              </div>
              <Input
                id="collect-publish-start"
                type="datetime-local"
                value={publishStartAt}
                disabled={startImmediately}
                onChange={(event) => {
                  setStartImmediately(false);
                  onPublishStartAtChange(event.target.value);
                }}
                aria-describedby={invalidTimeRange ? "collect-time-error" : undefined}
              />
              <p className="text-12 text-muted-foreground">
                {startImmediately ? "保存后，启用回收即刻生效" : "到达该时间后开始接收答卷"}
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="collect-publish-end">结束时间</Label>
                <label className="flex cursor-pointer items-center gap-2 text-12 font-medium text-foreground">
                  <Input
                    type="checkbox"
                    aria-label="长期有效"
                    checked={noEndDate}
                    onChange={(event) => updateNoEndDate(event.target.checked)}
                    className="h-4 w-4"
                  />
                  长期有效
                </label>
              </div>
              <Input
                id="collect-publish-end"
                type="datetime-local"
                value={publishEndAt}
                disabled={noEndDate}
                onChange={(event) => {
                  setNoEndDate(false);
                  onPublishEndAtChange(event.target.value);
                }}
                aria-describedby={invalidTimeRange ? "collect-time-error" : undefined}
              />
              <p className="text-12 text-muted-foreground">
                {noEndDate ? "保持开放，直到手动暂停回收" : "到达该时间后自动停止接收"}
              </p>
            </div>
          </div>

          {invalidTimeRange ? (
            <p
              id="collect-time-error"
              role="alert"
              data-testid="err-collect-time"
              className="mt-3 text-12 text-destructive"
            >
              结束时间必须晚于开始时间
            </p>
          ) : null}
        </div>

        <div className="border-b border-border p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-15 font-bold text-foreground">问卷访问链接</h3>
              <p className="mt-1 text-12 text-muted-foreground">
                {isCollecting ? "链接已生效，可发送给受访者。" : "启用回收后将生成可访问的问卷链接"}
              </p>
            </div>
            {copied ? (
              <span role="status" className="flex items-center gap-1.5 text-12 font-semibold text-success">
                <Check className="h-4 w-4" strokeWidth={1.8} />
                已复制
              </span>
            ) : null}
          </div>
          <div className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 ${isCollecting ? "border-border bg-card" : "border-border bg-muted"}`}>
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
            <span className={`min-w-0 flex-1 truncate text-13 ${isCollecting ? "text-foreground" : "text-muted-foreground"}`}>
              {isCollecting ? shareUrl : "链接暂不可用"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="复制问卷链接"
              title="复制问卷链接"
              disabled={!isCollecting}
              onClick={() => void copyShareUrl()}
              className="h-8 w-8 transition-colors"
            >
              <Copy className="h-4 w-4" strokeWidth={1.6} />
            </Button>
          </div>
        </div>

        <details data-testid="collect-advanced-settings" className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-14 font-semibold text-foreground transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-6">
            <span className="flex flex-wrap items-center gap-2">
              <span>高级设置</span>
              <span className="text-12 font-normal text-muted-foreground">身份、提交次数与确认文案</span>
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={1.6} />
          </summary>

          <div className="grid gap-5 border-t border-border px-5 py-5 md:grid-cols-2 md:px-6">
            <div className="grid gap-2">
              <Label htmlFor="collect-response-mode">答题身份</Label>
              <Select
                id="collect-response-mode"
                value={responseMode}
                onChange={(event) => onResponseModeChange(event.target.value === "identified" ? "identified" : "anonymous")}
              >
                <option value="anonymous">匿名填写</option>
                <option value="identified">实名填写</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="collect-response-limit">答卷上限</Label>
              <Input
                id="collect-response-limit"
                type="number"
                min="1"
                placeholder="不限制"
                value={responseLimit}
                onChange={(event) => onResponseLimitChange(event.target.value)}
              />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-13 text-foreground md:col-span-2">
              <span>
                <span className="block font-semibold">每人仅可提交一次</span>
                <span className="mt-1 block text-12 text-muted-foreground">适合需要控制重复答卷的回收场景。</span>
              </span>
              <Input
                type="checkbox"
                aria-label="每人仅可提交一次"
                checked={oneResponsePerUser}
                onChange={(event) => onOneResponsePerUserChange(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="collect-confirmation-message">提交确认文案</Label>
              <Textarea
                id="collect-confirmation-message"
                value={confirmationMessage}
                onChange={(event) => onConfirmationMessageChange(event.target.value)}
                className="min-h-24"
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-end gap-2 p-5 md:p-6">
          <Button
            type="button"
            variant="outline"
            onClick={resetSettings}
            disabled={saving}
            className="transition-colors"
          >
            重置
          </Button>
          <Button
            data-testid="save-collect-settings"
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving || invalidTimeRange}
            className="min-w-28 transition-colors"
          >
            {saving ? "保存中" : "保存设置"}
          </Button>
        </div>
      </section>
    </div>
  );
}
