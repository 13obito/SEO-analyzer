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
    category: "title",
    message: "Missing page title",
    suggestion: "Add a descriptive <title> tag (50-60 characters recommended)",
  },
  {
    check: (p) => !!p.title && p.title.length > 60,
    weight: 5,
    severity: "warning",
    category: "title",
    message: "Title too long (over 60 characters)",
    suggestion: "Shorten the title to 50-60 characters for optimal display in search results",
  },
  {
    check: (p) => !!p.title && p.title.length < 10,
    weight: 5,
    severity: "warning",
    category: "title",
    message: "Title too short (under 10 characters)",
    suggestion: "Make the title more descriptive (50-60 characters recommended)",
  },
  {
    check: (p) => !p.metaDescription,
    weight: 10,
    severity: "critical",
    category: "meta",
    message: "Missing meta description",
    suggestion: "Add a meta description (120-160 characters) summarizing the page content",
  },
  {
    check: (p) => !!p.metaDescription && p.metaDescription.length > 160,
    weight: 3,
    severity: "warning",
    category: "meta",
    message: "Meta description too long (over 160 characters)",
    suggestion: "Shorten the meta description to 120-160 characters",
  },
  {
    check: (p) => p.h1Count === 0,
    weight: 10,
    severity: "critical",
    category: "heading",
    message: "Missing H1 heading",
    suggestion: "Add exactly one H1 heading that describes the main topic of the page",
  },
  {
    check: (p) => p.h1Count > 1,
    weight: 5,
    severity: "warning",
    category: "heading",
    message: `Multiple H1 headings found`,
    suggestion: "Use only one H1 heading per page for clear content hierarchy",
  },
  {
    check: (p) => p.imgWithoutAlt > 0,
    weight: 8,
    severity: "warning",
    category: "image",
    message: "Images missing alt attributes",
    suggestion: "Add descriptive alt text to all images for accessibility and SEO",
  },
  {
    check: (p) => p.brokenLinks > 0,
    weight: 10,
    severity: "critical",
    category: "link",
    message: "Broken links detected",
    suggestion: "Fix or remove broken links to improve user experience and crawlability",
  },
  {
    check: (p) => p.internalLinks === 0,
    weight: 5,
    severity: "warning",
    category: "link",
    message: "No internal links found",
    suggestion: "Add internal links to help search engines discover related content",
  },
  {
    check: (p) => p.loadTimeMs > 3000,
    weight: 8,
    severity: "warning",
    category: "performance",
    message: "Slow page load time (over 3 seconds)",
    suggestion: "Optimize images, minify CSS/JS, enable caching to improve load time",
  },
  {
    check: (p) => p.loadTimeMs > 5000,
    weight: 7,
    severity: "critical",
    category: "performance",
    message: "Very slow page load time (over 5 seconds)",
    suggestion: "Significant performance optimization needed. Consider lazy loading, CDN, and server optimization",
  },
  {
    check: (p) => !p.metaViewport,
    weight: 8,
    severity: "critical",
    category: "mobile",
    message: "Missing viewport meta tag",
    suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile responsiveness',
  },
  {
    check: (p) => p.wordCount < 300,
    weight: 5,
    severity: "warning",
    category: "content",
    message: "Thin content (under 300 words)",
    suggestion: "Add more substantial content. Pages with 300+ words tend to rank better",
  },
  {
    check: (p) => !p.canonicalUrl,
    weight: 3,
    severity: "info",
    category: "meta",
    message: "Missing canonical URL",
    suggestion: "Add a canonical link to prevent duplicate content issues",
  },
  {
    check: (p) => p.pageSize > 3 * 1024 * 1024,
    weight: 5,
    severity: "warning",
    category: "performance",
    message: "Large page size (over 3MB)",
    suggestion: "Reduce page size by optimizing assets and removing unnecessary resources",
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
