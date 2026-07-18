// packages/ai/src/index.ts — CAP-AI 包入口（P9 地基：网关 + 编排；P18 F01：真实 provider）
export * from "./gateway";
export * from "./anthropicProvider";
export * from "./qwenProvider";
// STT 转写能力（P18 F06：解开 p9-F09 ↔ p7-F10 循环阻塞）
export * from "./sttProvider";
export * from "./graph";
export * from "./avaSettings";
// Studio 生成器（P12 F01 地基）
export * from "./studioGenerator";
// 演示文稿生成器（P12 F02）
export * from "./presentationGenerator";
// Deep Research 真实生成（P18 F04）：替换 apps/web 里硬编码的 buildResearch()
export * from "./researchGenerator";
// 问卷报告 AI 摘要生成器（P13 F07）
export * from "./reportSummaryGenerator";
export * from "./surveyReportWorkspace";
