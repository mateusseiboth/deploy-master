import { Router } from "express";
import { container } from "@di/container";
import { sendResult } from "@core/http/HttpResult";
import { requireRole } from "@core/http/currentUser";
import { SqliteJobQueue } from "@core/queue/SqliteJobQueue";

/**
 * Visão da fila de jobs (deploys, cleanups e backups) para monitoramento
 * operacional. Lê o SQLite compartilhado (mesmo arquivo do worker) — sem
 * transação Prisma, sem reservar jobs. Restrito a ADMIN/QA.
 */
export function queueRoutes(): Router {
  const queue = container.get(SqliteJobQueue);
  const router = Router();

  // Worker considerado online se houve heartbeat nos últimos ~15s (loop de 1s).
  const HEARTBEAT_TTL_MS = 15_000;

  router.get("/", requireRole("ADMIN", "QA"), (_req, res) => {
    const jobs = queue.list(80);
    const stats = jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
    const lastHeartbeat = queue.lastHeartbeat();
    const workerOnline = lastHeartbeat !== null && Date.now() - lastHeartbeat < HEARTBEAT_TTL_MS;
    sendResult(res, { status: 200, body: { jobs, stats, lastHeartbeat, workerOnline } });
  });

  return router;
}
