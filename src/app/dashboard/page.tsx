"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ProjectData {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  _count: { analyses: number };
  analyses: {
    id: string;
    overallScore: number | null;
    status: string;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setProjects(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/login");
    if (status === "authenticated") fetchProjects();
  }, [status, router, fetchProjects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, url: newUrl }),
      });
      if (res.ok) {
        setNewName("");
        setNewUrl("");
        setShowNewProject(false);
        fetchProjects();
      }
    } finally {
      setCreating(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Welcome back, {session.user?.name || session.user?.email}
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(!showNewProject)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
        >
          + New Project
        </button>
      </div>

      {showNewProject && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
          <form onSubmit={createProject} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              required
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <input
              type="url"
              required
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white px-6 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-slate-600 mb-6">
            Create your first project to start analyzing SEO performance.
          </p>
          <button
            onClick={() => setShowNewProject(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            + Create Project
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const latestAnalysis = project.analyses[0];
            const score = latestAnalysis?.overallScore;
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
                key={project.id}
                href={`/dashboard/project/${project.id}`}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold truncate pr-2">
                    {project.name}
                  </h3>
                  <span className={`text-2xl font-bold ${scoreColor}`}>
                    {score != null ? Math.round(score) : "—"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate mb-3">
                  {project.url}
                </p>
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>{project._count.analyses} analyses</span>
                  <span>
                    {latestAnalysis
                      ? latestAnalysis.status === "completed"
                        ? "Completed"
                        : latestAnalysis.status
                      : "No analysis"}
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
