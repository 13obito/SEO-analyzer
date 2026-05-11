"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { analysisStatusLabel } from "@/lib/zh-ui";

interface AnalysisItem {
  id: string;
  url: string;
  status: string;
  overallScore: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  analyses: AnalysisItem[];
}

export default function ProjectPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [error, setError] = useState("");

  const projectId = params.id as string;

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        setProject(await res.json());
      } else if (res.status === 403 || res.status === 404) {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/auth/login");
    if (authStatus === "authenticated") fetchProject();
  }, [authStatus, router, fetchProject]);

  useEffect(() => {
    if (!project) return;
    const hasPending = project.analyses.some(
      (a) => a.status === "pending" || a.status === "crawling" || a.status === "analyzing"
    );
    if (!hasPending) return;

    const interval = setInterval(fetchProject, 5000);
    return () => clearInterval(interval);
  }, [project, fetchProject]);

  async function startAnalysis() {
    setError("");
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: project!.url,
          crawlDepth,
          projectId,
        }),
      });
      if (res.ok) {
        fetchProject();
      } else {
        const data = await res.json();
        setError(data.error || "无法启动分析");
      }
    } catch {
      setError("发生错误，请稍后重试");
    } finally {
      setAnalyzing(false);
    }
  }

  async function deleteProject() {
    if (!confirm("确定删除该项目及其全部分析记录？")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/dashboard");
  }

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!session || !project) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 text-sm">
          ← 返回控制台
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-slate-500 mt-1">{project.url}</p>
        </div>
        <button
          type="button"
          onClick={deleteProject}
          className="text-red-500 hover:text-red-600 text-sm border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg transition-colors"
        >
          删除项目
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">新建分析</h2>
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              抓取深度（1–3）
            </label>
            <select
              value={crawlDepth}
              onChange={(e) => setCrawlDepth(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value={1}>1 — 仅首页</option>
              <option value={2}>2 — 跟随内链（一层）</option>
              <option value={3}>3 — 较深抓取（两层）</option>
            </select>
          </div>
          <button
            type="button"
            onClick={startAnalysis}
            disabled={analyzing}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-8 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            {analyzing ? "启动中…" : "开始分析"}
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">分析记录</h2>
      {project.analyses.length === 0 ? (
        <p className="text-slate-500">尚无分析。请在上方运行一次分析。</p>
      ) : (
        <div className="space-y-3">
          {project.analyses.map((analysis) => {
            const isRunning = ["pending", "crawling", "analyzing"].includes(analysis.status);
            const score = analysis.overallScore;
            const scoreColor =
              score == null
                ? "text-slate-400"
                : score >= 80
                  ? "text-emerald-500"
                  : score >= 50
                    ? "text-amber-500"
                    : "text-red-500";

            return (
              <Link
                key={analysis.id}
                href={
                  analysis.status === "completed"
                    ? `/dashboard/analysis/${analysis.id}`
                    : "#"
                }
                className={`block bg-white rounded-xl border border-slate-200 p-4 ${
                  analysis.status === "completed"
                    ? "hover:shadow-md cursor-pointer"
                    : "cursor-default"
                } transition-shadow`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{analysis.url}</span>
                      {isRunning && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          <span className="animate-spin h-3 w-3 border-b-2 border-amber-500 rounded-full inline-block"></span>
                          {analysisStatusLabel(analysis.status)}
                        </span>
                      )}
                      {analysis.status === "failed" && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                          失败
                        </span>
                      )}
                    </div>
                    {analysis.status === "failed" && analysis.errorMessage && (
                      <p className="text-xs text-red-700 mt-1 max-w-2xl">
                        {analysis.errorMessage}
                      </p>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(analysis.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${scoreColor}`}>
                    {score != null ? Math.round(score) : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
