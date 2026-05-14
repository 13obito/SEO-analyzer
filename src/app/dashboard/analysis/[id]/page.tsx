"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { sanitizeHtml } from "@/lib/security";
import { aggregateSeoIssues } from "@/lib/aggregate-seo-issues";
import {
  severityLabel,
  formatKeywordLocations,
  issueCategoryForDisplay,
  issueMessageForDisplay,
  issueSuggestionForDisplay,
} from "@/lib/zh-ui";

interface PageResultData {
  id: string;
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h2Count: number;
  h3Count: number;
  imgTotal: number;
  imgWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  loadTimeMs: number;
  pageSize: number;
  wordCount: number;
  isMobileFriendly: boolean;
  mobileFriendlyDetails: string | null;
  performanceScore: number | null;
}

type LighthouseMetrics = {
  fcpMs: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  speedIndexMs: number | null;
};

function readLighthouseFromDetails(details: string | null): {
  fromLighthouse: boolean;
  metrics: LighthouseMetrics | null;
} {
  if (!details) return { fromLighthouse: false, metrics: null };
  try {
    const o = JSON.parse(details) as {
      lighthouse?: boolean;
      metrics?: LighthouseMetrics;
    };
    if (!o.lighthouse || !o.metrics) {
      return { fromLighthouse: false, metrics: null };
    }
    return { fromLighthouse: true, metrics: o.metrics };
  } catch {
    return { fromLighthouse: false, metrics: null };
  }
}

interface SeoIssueData {
  id: string;
  pageUrl: string;
  severity: string;
  category: string;
  message: string;
  suggestion: string;
}

interface KeywordData {
  id: string;
  keyword: string;
  count: number;
  density: number;
  isStuffing: boolean;
  locations: string;
}

interface AnalysisDetail {
  id: string;
  url: string;
  crawlDepth: number;
  status: string;
  overallScore: number | null;
  createdAt: string;
  completedAt: string | null;
  pages: PageResultData[];
  seoIssues: SeoIssueData[];
  keywords: KeywordData[];
  project: { userId: string; name: string };
}

interface TrendPoint {
  date: string;
  score: number;
}

export default function AnalysisPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "pages" | "issues" | "keywords" | "trend">("overview");

  const analysisId = params.id as string;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/${analysisId}`);
      if (res.ok) {
        const data: AnalysisDetail = await res.json();
        setAnalysis(data);

        const trendRes = await fetch(`/api/analysis/${analysisId}/trend`);
        if (trendRes.ok) {
          const trendAnalyses: { createdAt: string; overallScore: number }[] = await trendRes.json();
          const points: TrendPoint[] = trendAnalyses.map((a) => ({
            date: new Date(a.createdAt).toLocaleDateString("zh-CN"),
            score: Math.round(a.overallScore),
          }));
          setTrendData(points);
        }
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [analysisId, router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/auth/login");
    if (authStatus === "authenticated") fetchData();
  }, [authStatus, router, fetchData]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!session || !analysis) return null;

  const aggregatedIssues = aggregateSeoIssues(analysis.seoIssues);

  const scoreColor =
    analysis.overallScore == null
      ? "text-slate-400"
      : analysis.overallScore >= 80
        ? "text-emerald-500"
        : analysis.overallScore >= 50
          ? "text-amber-500"
          : "text-red-500";

  const criticalCount = analysis.seoIssues.filter((i) => i.severity === "critical").length;
  const warningCount = analysis.seoIssues.filter((i) => i.severity === "warning").length;
  const infoCount = analysis.seoIssues.filter((i) => i.severity === "info").length;

  const tabs = [
    { key: "overview" as const, label: "概览" },
    { key: "pages" as const, label: `页面 (${analysis.pages.length})` },
    {
      key: "issues" as const,
      label: `问题 (${aggregatedIssues.length} 类 / ${analysis.seoIssues.length} 条)`,
    },
    { key: "keywords" as const, label: `关键词 (${analysis.keywords.length})` },
    { key: "trend" as const, label: "趋势" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 text-sm">
          ← 返回控制台
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">分析结果</h1>
        <p className="text-slate-500">{analysis.url}</p>
        <p className="text-xs text-slate-400">
          {new Date(analysis.createdAt).toLocaleString("zh-CN")} · 深度 {analysis.crawlDepth}
        </p>
        <a
          href={`/api/analysis/${analysisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          下载 PDF 报告
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className={`text-3xl font-bold ${scoreColor}`}>
            {analysis.overallScore != null ? Math.round(analysis.overallScore) : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">综合得分</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-slate-800">{analysis.pages.length}</div>
          <div className="text-xs text-slate-500 mt-1">已抓取页面</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{criticalCount}</div>
          <div className="text-xs text-slate-500 mt-1">严重问题</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-amber-500">{warningCount}</div>
          <div className="text-xs text-slate-500 mt-1">警告</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-blue-500">{infoCount}</div>
          <div className="text-xs text-slate-500 mt-1">提示</div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold mb-4">主要问题</h3>
            {aggregatedIssues.length === 0 ? (
              <p className="text-slate-500 text-sm">未发现问题。</p>
            ) : (
            aggregatedIssues.slice(0, 5).map((issue, idx) => (
              <div
                key={`${issue.severity}-${issue.category}-${issue.message}-${idx}`}
                className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0"
              >
                <span
                  className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    issue.severity === "critical"
                      ? "bg-red-500"
                      : issue.severity === "warning"
                        ? "bg-amber-500"
                        : "bg-blue-500"
                  }`}
                ></span>
                <div>
                  <p className="font-medium text-sm">
                    {sanitizeHtml(issueMessageForDisplay(issue.message))}
                    {issue.affectedPages > 1 ? (
                      <span className="text-slate-500 font-normal">
                        {" "}
                       （{issue.affectedPages} 页）
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{sanitizeHtml(issueSuggestionForDisplay(issue.suggestion ?? ""))}</p>
                </div>
              </div>
            ))
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold mb-4">热门关键词</h3>
            <div className="space-y-2">
              {analysis.keywords.length === 0 ? (
                <p className="text-slate-500 text-sm">暂无关键词统计。</p>
              ) : (
              analysis.keywords.slice(0, 10).map((kw) => (
                <div key={kw.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{sanitizeHtml(kw.keyword)}</span>
                    {kw.isStuffing && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        堆砌风险
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {kw.count} 次 · {kw.density}%
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "pages" && (
        <div className="space-y-4">
          {analysis.pages.map((page) => (
            <div key={page.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-sm truncate max-w-[70%]">
                  {sanitizeHtml(page.url)}
                </h3>
                <span
                  className={`text-sm font-medium px-2 py-0.5 rounded ${
                    page.statusCode >= 200 && page.statusCode < 300
                      ? "bg-emerald-50 text-emerald-600"
                      : page.statusCode >= 400
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {page.statusCode}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">标题：</span>{" "}
                  <span className="font-medium">{page.title ? sanitizeHtml(page.title.slice(0, 60)) : "缺失"}</span>
                </div>
                <div>
                  <span className="text-slate-500">字数：</span>{" "}
                  <span className="font-medium">{page.wordCount}</span>
                </div>
                <div>
                  <span className="text-slate-500">加载时间：</span>{" "}
                  <span className="font-medium">{page.loadTimeMs} ms</span>
                </div>
                <div>
                  <span className="text-slate-500">移动友好：</span>{" "}
                  <span className={page.isMobileFriendly ? "text-emerald-600" : "text-red-600"}>
                    {page.isMobileFriendly ? "是" : "否"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">性能分：</span>{" "}
                  <span
                    className="font-medium"
                    title="有 Lighthouse 时用实测；否则根据首包耗时估算"
                  >
                    {page.performanceScore != null ? page.performanceScore : "—"}
                    {readLighthouseFromDetails(page.mobileFriendlyDetails).fromLighthouse
                      ? "（Lighthouse）"
                      : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">H1：</span> {page.h1Count}{" "}
                  <span className="text-slate-500">H2：</span> {page.h2Count}{" "}
                  <span className="text-slate-500">H3：</span> {page.h3Count}
                </div>
                <div>
                  <span className="text-slate-500">图片：</span>{" "}
                  {page.imgTotal}（{page.imgWithoutAlt} 张缺 alt）
                </div>
                <div>
                  <span className="text-slate-500">内链：</span> {page.internalLinks}
                </div>
                <div>
                  <span className="text-slate-500">外链：</span> {page.externalLinks}{" "}
                  <span className="text-slate-500">失效：</span>{" "}
                  <span className={page.brokenLinks > 0 ? "text-red-600" : ""}>{page.brokenLinks}</span>
                </div>
              </div>
              {(() => {
                const { metrics: m } = readLighthouseFromDetails(
                  page.mobileFriendlyDetails
                );
                if (!m) return null;
                const fmtMs = (n: number | null) =>
                  n != null && Number.isFinite(n) ? `${Math.round(n)} ms` : "—";
                const fmtCls = (n: number | null) =>
                  n != null && Number.isFinite(n) ? n.toFixed(3) : "—";
                return (
                  <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Lighthouse（移动 / 实验室）
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-slate-700">
                      <div>首次内容绘制：{fmtMs(m.fcpMs)}</div>
                      <div>最大内容绘制：{fmtMs(m.lcpMs)}</div>
                      <div>总阻塞时间：{fmtMs(m.tbtMs)}</div>
                      <div>累积布局偏移：{fmtCls(m.cls)}</div>
                      <div>Speed Index：{fmtMs(m.speedIndexMs)}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {activeTab === "issues" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {aggregatedIssues.length === 0 ? (
            <div className="p-8 text-center text-slate-500">未发现问题，做得很棒。</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">级别</th>
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">页数</th>
                  <th className="text-left px-4 py-3 font-medium">类别</th>
                  <th className="text-left px-4 py-3 font-medium">问题</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">建议</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedIssues.map((issue, idx) => (
                  <tr
                    key={`${issue.severity}-${issue.category}-${issue.message}-${idx}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          issue.severity === "critical"
                            ? "bg-red-100 text-red-700"
                            : issue.severity === "warning"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {severityLabel(issue.severity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{issue.affectedPages}</td>
                    <td className="px-4 py-3 text-slate-600">{issueCategoryForDisplay(issue.category)}</td>
                    <td className="px-4 py-3">{sanitizeHtml(issueMessageForDisplay(issue.message))}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {sanitizeHtml(issueSuggestionForDisplay(issue.suggestion ?? ""))}
                      {issue.affectedPages > 1 ? (
                        <div className="mt-1 text-xs text-slate-400">
                          示例：{issue.samplePageUrls.slice(0, 3).map((u) => sanitizeHtml(u)).join(" · ")}
                          {issue.affectedPages > 3 ? " …" : ""}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "keywords" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">关键词</th>
                <th className="text-left px-4 py-3 font-medium">出现次数</th>
                <th className="text-left px-4 py-3 font-medium">密度</th>
                <th className="text-left px-4 py-3 font-medium">风险</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">出现位置</th>
              </tr>
            </thead>
            <tbody>
              {analysis.keywords.map((kw) => {
                let locations: string[] = [];
                try {
                  locations = JSON.parse(kw.locations || "[]");
                } catch { /* ignore */ }

                return (
                  <tr key={kw.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono">{sanitizeHtml(kw.keyword)}</td>
                    <td className="px-4 py-3">{kw.count}</td>
                    <td className="px-4 py-3">{kw.density}%</td>
                    <td className="px-4 py-3">
                      {kw.isStuffing ? (
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">堆砌</span>
                      ) : (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">正常</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {formatKeywordLocations(locations)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "trend" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold mb-4">得分趋势</h3>
          {trendData.length < 2 ? (
            <p className="text-slate-500 text-center py-8">
              至少需要 2 次已完成的分析才能展示趋势。
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value) => [`${value ?? "—"} 分`, "得分"]}
                  labelFormatter={(label) => `日期：${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
