import { posix } from "node:path";

const ALLOWED_ROOTS = ["/source/", "/workspace/", "/artifacts/"] as const;

export interface SurveyReportSourceSnapshotLike {
  surveyId: number;
  sourceRevision: string;
  contentHash: string;
  schemaVersion: string;
  generatedAt: string;
  responseCount: number;
  sourceData: Record<string, unknown>;
}

export interface SurveyReportWorkspaceFile {
  content: string;
  readOnly: boolean;
}

export interface SurveyReportWorkspace {
  files: Record<string, SurveyReportWorkspaceFile>;
}

export interface SurveyReportFileMatch {
  path: string;
  line: number;
  text: string;
}

function normalizeWorkspacePath(path: string): string {
  const segments = path.split("/");
  if (
    !path.startsWith("/") ||
    segments.includes("..") ||
    segments.includes(".") ||
    path.includes("\\")
  ) {
    throw new Error("survey_report_path_denied");
  }

  const normalized = posix.normalize(path);
  if (!ALLOWED_ROOTS.some((root) => normalized.startsWith(root))) {
    throw new Error("survey_report_path_denied");
  }
  return normalized;
}

function sourceRecords(snapshot: SurveyReportSourceSnapshotLike): unknown[] {
  const records = snapshot.sourceData.records;
  if (!Array.isArray(records)) {
    throw new Error("survey_report_source_invalid");
  }
  return records;
}

export function createSurveyReportWorkspace(
  snapshot: SurveyReportSourceSnapshotLike
): SurveyReportWorkspace {
  const records = sourceRecords(snapshot);
  const source = records.map((record) => JSON.stringify(record)).join("\n");
  const manifest = JSON.stringify({
    surveyId: snapshot.surveyId,
    sourceRevision: snapshot.sourceRevision,
    contentHash: snapshot.contentHash,
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    responseCount: snapshot.responseCount,
  });

  return {
    files: {
      "/source/manifest.json": { content: manifest, readOnly: true },
      "/source/survey-source.jsonl": { content: source, readOnly: true },
    },
  };
}

export function readSurveyReportFile(
  workspace: SurveyReportWorkspace,
  path: string
): string {
  const normalized = normalizeWorkspacePath(path);
  const file = workspace.files[normalized];
  if (!file) throw new Error("survey_report_file_not_found");
  return file.content;
}

export function grepSurveyReportFiles(
  workspace: SurveyReportWorkspace,
  query: string,
  prefix: "/source/" | "/workspace/" | "/artifacts/" = "/source/"
): SurveyReportFileMatch[] {
  const normalizedPrefix = normalizeWorkspacePath(prefix);
  if (!query) return [];

  return Object.entries(workspace.files)
    .filter(([path]) => path.startsWith(normalizedPrefix))
    .flatMap(([path, file]) =>
      file.content
        .split("\n")
        .map((text, index) => ({ path, line: index + 1, text }))
        .filter(({ text }) => text.includes(query))
    );
}

export function writeSurveyReportFile(
  workspace: SurveyReportWorkspace,
  path: string,
  content: string
): SurveyReportWorkspace {
  const normalized = normalizeWorkspacePath(path);
  if (normalized.startsWith("/source/")) {
    throw new Error("survey_report_source_read_only");
  }

  return {
    files: {
      ...workspace.files,
      [normalized]: {
        content,
        readOnly: false,
      },
    },
  };
}
