export interface ReportExportSection {
  title: string;
  subtitle?: string;
  blocks?: string[];
  findings?: string[];
  modules?: Array<{
    type: "chart" | "text" | "image";
    title: string;
    body?: string;
    imageUrl?: string;
    items?: string[];
    rows?: Array<{ label: string; value: number }>;
  }>;
}

export interface ReportExportPayload {
  title: string;
  subtitle?: string;
  filenameBase: string;
  meta: Array<[string, string]>;
  sections: ReportExportSection[];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeFilename(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-");
  return normalized || "survey-report";
}

function collectDocumentCss() {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

function cloneElementWithRenderedCanvases(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  const sourceCanvases = Array.from(element.querySelectorAll("canvas"));
  const clonedCanvases = Array.from(clone.querySelectorAll("canvas"));
  sourceCanvases.forEach((canvas, index) => {
    const target = clonedCanvases[index];
    if (!target) return;
    try {
      const image = document.createElement("img");
      image.src = canvas.toDataURL("image/png");
      image.width = canvas.offsetWidth || canvas.width;
      image.height = canvas.offsetHeight || canvas.height;
      image.style.cssText = target.getAttribute("style") ?? "";
      image.style.maxWidth = "100%";
      image.style.display = "block";
      target.replaceWith(image);
    } catch {
      // Keep the canvas when the browser cannot serialize it.
    }
  });
  return clone;
}

function visualReportHtml(element: HTMLElement, title: string, exportWidth = 760) {
  const clone = cloneElementWithRenderedCanvases(element);
  clone.classList.add("visual-export-source");
  const width = Math.min(exportWidth, Math.ceil(element.scrollWidth || element.getBoundingClientRect().width || exportWidth));
  const css = collectDocumentCss();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; background: #f5f5f5; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
    }
    .visual-export-page {
      width: ${width}px;
      max-width: none;
      margin: 0 auto;
      background: #ffffff;
    }
    .visual-export-source {
      width: ${width}px;
      max-width: none !important;
      margin: 0 !important;
      box-shadow: none !important;
      overflow-x: hidden !important;
      overflow-wrap: anywhere;
    }
    .visual-export-source * {
      min-width: 0 !important;
      max-width: 100% !important;
    }
    .visual-export-source img,
    .visual-export-source canvas,
    .visual-export-source svg {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
    }
    .visual-export-source [class*="lg:grid-cols-2"],
    .visual-export-source [class*="md:grid-cols-2"] {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    @media print {
      html, body { background: #ffffff; }
      .visual-export-page {
        width: 100%;
        max-width: none;
      }
      .visual-export-source {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main class="visual-export-page">${clone.outerHTML}</main>
</body>
</html>`;
}

function buildReportHtml(payload: ReportExportPayload) {
  const metaRows = payload.meta
    .map(([label, value]) => `
      <tr>
        <th>${escapeHtml(label)}</th>
        <td>${escapeHtml(value)}</td>
      </tr>
    `)
    .join("");
  const sectionHtml = payload.sections
    .map((section, index) => {
      const blocks = (section.blocks ?? [])
        .map((block) => `<li>${escapeHtml(block)}</li>`)
        .join("");
      const findings = (section.findings ?? [])
        .map((finding) => `<li>${escapeHtml(finding)}</li>`)
        .join("");
      const modules = (section.modules ?? [])
        .map((module) => {
          const maxValue = Math.max(...(module.rows ?? []).map((row) => row.value), 1);
          const rows = (module.rows ?? [])
            .map((row, rowIndex) => `
              <div class="chart-row">
                <span class="chart-label">${escapeHtml(row.label)}</span>
                <span class="chart-bar"><span style="width:${Math.max(4, Math.min(100, Math.round((row.value / maxValue) * 100)))}%"></span></span>
                <strong class="chart-value">${escapeHtml(String(row.value))}</strong>
                <span class="chart-rank">#${rowIndex + 1}</span>
              </div>
            `)
            .join("");
          const items = (module.items ?? [])
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join("");
          return `
            <div class="report-module">
              <p class="module-type">${escapeHtml(module.type)}</p>
              <h3>${escapeHtml(module.title)}</h3>
              ${module.body ? `<p class="module-body">${escapeHtml(module.body)}</p>` : ""}
              ${module.imageUrl ? `<img class="report-image" src="${escapeHtml(module.imageUrl)}" alt="${escapeHtml(module.title)}" />` : ""}
              ${items ? `<ul>${items}</ul>` : ""}
              ${rows ? `<div class="chart-block">${rows}</div>` : ""}
            </div>
          `;
        })
        .join("");
      return `
        <section class="report-section">
          <p class="section-index">SECTION ${String(index + 1).padStart(2, "0")}</p>
          <h2>${escapeHtml(section.title)}</h2>
          ${section.subtitle ? `<p class="section-subtitle">${escapeHtml(section.subtitle)}</p>` : ""}
          ${modules ? `<div class="module-grid">${modules}</div>` : ""}
          ${blocks ? `<h3>分析内容</h3><ul>${blocks}</ul>` : ""}
          ${findings ? `<h3>关键结论</h3><ul>${findings}</ul>` : ""}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.title)}</title>
  <style>
    @page { margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #171717;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif;
      line-height: 1.65;
    }
    .report {
      max-width: 1120px;
      margin: 0 auto;
      padding: 0;
    }
    .cover {
      border: 1px solid #d4d4d4;
      border-radius: 8px;
      padding: 28px 32px;
      background: #171717;
      color: #ffffff;
    }
    .kicker {
      margin: 0 0 16px;
      color: #c7c7c7;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: 32px;
      line-height: 1.2;
    }
    .subtitle {
      max-width: 720px;
      margin: 16px 0 0;
      color: #d4d4d4;
      font-size: 14px;
    }
    table {
      width: 100%;
      margin-top: 18px;
      border-collapse: collapse;
      background: #ffffff;
      color: #171717;
    }
    th,
    td {
      border: 1px solid #e5e5e5;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      font-size: 13px;
    }
    th {
      width: 180px;
      background: #f5f5f5;
      font-weight: 700;
    }
    .report-section {
      break-inside: auto;
      page-break-inside: auto;
      margin-top: 18px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 22px;
    }
    .module-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 18px;
    }
    .report-module {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 0;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 16px;
      background: #fafafa;
    }
    .report-image {
      display: block;
      width: 100%;
      max-height: 420px;
      margin-top: 12px;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      object-fit: cover;
    }
    .module-type {
      float: right;
      margin: 0;
      color: #737373;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .module-body {
      margin: 8px 0 0;
      color: #525252;
      font-size: 13px;
    }
    .chart-block {
      display: grid;
      gap: 10px;
      margin-top: 14px;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
    }
    .chart-row {
      display: grid;
      grid-template-columns: 96px minmax(120px, 1fr) 44px 32px;
      align-items: center;
      gap: 10px;
      color: #525252;
      font-size: 12px;
    }
    .chart-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chart-value {
      color: #171717;
      text-align: right;
      font-weight: 700;
    }
    .chart-rank {
      color: #737373;
      text-align: right;
    }
    .chart-bar {
      display: block;
      height: 9px;
      border-radius: 999px;
      background: #f0f0f0;
      overflow: hidden;
    }
    .chart-bar span {
      display: block;
      height: 100%;
      background: #171717;
    }
    .section-index {
      margin: 0 0 8px;
      color: #737373;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.14em;
    }
    h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.35;
    }
    h3 {
      margin: 18px 0 8px;
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .section-subtitle {
      margin: 8px 0 0;
      color: #525252;
      font-size: 13px;
    }
    ul {
      margin: 8px 0 0;
      padding-left: 20px;
    }
    li {
      margin: 6px 0;
      font-size: 13px;
    }
    @media screen {
      body {
        background: #f5f5f5;
      }
      .report {
        padding: 28px;
      }
    }
    @media print {
      .report {
        max-width: none;
        padding: 0;
      }
      .cover,
      .report-section {
        border-radius: 0;
      }
      .report-module {
        border-radius: 6px;
      }
    }
    @media (max-width: 800px) {
      .module-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main class="report">
    <section class="cover">
      <p class="kicker">Final Research Report</p>
      <h1>${escapeHtml(payload.title)}</h1>
      ${payload.subtitle ? `<p class="subtitle">${escapeHtml(payload.subtitle)}</p>` : ""}
    </section>
    <table>${metaRows}</table>
    ${sectionHtml}
  </main>
</body>
</html>`;
}

function chartRowsFromOption(option: Record<string, unknown>) {
  const series = Array.isArray(option.series)
    ? option.series[0] as Record<string, unknown> | undefined
    : undefined;
  const seriesData = Array.isArray(series?.data) ? series.data : [];
  const namedRows = seriesData.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.name === "string" && Number.isFinite(Number(row.value))
      ? [{ label: row.name, value: Number(row.value) }]
      : [];
  });
  if (namedRows.length) return namedRows;

  const xAxis = option.xAxis && typeof option.xAxis === "object"
    ? option.xAxis as Record<string, unknown>
    : undefined;
  const labels = Array.isArray(xAxis?.data) ? xAxis.data.map(String) : [];
  return seriesData.flatMap((value, index) =>
    Number.isFinite(Number(value))
      ? [{ label: labels[index] ?? String(index + 1), value: Number(value) }]
      : []
  );
}

function buildTemplateDrivenReportHtml(
  report: Extract<SurveyReportDocument, { schemaVersion: string }>
) {
  const generatedAt = new Date(report.generatedAt).toLocaleString("zh-CN", {
    hour12: false,
  });
  const chapters = report.chapters.map((chapter, index) => {
    if (isTemplateDrivenReportFrameworkChapter(chapter)) {
      return `
        <section class="chapter">
          <p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${escapeHtml(
            chapter.outputType === "chart"
              ? "数据图表"
              : chapter.outputType === "image"
                ? "研究视觉"
                : "分析结论"
          )}</p>
          <h2>${escapeHtml(chapter.title)}</h2>
          <p>生成要求：${escapeHtml(chapter.requirement)}</p>
          <p class="framework">等待真实答卷后生成本章节内容。</p>
        </section>
      `;
    }
    let output = "";
    if (chapter.outputType === "text") {
      output = `
        <h3>${escapeHtml(chapter.headline)}</h3>
        ${chapter.body.split(/\n{2,}/).filter(Boolean).map(
          (paragraph) => `<p>${escapeHtml(paragraph)}</p>`
        ).join("")}
      `;
    } else if (chapter.outputType === "chart") {
      const rows = chartRowsFromOption(chapter.option);
      output = `
        <div class="chart">
          ${rows.map((row) => `
            <div class="bar-row">
              <span>${escapeHtml(row.label)}</span>
              <strong>${row.value}</strong>
            </div>
          `).join("")}
        </div>
        <p>${escapeHtml(chapter.interpretation)}</p>
        <small>有效回答 n=${chapter.sampleSize}</small>
      `;
    } else {
      output = `
        <figure>
          <img src="${escapeHtml(chapter.assetUrl)}" alt="${escapeHtml(chapter.altText)}" />
          <figcaption>${escapeHtml(chapter.caption)}</figcaption>
        </figure>
      `;
    }
    return `
      <section class="chapter">
        <p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${escapeHtml(
          chapter.outputType === "chart"
            ? "数据图表"
            : chapter.outputType === "image"
              ? "研究视觉"
              : "分析结论"
        )}</p>
        <h2>${escapeHtml(chapter.title)}</h2>
        ${output}
        ${chapter.limitations.length
          ? `<p class="limitation">解读限制：${escapeHtml(chapter.limitations.join(" "))}</p>`
          : ""}
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm 18mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; color: #171717; background: #fff; font: 13px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
    main { max-width: 180mm; margin: 0 auto; }
    .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding: 18mm 12mm; color: #fff; background: #171717; break-after: page; }
    .kicker, .eyebrow { margin: 0; color: #737373; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .kicker { color: #d4d4d4; }
    h1 { max-width: 145mm; margin: 22mm 0 0; font-size: 34px; line-height: 1.25; }
    h2 { margin: 4px 0 8mm; font-size: 22px; line-height: 1.35; }
    h3 { margin: 0 0 4mm; font-size: 16px; }
    .cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #525252; }
    .cover-meta div { padding: 12px; background: #262626; }
    .cover-meta span { display: block; color: #a3a3a3; font-size: 10px; }
    .cover-meta strong { display: block; margin-top: 4px; font-size: 15px; }
    .chapter { padding: 12mm 0; break-before: page; }
    .chart { margin: 5mm 0; border-top: 1px solid #d4d4d4; }
    .bar-row { display: grid; grid-template-columns: 1fr 24mm; gap: 4mm; padding: 3mm 0; border-bottom: 1px solid #ededed; }
    .bar-row strong { text-align: right; }
    figure { margin: 0; }
    figure img { display: block; width: 100%; max-height: 118mm; object-fit: cover; }
    figcaption, small { display: block; margin-top: 3mm; color: #737373; font-size: 10px; }
    .framework { margin-top: 6mm; padding: 10mm 6mm; color: #737373; border: 1px dashed #d4d4d4; text-align: center; }
    .limitation { margin-top: 6mm; padding: 3mm 4mm; color: #525252; background: #f5f5f5; font-size: 11px; }
    @media screen { body { background: #ededed; } main { padding: 24px; background: #fff; } .cover { min-height: 900px; } }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <div><p class="kicker">BoardX Survey Research Report</p><h1>${escapeHtml(report.title)}</h1></div>
      <div class="cover-meta">
        <div><span>有效样本</span><strong>${report.sample.responseCount} 份</strong></div>
        <div><span>模板章节</span><strong>${report.chapters.length} 个</strong></div>
        <div><span>生成时间</span><strong>${escapeHtml(generatedAt)}</strong></div>
      </div>
    </section>
    ${chapters}
  </main>
</body>
</html>`;
}

export function buildProfessionalReportHtml(report: SurveyReportDocument) {
  if (isTemplateDrivenSurveyReport(report)) {
    return buildTemplateDrivenReportHtml(report);
  }
  const claims = report.executiveSummary.claims.map((claim) => `
    <article class="claim">
      <p>${escapeHtml(claim.statement)}</p>
      <small>证据：${claim.value}/${claim.denominator}${claim.directional ? " · 方向性结论" : ""}</small>
    </article>
  `).join("");
  const chapters = report.chapters.map((chapter, index) => {
    const chartRows = chapter.chart?.rows.map((row) => `
      <div class="bar-row">
        <span>${escapeHtml(row.label)}</span>
        <i><b style="width:${Math.max(0, Math.min(100, row.percentage))}%"></b></i>
        <strong>${row.count} · ${row.percentage}%</strong>
      </div>
    `).join("") ?? "";
    return `
      <section class="chapter">
        <p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${escapeHtml(
          chapter.outputType === "chart"
            ? "图表章节"
            : chapter.outputType === "image"
              ? "图片章节"
              : "文本章节"
        )}</p>
        <div class="chapter-title"><h2>${escapeHtml(chapter.title)}</h2><span>有效回答 n=${chapter.validResponseCount}</span></div>
        ${chapter.requirement ? `<p>${escapeHtml(`生成要求：${chapter.requirement}`)}</p>` : ""}
        ${chapter.outputType === "chart" && chartRows ? `<div class="chart">${chapter.chartTemplateId ? `<p>${escapeHtml(`ECharts 模板：${chapter.chartTemplateId}`)}</p>` : ""}${chartRows}<footer>数据来源：真实问卷答卷 · ${escapeHtml(chapter.chart!.denominatorLabel)} n=${chapter.chart!.denominator}</footer></div>` : ""}
        ${chapter.outputType === "image" && chapter.imagePrompt ? `<p class="limitation">${escapeHtml(`图片生成约束：${chapter.imagePrompt}`)}</p>` : ""}
        ${chapter.limitations.length ? `<p class="limitation">限制：${escapeHtml(chapter.limitations.join(" "))}</p>` : ""}
      </section>
    `;
  }).join("");
  const limitations = report.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const generatedAt = new Date(report.generatedAt).toLocaleString("zh-CN", { hour12: false });
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm 18mm; @bottom-left { content: "BoardX Survey · 保密"; color: #737373; font-size: 9px; } @bottom-right { content: "第 " counter(page) " 页"; color: #737373; font-size: 9px; } }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; color: #171717; background: #fff; font: 13px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
    main { max-width: 180mm; margin: 0 auto; }
    .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding: 18mm 12mm; color: #fff; background: #171717; break-after: page; }
    .cover .kicker, .eyebrow { margin: 0; color: #737373; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .cover .kicker { color: #d4d4d4; }
    h1 { max-width: 145mm; margin: 22mm 0 0; font-size: 34px; line-height: 1.25; }
    .cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #525252; }
    .cover-meta div { padding: 12px; background: #262626; }
    .cover-meta span { display: block; color: #a3a3a3; font-size: 10px; }
    .cover-meta strong { display: block; margin-top: 4px; font-size: 15px; }
    section { padding: 12mm 0; }
    .summary { break-after: page; }
    h2 { margin: 4px 0 0; font-size: 22px; line-height: 1.35; }
    .claim { display: grid; grid-template-columns: 1fr 45mm; gap: 10mm; padding: 12px 0; border-bottom: 1px solid #e5e5e5; }
    .claim p { margin: 0; font-size: 15px; font-weight: 650; }
    .claim small { color: #737373; }
    .chapter { break-before: page; }
    .chapter-title { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 8mm; }
    .chapter-title span { color: #737373; font-size: 11px; }
    .chart { padding: 6mm 0; border-top: 1px solid #d4d4d4; border-bottom: 1px solid #d4d4d4; }
    .bar-row { display: grid; grid-template-columns: 38mm 1fr 28mm; align-items: center; gap: 4mm; margin: 3mm 0; }
    .bar-row i { height: 4mm; overflow: hidden; background: #ededed; }
    .bar-row b { display: block; height: 100%; background: #3157c8; }
    .bar-row strong { text-align: right; font-size: 11px; }
    .chart footer { margin-top: 5mm; padding-top: 3mm; border-top: 1px solid #ededed; color: #737373; font-size: 10px; }
    blockquote { margin: 3mm 0; padding-left: 4mm; border-left: 2px solid #a3a3a3; color: #525252; }
    .limitation { margin-top: 6mm; padding: 3mm 4mm; color: #525252; background: #f5f5f5; font-size: 11px; }
    .methodology { break-before: page; }
    .methodology dl { display: grid; grid-template-columns: 42mm 1fr; margin-top: 8mm; border-top: 1px solid #d4d4d4; }
    .methodology dt, .methodology dd { margin: 0; padding: 3mm 0; border-bottom: 1px solid #e5e5e5; }
    .methodology dt { color: #737373; }
    ul { padding-left: 18px; }
    @media screen { body { background: #ededed; } main { padding: 24px; background: #fff; } .cover { min-height: 900px; } }
  </style>
</head>
<body>
  <main>
    <section class="cover">
      <div><p class="kicker">BoardX Survey Research Report</p><h1>${escapeHtml(report.title)}</h1></div>
      <div class="cover-meta">
        <div><span>有效样本</span><strong>${report.methodology.sampleSize} 份</strong></div>
        <div><span>问题数量</span><strong>${report.methodology.questionCount} 题</strong></div>
        <div><span>生成时间</span><strong>${escapeHtml(generatedAt)}</strong></div>
      </div>
    </section>
    <section class="summary"><p class="eyebrow">Executive Summary</p><h2>执行摘要</h2>${report.emptyState ? `<p>${escapeHtml(report.emptyState)}</p>` : claims}</section>
    ${chapters}
    <section class="methodology"><p class="eyebrow">Methodology & Limitations</p><h2>方法与限制</h2><dl><dt>样本量</dt><dd>${report.methodology.sampleSize} 份</dd><dt>统计口径</dt><dd>${escapeHtml(report.methodology.statement)}</dd><dt>数据来源</dt><dd>真实问卷答卷</dd></dl><ul>${limitations || "<li>未识别额外样本限制。</li>"}</ul></section>
  </main>
</body>
</html>`;
}

export function openProfessionalPdfExportWindow(report: SurveyReportDocument) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildProfessionalReportHtml(report));
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 400);
  return true;
}

export function downloadProfessionalWordReport(report: SurveyReportDocument) {
  const blob = new Blob(["\ufeff", buildProfessionalReportHtml(report)], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(report.title)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadWordReport(payload: ReportExportPayload) {
  const html = buildReportHtml(payload);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(payload.filenameBase)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPdfExportWindow(payload: ReportExportPayload) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(buildReportHtml(payload));
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
  }, 300);
  return true;
}

export function openVisualPdfExportWindow(element: HTMLElement, title: string) {
  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(visualReportHtml(element, title));
  win.document.close();
  win.focus();
  win.setTimeout(() => {
    win.print();
  }, 500);
  return true;
}

export function downloadVisualWordReport(element: HTMLElement, title: string, filenameBase: string) {
  const html = visualReportHtml(element, title, 760);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(filenameBase)}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadVisualPngReport(element: HTMLElement, filenameBase: string) {
  const clone = cloneElementWithRenderedCanvases(element);
  const sourceWidth = Math.ceil(element.scrollWidth || element.getBoundingClientRect().width || 1200);
  const width = Math.min(sourceWidth, 1400);
  clone.style.width = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  const height = Math.ceil(element.scrollHeight * (width / Math.max(sourceWidth, 1)) || element.getBoundingClientRect().height || 800);
  const css = collectDocumentCss();
  const xhtml = `
    <style>${css}</style>
    <style>
      * { box-sizing: border-box; }
      .visual-export-source {
        width: ${width}px;
        max-width: none !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow-x: hidden !important;
      }
      .visual-export-source * {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .visual-export-source img,
      .visual-export-source canvas,
      .visual-export-source svg {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
      }
    </style>
    <div xmlns="http://www.w3.org/1999/xhtml" class="visual-export-source">${clone.innerHTML}</div>
  `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${xhtml}</foreignObject>
    </svg>
  `;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = svgUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(filenameBase)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
import {
  isTemplateDrivenSurveyReport,
  type SurveyReportDocument,
} from "./survey-report-document";
import { isTemplateDrivenReportFrameworkChapter } from "./survey-template-report";
