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
