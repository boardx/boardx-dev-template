import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const roots = ["apps", "packages"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignored = new Set(["node_modules", ".next", "dist", "coverage"]);
const limit = Number(process.env.SOURCE_FILE_LINE_LIMIT ?? 2000);
const allowlist = new Set(
  (process.env.SOURCE_FILE_SIZE_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
);
const legacyLimits = new Map([
  ["apps/web/app/(app)/surveys/page.tsx", 8251],
  ["apps/web/components/board/board-canvas.tsx", 3291],
  ["apps/web/app/(app)/ava/page.tsx", 2984],
]);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = (await Promise.all(roots.map((directory) => collect(join(root, directory))))).flat();
const oversized = [];
for (const file of files) {
  const path = relative(root, file);
  if (allowlist.has(path)) continue;
  const lines = (await readFile(file, "utf8")).split(/\r?\n/).length;
  const legacyLimit = legacyLimits.get(path);
  if (legacyLimit != null && lines <= legacyLimit) continue;
  if (lines > limit) oversized.push({ path, lines });
}

if (oversized.length) {
  console.error(`Source files must stay at or below ${limit} lines:`);
  for (const item of oversized.sort((a, b) => b.lines - a.lines)) {
    console.error(`- ${item.path}: ${item.lines} lines`);
  }
  process.exit(1);
}

console.log(`Source file size check passed (${files.length} files, limit ${limit}; legacy files may only shrink).`);
