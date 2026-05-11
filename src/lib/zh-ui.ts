/** 中文界面：将内部枚举值映射为展示文案 */

export function severityLabel(severity: string): string {
  switch (severity) {
    case "critical":
      return "严重";
    case "warning":
      return "警告";
    case "info":
      return "提示";
    default:
      return severity;
  }
}

export function analysisStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "排队中";
    case "crawling":
      return "抓取中";
    case "analyzing":
      return "分析中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

const KEYWORD_LOC_MAP: Record<string, string> = {
  title: "标题",
  meta_description: "描述",
  body: "正文",
  img_alt: "图片 alt",
  h1: "H1",
  h2: "H2",
  h3: "H3",
  h4: "H4",
  h5: "H5",
  h6: "H6",
};

export function keywordLocationLabel(loc: string): string {
  return KEYWORD_LOC_MAP[loc] ?? loc;
}

export function formatKeywordLocations(locations: string[]): string {
  return locations.map(keywordLocationLabel).join("、");
}
