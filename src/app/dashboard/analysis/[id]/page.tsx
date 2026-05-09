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
            date: new Date(a.createdAt).toLocaleDateString(),
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
    { key: "overview" as const, label: "Overview" },
    { key: "pages" as const, label: `Pages (${analysis.pages.length})` },
    { key: "issues" as const, label: `Issues (${analysis.seoIssues.length})` },
    { key: "keywords" as const, label: `Keywords (${analysis.keywords.length})` },
    { key: "trend" as const, label: "Trend" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 text-sm">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Analysis Results</h1>
        <p className="text-slate-500">{analysis.url}</p>
        <p className="text-xs text-slate-400">
          {new Date(analysis.createdAt).toLocaleString()} &middot; Depth: {analysis.crawlDepth}
        </p>
        <a
          href={`/api/analysis/${analysisId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Download PDF report
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className={`text-3xl font-bold ${scoreColor}`}>
            {analysis.overallScore != null ? Math.round(analysis.overallScore) : "—"}
          </div>
          <div className="text-xs text-slate-500 mt-1">Overall Score</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-slate-800">{analysis.pages.length}</div>
          <div className="text-xs text-slate-500 mt-1">Pages Crawled</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{criticalCount}</div>
          <div className="text-xs text-slate-500 mt-1">Critical Issues</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-amber-500">{warningCount}</div>
          <div className="text-xs text-slate-500 mt-1">Warnings</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-3xl font-bold text-blue-500">{infoCount}</div>
          <div className="text-xs text-slate-500 mt-1">Info</div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
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
            <h3 className="font-semibold mb-4">Top Issues</h3>
            {analysis.seoIssues.slice(0, 5).map((issue) => (
              <div key={issue.id} className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
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
                  <p className="font-medium text-sm">{sanitizeHtml(issue.message)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sanitizeHtml(issue.suggestion)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold mb-4">Top Keywords</h3>
            <div className="space-y-2">
              {analysis.keywords.slice(0, 10).map((kw) => (
                <div key={kw.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{sanitizeHtml(kw.keyword)}</span>
                    {kw.isStuffing && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        Stuffing Risk
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {kw.count}x &middot; {kw.density}%
                  </div>
                </div>
              ))}
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
                  <span className="text-slate-500">Title:</span>{" "}
                  <span className="font-medium">{page.title ? sanitizeHtml(page.title.slice(0, 60)) : "Missing"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Words:</span>{" "}
                  <span className="font-medium">{page.wordCount}</span>
                </div>
                <div>
                  <span className="text-slate-500">Load Time:</span>{" "}
                  <span className="font-medium">{page.loadTimeMs}ms</span>
                </div>
                <div>
                  <span className="text-slate-500">Mobile:</span>{" "}
                  <span className={page.isMobileFriendly ? "text-emerald-600" : "text-red-600"}>
                    {page.isMobileFriendly ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Perf. score:</span>{" "}
                  <span className="font-medium" title="Lighthouse performance when available, else estimate from fetch time">
                    {page.performanceScore != null ? page.performanceScore : "—"}
                    {readLighthouseFromDetails(page.mobileFriendlyDetails).fromLighthouse
                      ? " (Lighthouse)"
                      : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">H1:</span> {page.h1Count}{" "}
                  <span className="text-slate-500">H2:</span> {page.h2Count}{" "}
                  <span className="text-slate-500">H3:</span> {page.h3Count}
                </div>
                <div>
                  <span className="text-slate-500">Images:</span>{" "}
                  {page.imgTotal} ({page.imgWithoutAlt} missing alt)
                </div>
                <div>
                  <span className="text-slate-500">Internal Links:</span> {page.internalLinks}
                </div>
                <div>
                  <span className="text-slate-500">External Links:</span> {page.externalLinks}{" "}
                  <span className="text-slate-500">Broken:</span>{" "}
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
                      Lighthouse (mobile, lab)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-slate-700">
                      <div>FCP: {fmtMs(m.fcpMs)}</div>
                      <div>LCP: {fmtMs(m.lcpMs)}</div>
                      <div>TBT: {fmtMs(m.tbtMs)}</div>
                      <div>CLS: {fmtCls(m.cls)}</div>
                      <div>Speed Index: {fmtMs(m.speedIndexMs)}</div>
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
          {analysis.seoIssues.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No issues found. Great job!</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Severity</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Issue</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {analysis.seoIssues.map((issue) => (
                  <tr key={issue.id} className="border-b border-slate-100 last:border-0">
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
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{issue.category}</td>
                    <td className="px-4 py-3">{sanitizeHtml(issue.message)}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {sanitizeHtml(issue.suggestion)}
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
                <th className="text-left px-4 py-3 font-medium">Keyword</th>
                <th className="text-left px-4 py-3 font-medium">Count</th>
                <th className="text-left px-4 py-3 font-medium">Density</th>
                <th className="text-left px-4 py-3 font-medium">Risk</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Found In</th>
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
                        <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs">Stuffing</span>
                      ) : (
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {locations.join(", ")}
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
          <h3 className="font-semibold mb-4">Score Trend</h3>
          {trendData.length < 2 ? (
            <p className="text-slate-500 text-center py-8">
              Need at least 2 completed analyses to show trend data.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
                <Tooltip />
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
