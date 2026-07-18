"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, History, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SurveyReportGenerationStatus } from "@/lib/survey-report-generation";
import type { ProfessionalSurveyReportDocument } from "@/lib/survey-professional-report";

interface SurveyReportVersionHistoryProps {
  generation?: SurveyReportGenerationStatus;
  report?: ProfessionalSurveyReportDocument;
  onSelectVersion: (artifactId: string) => Promise<boolean>;
}

function formatVersionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialVersionId(generation?: SurveyReportGenerationStatus) {
  return generation?.currentArtifact?.id ?? generation?.latestArtifact?.id ?? "";
}

export function SurveyReportVersionHistory({
  generation,
  report,
  onSelectVersion,
}: SurveyReportVersionHistoryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState(() => initialVersionId(generation));
  const [selectingVersionId, setSelectingVersionId] = useState("");
  const defaultVersionId = initialVersionId(generation);
  const versions = generation?.versions ?? [];

  useEffect(() => {
    setSelectedVersionId(defaultVersionId);
  }, [defaultVersionId]);

  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId)
    ?? generation?.currentArtifact
    ?? generation?.latestArtifact;
  const selectedIndex = selectedVersion
    ? versions.findIndex((version) => version.id === selectedVersion.id)
    : -1;
  const selectedLabel = selectedIndex >= 0
    ? `版本 ${versions.length - selectedIndex}`
    : "报告预览";
  const selectedTime = report?.generatedAt ?? selectedVersion?.createdAt;
  const selectedSampleSize = report?.methodology.sampleSize ?? selectedVersion?.responseCount ?? 0;

  async function selectVersion(artifactId: string) {
    if (artifactId === selectedVersionId || selectingVersionId) return;
    setSelectingVersionId(artifactId);
    try {
      const loaded = await onSelectVersion(artifactId);
      if (loaded) setSelectedVersionId(artifactId);
    } finally {
      setSelectingVersionId("");
    }
  }

  return (
    <section data-testid="report-version-history" className="border border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
          <div>
            <h3 className="text-13 font-semibold text-foreground">报告版本</h3>
            <p className="mt-0.5 text-11 text-muted-foreground">选择后在当前分析报告中原样加载。</p>
          </div>
        </div>
        <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-end gap-2 text-11 text-muted-foreground">
          <Badge variant="success">当前查看</Badge>
          <span className="font-semibold text-foreground">{selectedLabel}</span>
          {selectedTime ? (
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" strokeWidth={1.6} />
              {formatVersionTime(selectedTime)}
            </span>
          ) : null}
          <span>{selectedSampleSize} 份样本</span>
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto bg-border">
        {versions.length ? versions.map((version, index) => {
          const selected = version.id === selectedVersion?.id;
          const selecting = version.id === selectingVersionId;
          return (
            <button
              key={version.id}
              type="button"
              aria-current={selected ? "true" : undefined}
              disabled={Boolean(selectingVersionId)}
              className="flex w-full items-center justify-between gap-3 border-b border-border bg-background px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary disabled:cursor-wait disabled:bg-disabled disabled:text-disabled-foreground"
              onClick={() => void selectVersion(version.id)}
            >
              <span>
                <span className="block text-12 font-semibold text-foreground">
                  版本 {versions.length - index}
                </span>
                <span className="mt-0.5 block text-11 text-muted-foreground">
                  {formatVersionTime(version.createdAt)} · {version.responseCount} 份样本
                </span>
              </span>
              {selecting ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" aria-label="正在加载版本" />
              ) : selected ? (
                <span className="flex items-center gap-1 text-11 font-semibold text-success">
                  <Check className="h-4 w-4" strokeWidth={1.8} />
                  当前
                </span>
              ) : null}
            </button>
          );
        }) : (
          <p className="bg-background px-5 py-4 text-12 text-muted-foreground">生成报告后可在这里切换不可变版本。</p>
        )}
      </div>
    </section>
  );
}
