/** 合并相同类型 SEO 问题，避免 PDF/表格被重复行刷屏 */

export type IssueLike = {
  pageUrl?: string | null;
  severity: string;
  category: string;
  message: string;
  suggestion: string | null;
};

export type AggregatedIssueRow = {
  severity: string;
  category: string;
  message: string;
  suggestion: string | null;
  affectedPages: number;
  samplePageUrls: string[];
};

function issueKey(i: IssueLike): string {
  return `${i.severity}\0${i.category}\0${i.message}\0${i.suggestion ?? ""}`;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function aggregateSeoIssues(issues: IssueLike[]): AggregatedIssueRow[] {
  const buckets = new Map<
    string,
    { base: IssueLike; urls: Set<string> }
  >();

  for (const i of issues) {
    const key = issueKey(i);
    const url = (i.pageUrl || "").trim() || "(未记录 URL)";
    let b = buckets.get(key);
    if (!b) {
      b = { base: i, urls: new Set() };
      buckets.set(key, b);
    }
    b.urls.add(url);
  }

  const rows: AggregatedIssueRow[] = [...buckets.values()].map((b) => ({
    severity: b.base.severity,
    category: b.base.category,
    message: b.base.message,
    suggestion: b.base.suggestion,
    affectedPages: b.urls.size,
    samplePageUrls: [...b.urls].slice(0, 5),
  }));

  rows.sort((a, b) => {
    const da = SEVERITY_ORDER[a.severity] ?? 9;
    const db = SEVERITY_ORDER[b.severity] ?? 9;
    if (da !== db) return da - db;
    return b.affectedPages - a.affectedPages;
  });

  return rows;
}
