"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock3, History, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { SurveyReportGenerationStatus } from "@/lib/survey-report-generation";
import {
  isTemplateDrivenSurveyReport,
  type SurveyReportDocument,
} from "@/lib/survey-report-document";

interface SurveyReportVersionHistoryProps {
  generation?: SurveyReportGenerationStatus;
  report?: SurveyReportDocument;
  disabled?: boolean;
  onSelectVersion: (artifactId: string) => Promise<boolean>;
  onLoadMore: () => Promise<boolean>;
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
  disabled = false,
  onSelectVersion,
  onLoadMore,
}: SurveyReportVersionHistoryProps) {
  const [selectedVersionId, setSelectedVersionId] = useState(() => initialVersionId(generation));
  const [selectingVersionId, setSelectingVersionId] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
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
  const selectedSampleSize = report
    ? isTemplateDrivenSurveyReport(report)
      ? report.sample.responseCount
      : report.methodology.sampleSize
    : selectedVersion?.responseCount ?? 0;

  async function selectVersion(artifactId: string) {
    if (disabled || artifactId === selectedVersionId || selectingVersionId) return;
    setSelectingVersionId(artifactId);
    try {
      const loaded = await onSelectVersion(artifactId);
      if (loaded) setSelectedVersionId(artifactId);
    } finally {
      setSelectingVersionId("");
    }
  }

  async function loadMore() {
    if (disabled || selectingVersionId || loadingMore) return;
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div data-testid="report-version-history">
      <DropdownMenu
        align="end"
        testId="report-version-menu"
        trigger={({ open, onClick }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-expanded={open}
            onClick={onClick}
            className="h-9 gap-2 px-3"
          >
            <History className="h-4 w-4" strokeWidth={1.6} />
            <span>{selectedLabel}</span>
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        )}
      >
        <div className="min-w-72 px-2 py-2">
          <p className="text-12 font-semibold text-foreground">{selectedLabel}</p>
          <p className="mt-1 flex items-center gap-1 text-11 text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" strokeWidth={1.6} />
            {selectedTime ? formatVersionTime(selectedTime) : "尚未生成"}
            <span>· {selectedSampleSize} 份样本</span>
          </p>
        </div>
        <DropdownMenuSeparator />
        {versions.map((version, index) => {
          const selected = version.id === selectedVersion?.id;
          const selecting = version.id === selectingVersionId;
          return (
            <DropdownMenuItem
              key={version.id}
              onSelect={() => void selectVersion(version.id)}
              icon={
                selecting
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : selected
                    ? <Check className="h-4 w-4 text-success" />
                    : <Clock3 className="h-4 w-4 text-muted-foreground" />
              }
            >
              <span>
                <span className="block font-semibold">
                  版本 {versions.length - index}
                </span>
                <span className="block text-11 text-muted-foreground">
                  {formatVersionTime(version.createdAt)} · {version.responseCount} 份
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
        {generation?.nextHistoryCursor ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void loadMore()}
              icon={
                loadingMore
                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                  : <History className="h-4 w-4" />
              }
            >
              {loadingMore ? "正在加载" : "加载更早版本"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenu>
    </div>
  );
}
