// new-adr.ts — ADR 编号原子取号 + scaffold（同 #660 phase-id 撞号收口的模式复用）。
// pnpm harness new-adr --title "<slug-title>" [--id ADR-NNN] [--layer methodology|project]
//
// 权威载体 = docs/adr/README.md 索引表：占号即登记（scaffold 文件的同一次运行里
// 把索引行写回 README.md），后到的在飞分支在 rebase/merge README.md 时自然看见
// 冲突，不再各自读同一句"新 ADR 从 X 起"的过期提示、各自挑号静默相撞
// （真实撞过：ADR-018 被 #778 与 #730 同时占用）。
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./lib/paths";
import { renderTemplateFile, nowISO } from "./lib/render";
import { adrIdFromFileName, adrIdNumber, findAdrIdConflicts, nextAdrId } from "./lib/adr-id";
import { req } from "./lib/args";
import { log, die } from "./lib/log";
import type { Args } from "./lib/args";

const ADR_DIR = join(REPO_ROOT, "docs", "adr");
const README_PATH = join(ADR_DIR, "README.md");
const TABLE_ROW_RE = /^\|\s*(ADR-\d+|\d{4})\s*\|/;

function readIndexedIds(readme: string): string[] {
  return readme
    .split("\n")
    .map((line) => TABLE_ROW_RE.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);
}

function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function newAdr(args: Args): void {
  const title = req(args, "title");
  const layer = args.opts["layer"]; // "methodology" | "project" | undefined
  if (layer !== undefined && layer !== "methodology" && layer !== "project") {
    die(`--layer 只接受 "methodology" 或 "project"，收到 "${layer}"。`);
  }

  const readme = readFileSync(README_PATH, "utf8");
  const indexedIds = readIndexedIds(readme);
  const adrFileNames = readdirSync(ADR_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

  // 自动取号必须同时看两个来源，理由见 lib/adr-id.ts nextAdrId 的注释：只看索引表
  // 会在"文件建了但索引表没登记"的孤儿文件场景下把号取重，自己变成新的孤儿文件
  // ——这恰恰是本模块要防的那类占用（coord-main review 抓到，2026-07-19）。
  const fileIds = adrFileNames.map(adrIdFromFileName).filter((x): x is string => x !== null);
  const allKnownIds = [...indexedIds, ...fileIds].filter((x) => adrIdNumber(x) !== null);

  let id: string;
  if (args.opts["id"]) {
    id = args.opts["id"]!;
    if (adrIdNumber(id) === null) die(`--id "${id}" 不是合法格式，应为 "ADR-NNN"（如 ADR-019）。`);
    const conflicts = findAdrIdConflicts(id, indexedIds, adrFileNames);
    if (conflicts.length) {
      die(`--id ${id} 已被占用: ${conflicts.join("；")}。` + `下一个可用: ${nextAdrId(allKnownIds)}`);
    }
  } else {
    id = nextAdrId(allKnownIds);
  }

  const slug = slugify(title);
  const fileName = `${id}-${slug}.md`;
  const filePath = join(ADR_DIR, fileName);

  const body = renderTemplateFile("adr.template.md", {
    ADR_ID: id,
    ADR_TITLE: title,
    CREATED_AT: nowISO(),
  });
  writeFileSync(filePath, body, "utf8");

  // 占号即登记：README.md 索引表插入新行（表格结尾，即第一个 "## " 二级标题前）。
  // 行格式跟随既有约定（id | 主题简述 | 状态）——主题栏先放 slug，人写正文时补全
  // 成真正的一句话描述；适用层不塞进这一行（历史行都没有），而是追加进下面
  // "## 适用层" 分类清单的对应 id 列表，同既有维护方式一致。
  const newRow = `| ${id} | ${slug}（写正文时补一句话主题描述） | Proposed |`;
  const lines = readme.split("\n");
  let insertAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && lines[i]!.startsWith("## ")) {
      insertAt = i;
      break;
    }
  }
  // 插在紧邻标题前的空行之前（保持表格与下一节之间原有的一个空行）
  while (insertAt > 0 && lines[insertAt - 1] === "") insertAt--;
  lines.splice(insertAt, 0, newRow);
  let updated = lines.join("\n");

  if (layer) {
    const bulletMarker = layer === "methodology" ? "**方法论（可移植）**" : "**项目实现（BoardX 专属）**";
    const idxOfBullet = updated.indexOf(bulletMarker);
    if (idxOfBullet === -1) {
      log.warn(`README.md 里没找到"${bulletMarker}"分类清单，--layer 未自动登记，请手动补一行 id。`);
    } else {
      const periodIdx = updated.indexOf("。", idxOfBullet);
      if (periodIdx === -1) {
        log.warn(`分类清单结尾格式异常（找不到句号），--layer 未自动登记，请手动补一行 id。`);
      } else {
        // 既有清单是紧凑写法：第一项带完整 "ADR-" 前缀，后续只写数字部分
        // （"0001、ADR-001、002、003..."）——追加时跟随这个约定，不重复前缀。
        const bareId = id.replace(/^ADR-/, "");
        updated = `${updated.slice(0, periodIdx)}、${bareId}${updated.slice(periodIdx)}`;
      }
    }
  }
  writeFileSync(README_PATH, updated, "utf8");

  log.ok(`已分配 ${id}，scaffold: docs/adr/${fileName}`);
  log.info(`README.md 索引表已登记（占号即登记，尽快连同正文一起提交，减少与其它在飞分支的冲突窗口）。`);
  log.info(`下一步：填写背景/决策/后果，README 索引行的主题描述占位符也一并补全。`);
  if (!layer) {
    log.info(`未指定 --layer——记得在正文头部标注适用层，并手动把 ${id} 加进 README 的"## 适用层"对应清单。`);
  }
}
