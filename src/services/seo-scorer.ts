import { PageSeoData } from "./crawler";

export interface SeoIssueData {
  pageUrl: string;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  suggestion: string;
}

export interface ScoringResult {
  overallScore: number;
  issues: SeoIssueData[];
}

interface ScoreRule {
  check: (page: PageSeoData) => boolean;
  weight: number;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  suggestion: string;
}

const rules: ScoreRule[] = [
  {
    check: (p) => !p.title,
    weight: 15,
    severity: "critical",
    category: "标题",
    message: "缺少页面标题（<title>）",
    suggestion: "添加描述性标题，建议长度约 50–60 个字符",
  },
  {
    check: (p) => !!p.title && p.title.length > 60,
    weight: 5,
    severity: "warning",
    category: "标题",
    message: "标题过长（超过 60 个字符）",
    suggestion: "缩短至约 50–60 个字符，以便在搜索结果中完整展示",
  },
  {
    check: (p) => !!p.title && p.title.length < 10,
    weight: 5,
    severity: "warning",
    category: "标题",
    message: "标题过短（少于 10 个字符）",
    suggestion: "补充更具体的描述，建议约 50–60 个字符",
  },
  {
    check: (p) => !p.metaDescription,
    weight: 10,
    severity: "critical",
    category: "元信息",
    message: "缺少 meta description",
    suggestion: "添加 120–160 字的摘要，概括页面核心内容",
  },
  {
    check: (p) => !!p.metaDescription && p.metaDescription.length > 160,
    weight: 3,
    severity: "warning",
    category: "元信息",
    message: "meta description 过长（超过 160 字）",
    suggestion: "压缩至 120–160 字以内",
  },
  {
    check: (p) => p.h1Count === 0,
    weight: 10,
    severity: "critical",
    category: "标题层级",
    message: "缺少 H1 标题",
    suggestion: "每页使用唯一一个 H1，概括页面主题",
  },
  {
    check: (p) => p.h1Count > 1,
    weight: 5,
    severity: "warning",
    category: "标题层级",
    message: "存在多个 H1",
    suggestion: "每页只保留一个 H1，便于爬虫理解结构",
  },
  {
    check: (p) => p.imgWithoutAlt > 0,
    weight: 8,
    severity: "warning",
    category: "图片",
    message: "部分图片缺少 alt 属性",
    suggestion: "为图片添加有意义 alt，利于无障碍与图片搜索",
  },
  {
    check: (p) => p.brokenLinks > 0,
    weight: 10,
    severity: "critical",
    category: "链接",
    message: "检测到失效链接",
    suggestion: "修复或移除死链，改善体验与抓取效率",
  },
  {
    check: (p) => p.internalLinks === 0,
    weight: 5,
    severity: "warning",
    category: "链接",
    message: "未发现内链",
    suggestion: "适当增加内链，帮助发现站内相关内容",
  },
  {
    check: (p) => p.loadTimeMs > 3000,
    weight: 8,
    severity: "warning",
    category: "性能",
    message: "页面加载较慢（超过 3 秒）",
    suggestion: "压缩图片、合并静态资源、开启缓存等以提速",
  },
  {
    check: (p) => p.loadTimeMs > 5000,
    weight: 7,
    severity: "critical",
    category: "性能",
    message: "页面加载很慢（超过 5 秒）",
    suggestion: "需要重点优化性能：懒加载、CDN、服务端响应等",
  },
  {
    check: (p) => !p.metaViewport,
    weight: 8,
    severity: "critical",
    category: "移动端",
    message: "缺少 viewport 元标签",
    suggestion: '添加 <meta name="viewport" content="width=device-width, initial-scale=1"> 以适配移动端',
  },
  {
    check: (p) => p.wordCount < 300,
    weight: 5,
    severity: "warning",
    category: "内容",
    message: "正文偏短（少于约 300 词）",
    suggestion: "充实主题相关内容，通常更易获得更好收录与排名",
  },
  {
    check: (p) => !p.canonicalUrl,
    weight: 3,
    severity: "info",
    category: "元信息",
    message: "未设置 canonical（规范链接）",
    suggestion: "添加 canonical 减少重复内容带来的不确定性",
  },
  {
    check: (p) => p.pageSize > 3 * 1024 * 1024,
    weight: 5,
    severity: "warning",
    category: "性能",
    message: "页面体积过大（超过 3MB）",
    suggestion: "优化资源体积，移除不必要脚本或大图",
  },
];

export function scorePages(pages: PageSeoData[]): ScoringResult {
  if (pages.length === 0) {
    return { overallScore: 0, issues: [] };
  }

  const allIssues: SeoIssueData[] = [];
  let totalDeductions = 0;

  for (const page of pages) {
    for (const rule of rules) {
      if (rule.check(page)) {
        totalDeductions += rule.weight;
        allIssues.push({
          pageUrl: page.url,
          severity: rule.severity,
          category: rule.category,
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  const maxDeduction = rules.reduce((sum, r) => sum + r.weight, 0) * pages.length;
  const rawScore = Math.max(0, 100 - (totalDeductions / maxDeduction) * 100);
  const overallScore = Math.round(rawScore * 10) / 10;

  allIssues.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return { overallScore, issues: allIssues };
}
