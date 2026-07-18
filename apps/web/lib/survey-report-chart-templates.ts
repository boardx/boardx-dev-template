import type { SurveyReportChartTemplateId } from "@repo/data";

export interface SurveyReportChartTemplate {
  id: SurveyReportChartTemplateId;
  label: string;
  description: string;
  sourceUrl: string;
  option: Record<string, unknown>;
}

const sourceUrl = (id: SurveyReportChartTemplateId) =>
  `https://echarts.apache.org/examples/zh/editor.html?c=${id}`;

const heatmapHours = [
  "12a", "1a", "2a", "3a", "4a", "5a", "6a", "7a", "8a", "9a", "10a", "11a",
  "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p", "10p", "11p",
];
const heatmapDays = ["Saturday", "Friday", "Thursday", "Wednesday", "Tuesday", "Monday", "Sunday"];
const heatmapData = [
  [0, 0, 5], [0, 1, 1], [0, 2, 0], [0, 3, 0], [0, 4, 0], [0, 5, 0], [0, 6, 0], [0, 7, 0],
  [0, 8, 0], [0, 9, 0], [0, 10, 0], [0, 11, 2], [0, 12, 4], [0, 13, 1], [0, 14, 1], [0, 15, 3],
  [0, 16, 4], [0, 17, 6], [0, 18, 4], [0, 19, 4], [0, 20, 3], [0, 21, 3], [0, 22, 2], [0, 23, 5],
  [1, 0, 7], [1, 1, 0], [1, 2, 0], [1, 3, 0], [1, 4, 0], [1, 5, 0], [1, 6, 0], [1, 7, 0],
  [1, 8, 0], [1, 9, 0], [1, 10, 5], [1, 11, 2], [1, 12, 2], [1, 13, 6], [1, 14, 9], [1, 15, 11],
  [1, 16, 6], [1, 17, 7], [1, 18, 8], [1, 19, 12], [1, 20, 5], [1, 21, 5], [1, 22, 7], [1, 23, 2],
  [2, 0, 1], [2, 1, 1], [2, 2, 0], [2, 3, 0], [2, 4, 0], [2, 5, 0], [2, 6, 0], [2, 7, 0],
  [2, 8, 0], [2, 9, 0], [2, 10, 3], [2, 11, 2], [2, 12, 1], [2, 13, 9], [2, 14, 8], [2, 15, 10],
  [2, 16, 6], [2, 17, 5], [2, 18, 5], [2, 19, 5], [2, 20, 7], [2, 21, 4], [2, 22, 2], [2, 23, 4],
  [3, 0, 7], [3, 1, 3], [3, 2, 0], [3, 3, 0], [3, 4, 0], [3, 5, 0], [3, 6, 0], [3, 7, 0],
  [3, 8, 1], [3, 9, 0], [3, 10, 5], [3, 11, 4], [3, 12, 7], [3, 13, 14], [3, 14, 13], [3, 15, 12],
  [3, 16, 9], [3, 17, 5], [3, 18, 5], [3, 19, 10], [3, 20, 6], [3, 21, 4], [3, 22, 4], [3, 23, 1],
  [4, 0, 1], [4, 1, 3], [4, 2, 0], [4, 3, 0], [4, 4, 0], [4, 5, 1], [4, 6, 0], [4, 7, 0],
  [4, 8, 0], [4, 9, 2], [4, 10, 4], [4, 11, 4], [4, 12, 2], [4, 13, 4], [4, 14, 4], [4, 15, 14],
  [4, 16, 12], [4, 17, 1], [4, 18, 8], [4, 19, 5], [4, 20, 3], [4, 21, 7], [4, 22, 3], [4, 23, 0],
  [5, 0, 2], [5, 1, 1], [5, 2, 0], [5, 3, 3], [5, 4, 0], [5, 5, 0], [5, 6, 0], [5, 7, 0],
  [5, 8, 2], [5, 9, 0], [5, 10, 4], [5, 11, 1], [5, 12, 5], [5, 13, 10], [5, 14, 5], [5, 15, 7],
  [5, 16, 11], [5, 17, 6], [5, 18, 0], [5, 19, 5], [5, 20, 3], [5, 21, 4], [5, 22, 2], [5, 23, 0],
  [6, 0, 1], [6, 1, 0], [6, 2, 0], [6, 3, 0], [6, 4, 0], [6, 5, 0], [6, 6, 0], [6, 7, 0],
  [6, 8, 0], [6, 9, 0], [6, 10, 1], [6, 11, 0], [6, 12, 2], [6, 13, 1], [6, 14, 3], [6, 15, 4],
  [6, 16, 0], [6, 17, 0], [6, 18, 0], [6, 19, 0], [6, 20, 1], [6, 21, 2], [6, 22, 2], [6, 23, 6],
];

export const SURVEY_REPORT_CHART_TEMPLATES: readonly SurveyReportChartTemplate[] = [
  {
    id: "line-simple",
    label: "Simple line",
    description: "A basic category line chart for showing change over an ordered sequence.",
    sourceUrl: sourceUrl("line-simple"),
    option: {
      xAxis: {
        type: "category",
        data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
      yAxis: { type: "value" },
      series: [{
        data: [150, 230, 224, 218, 135, 147, 260],
        type: "line",
      }],
    },
  },
  {
    id: "bar-simple",
    label: "Simple bar",
    description: "A basic category bar chart for comparing discrete values.",
    sourceUrl: sourceUrl("bar-simple"),
    option: {
      xAxis: {
        type: "category",
        data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      },
      yAxis: { type: "value" },
      series: [{
        data: [120, 200, 150, 80, 70, 110, 130],
        type: "bar",
      }],
    },
  },
  {
    id: "pie-simple",
    label: "Simple pie",
    description: "A basic pie chart for showing parts of a whole.",
    sourceUrl: sourceUrl("pie-simple"),
    option: {
      title: {
        text: "Referer of a Website",
        subtext: "Fake Data",
        left: "center",
      },
      tooltip: { trigger: "item" },
      legend: { orient: "vertical", left: "left" },
      series: [{
        name: "Access From",
        type: "pie",
        radius: "50%",
        data: [
          { value: 1048, name: "Search Engine" },
          { value: 735, name: "Direct" },
          { value: 580, name: "Email" },
          { value: 484, name: "Union Ads" },
          { value: 300, name: "Video Ads" },
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      }],
    },
  },
  {
    id: "scatter-simple",
    label: "Simple scatter",
    description: "A basic scatter chart for showing relationships between two numeric dimensions.",
    sourceUrl: sourceUrl("scatter-simple"),
    option: {
      xAxis: {},
      yAxis: {},
      series: [{
        symbolSize: 20,
        data: [
          [10.0, 8.04], [8.0, 6.95], [13.0, 7.58], [9.0, 8.81], [11.0, 8.33],
          [14.0, 9.96], [6.0, 7.24], [4.0, 4.26], [12.0, 10.84], [7.0, 4.82], [5.0, 5.68],
        ],
        type: "scatter",
      }],
    },
  },
  {
    id: "radar",
    label: "Radar",
    description: "A multi-axis radar chart for comparing several dimensions at once.",
    sourceUrl: sourceUrl("radar"),
    option: {
      radar: {
        axisName: {
          width: 5,
          overflow: "truncate",
        },
        indicator: [
          { name: "Sales", max: 6500 },
          { name: "Administration", max: 16000 },
          { name: "Information Technology", max: 30000 },
          { name: "Customer Support", max: 38000 },
          { name: "Development", max: 52000 },
          { name: "Marketing", max: 25000 },
        ],
      },
      series: [{
        name: "Budget vs spending",
        type: "radar",
        data: [
          {
            value: [4200, 3000, 20000, 35000, 50000, 18000],
            name: "Allocated Budget",
          },
          {
            value: [5000, 14000, 28000, 26000, 42000, 21000],
            name: "Actual Spending",
          },
        ],
      }],
    },
  },
  {
    id: "funnel",
    label: "Funnel",
    description: "A funnel chart for showing conversion or progressive drop-off stages.",
    sourceUrl: sourceUrl("funnel"),
    option: {
      title: { text: "Funnel" },
      tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c}%" },
      legend: { data: ["Show", "Click", "Visit", "Inquiry", "Order"] },
      series: [{
        name: "Funnel",
        type: "funnel",
        left: "10%",
        top: 60,
        bottom: 60,
        width: "80%",
        min: 0,
        max: 100,
        minSize: "0%",
        maxSize: "100%",
        sort: "descending",
        gap: 2,
        label: { show: true, position: "inside" },
        labelLine: { length: 10, lineStyle: { width: 1, type: "solid" } },
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        emphasis: { label: { fontSize: 20 } },
        data: [
          { value: 60, name: "Visit" },
          { value: 40, name: "Inquiry" },
          { value: 20, name: "Order" },
          { value: 80, name: "Click" },
          { value: 100, name: "Show" },
        ],
      }],
    },
  },
  {
    id: "gauge",
    label: "Gauge",
    description: "A compact gauge for presenting one current score or progress value.",
    sourceUrl: sourceUrl("gauge"),
    option: {
      series: [{
        type: "gauge",
        progress: { show: true },
        detail: { valueAnimation: true, formatter: "{value}" },
        data: [{ value: 50 }],
      }],
    },
  },
  {
    id: "heatmap-cartesian",
    label: "Cartesian heatmap",
    description: "A category-by-category heatmap for locating intensity across two dimensions.",
    sourceUrl: sourceUrl("heatmap-cartesian"),
    option: {
      grid: { height: "50%", top: "10%" },
      xAxis: { type: "category", data: heatmapHours, splitArea: { show: true } },
      yAxis: { type: "category", data: heatmapDays, splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: 10,
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: "15%",
      },
      series: [{
        name: "Punch Card",
        type: "heatmap",
        data: heatmapData,
        label: { show: true },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" } },
      }],
    },
  },
];

export function getSurveyReportChartTemplate(
  id: SurveyReportChartTemplateId,
): SurveyReportChartTemplate {
  const template = SURVEY_REPORT_CHART_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(`Unknown survey report chart template: ${id}`);
  }
  return template;
}

export function stringifySurveyReportChartOption(id: SurveyReportChartTemplateId): string {
  return JSON.stringify(getSurveyReportChartTemplate(id).option);
}
