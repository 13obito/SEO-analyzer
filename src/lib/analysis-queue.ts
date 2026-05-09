import { Queue } from "bullmq";
import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from "@/lib/analysis-job";
import { createRedisDuplicate } from "@/lib/redis-connection";

let analysisQueue: Queue<AnalysisJobData> | null = null;

export function getAnalysisQueue(): Queue<AnalysisJobData> {
  if (!analysisQueue) {
    analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
      connection: createRedisDuplicate(),
    });
  }
  return analysisQueue;
}

export async function enqueueAnalysisJob(data: AnalysisJobData): Promise<void> {
  const queue = getAnalysisQueue();
  await queue.add(
    "run",
    data,
    {
      jobId: `analysis-${data.analysisId}`,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 3600, count: 5000 },
      removeOnFail: { age: 86_400 },
    }
  );
}

/** Waiting + active + delayed jobs (rough backpressure signal). */
export async function getAnalysisQueueBacklog(): Promise<number> {
  const queue = getAnalysisQueue();
  const counts = await queue.getJobCounts("waiting", "active", "delayed");
  return counts.waiting + counts.active + counts.delayed;
}

export function analysisMaxPerUser(): number {
  const n = Number(process.env.ANALYSIS_MAX_PER_USER ?? "2");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 2;
}

export function analysisQueueMaxBacklog(): number {
  const n = Number(process.env.ANALYSIS_QUEUE_MAX_BACKLOG ?? "100");
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 100;
}
