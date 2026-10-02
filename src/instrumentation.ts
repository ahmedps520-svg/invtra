/**
 * Runs once when the Next.js server starts. With INLINE_WORKER=true the queue worker
 * runs inside the web process (ideal for development and single-instance hosting).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INLINE_WORKER !== "true") return;
  const { startWorker } = await import("@/server/queue/worker");
  startWorker({ concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4), label: "inline" });
}
