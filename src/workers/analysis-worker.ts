import "dotenv/config";

import { Worker } from "bullmq";
import { ANALYSIS_QUEUE_NAME, type AnalysisJobData } from "@/lib/analysis-job";
import {
  getRedisConnection,
  pingRedisOrThrow,
} from "@/lib/redis-connection";
import { runAnalysis } from "@/services/analyzer";

const concurrency = Math.max(
  1,
  Math.min(8, Number(process.env.ANALYSIS_WORKER_CONCURRENCY ?? "1"))
);
const limiterMax = Math.max(
  1,
  Number(process.env.ANALYSIS_GLOBAL_JOBS_PER_MINUTE ?? "30")
);

function redisHint(): string {
  const url = process.env.REDIS_URL?.trim();
  if (url) return `REDIS_URL=${url}`;
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const port = process.env.REDIS_PORT || "6379";
  return `${host}:${port}`;
}

async function main() {
  try {
    await pingRedisOrThrow();
  } catch {
    console.error(
      `[analysis-worker] Cannot connect to Redis at ${redisHint()} (nothing listening or unreachable).`
    );
    console.error(
      "Start a Redis server first, e.g. Docker: docker run -d -p 6379:6379 redis:7-alpine"
    );
    console.error(
      "Or install Memurai / use a cloud Redis URL and set REDIS_URL in .env."
    );
    console.error(
      "For local app-only testing without a queue, set ANALYSIS_USE_INLINE=1 and do not run this worker."
    );
    process.exit(1);
  }

  const base = getRedisConnection();
  base.on("error", (err) => {
    console.error("[analysis-worker] Redis:", err.message);
  });

  const connection = base.duplicate();
  connection.on("error", (err) => {
    console.error("[analysis-worker] Redis:", err.message);
  });

  const worker = new Worker<AnalysisJobData>(
    ANALYSIS_QUEUE_NAME,
    async (job) => {
      await runAnalysis(job.data.analysisId);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: limiterMax,
        duration: 60_000,
      },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[analysis-worker] job ${job?.id} failed:`, err);
  });

  console.log(
    `[analysis-worker] listening (queue=${ANALYSIS_QUEUE_NAME}, concurrency=${concurrency}, limiter=${limiterMax}/min)`
  );

  async function shutdown(signal: string) {
    console.log(`[analysis-worker] ${signal}, closing…`);
    await worker.close();
    await connection.quit();
    await base.quit();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  console.error("[analysis-worker] fatal:", err);
  process.exit(1);
});
