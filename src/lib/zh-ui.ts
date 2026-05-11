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

/** 历史分析存库的英文 category（seo-scorer 旧版） */
const LEGACY_ISSUE_CATEGORY: Record<string, string> = {
  title: "标题",
  meta: "元信息",
  heading: "标题层级",
  image: "图片",
  link: "链接",
  performance: "性能",
  mobile: "移动端",
  content: "内容",
};

/** 历史分析存库的英文 message → 与当前 seo-scorer 中文一致 */
const LEGACY_ISSUE_MESSAGE: Record<string, string> = {
  "Missing page title": "缺少页面标题（<title>）",
  "Title too long (over 60 characters)": "标题过长（超过 60 个字符）",
  "Title too short (under 10 characters)": "标题过短（少于 10 个字符）",
  "Missing meta description": "缺少 meta description",
  "Meta description too long (over 160 characters)":
    "meta description 过长（超过 160 字）",
  "Missing H1 heading": "缺少 H1 标题",
  "Multiple H1 headings found": "存在多个 H1",
  "Images missing alt attributes": "部分图片缺少 alt 属性",
  "Broken links detected": "检测到失效链接",
  "No internal links found": "未发现内链",
  "Slow page load time (over 3 seconds)": "页面加载较慢（超过 3 秒）",
  "Very slow page load time (over 5 seconds)": "页面加载很慢（超过 5 秒）",
  "Missing viewport meta tag": "缺少 viewport 元标签",
  "Thin content (under 300 words)": "正文偏短（少于约 300 词）",
  "Missing canonical URL": "未设置 canonical（规范链接）",
  "Large page size (over 3MB)": "页面体积过大（超过 3MB）",
};

/** 历史分析存库的英文 suggestion */
const LEGACY_ISSUE_SUGGESTION: Record<string, string> = {
  "Add a descriptive <title> tag (50-60 characters recommended)":
    "添加描述性标题，建议长度约 50–60 个字符",
  "Shorten the title to 50-60 characters for optimal display in search results":
    "缩短至约 50–60 个字符，以便在搜索结果中完整展示",
  "Make the title more descriptive (50-60 characters recommended)":
    "补充更具体的描述，建议约 50–60 个字符",
  "Add a meta description (120-160 characters) summarizing the page content":
    "添加 120–160 字的摘要，概括页面核心内容",
  "Shorten the meta description to 120-160 characters":
    "压缩至 120–160 字以内",
  "Add exactly one H1 heading that describes the main topic of the page":
    "每页使用唯一一个 H1，概括页面主题",
  "Use only one H1 heading per page for clear content hierarchy":
    "每页只保留一个 H1，便于爬虫理解结构",
  "Add descriptive alt text to all images for accessibility and SEO":
    "为图片添加有意义 alt，利于无障碍与图片搜索",
  "Fix or remove broken links to improve user experience and crawlability":
    "修复或移除死链，改善体验与抓取效率",
  "Add internal links to help search engines discover related content":
    "适当增加内链，帮助发现站内相关内容",
  "Optimize images, minify CSS/JS, enable caching to improve load time":
    "压缩图片、合并静态资源、开启缓存等以提速",
  "Significant performance optimization needed. Consider lazy loading, CDN, and server optimization":
    "需要重点优化性能：懒加载、CDN、服务端响应等",
  'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile responsiveness':
    '添加 <meta name="viewport" content="width=device-width, initial-scale=1"> 以适配移动端',
  "Add more substantial content. Pages with 300+ words tend to rank better":
    "充实主题相关内容，通常更易获得更好收录与排名",
  "Add a canonical link to prevent duplicate content issues":
    "添加 canonical 减少重复内容带来的不确定性",
  "Reduce page size by optimizing assets and removing unnecessary resources":
    "优化资源体积，移除不必要脚本或大图",
};

export function issueCategoryForDisplay(category: string): string {
  return LEGACY_ISSUE_CATEGORY[category] ?? category;
}

export function issueMessageForDisplay(message: string): string {
  return LEGACY_ISSUE_MESSAGE[message] ?? message;
}

export function issueSuggestionForDisplay(suggestion: string): string {
  return LEGACY_ISSUE_SUGGESTION[suggestion] ?? suggestion;
}
