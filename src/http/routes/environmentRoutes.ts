import { Router, type Request, type Response } from "express";
import { Writable } from "stream";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { runInTransaction } from "@core/transaction/withTransaction";
import { EnvironmentController } from "@modules/environment/EnvironmentController";
import { EnvironmentService } from "@modules/environment/EnvironmentService";
import { DockerService } from "@modules/docker/DockerService";
import { AuditController } from "@modules/audit/AuditController";
import { createEnvironmentSchema, renewSchema } from "@modules/environment/environmentSchemas";

/** Rotas de ambientes efêmeros. */
export function environmentRoutes(): Router {
  const controller = container.get(EnvironmentController);
  const audit = container.get(AuditController);
  const router = Router();
  const route = new RouteBuilder(router);
  const mutate = route.with(requireRole("ADMIN", "QA"));

  route.get("/", (req) => controller.list(req));
  route.get("/:id", (req) => controller.getById(req));
  route.get("/:id/audit", (req) => audit.listByEnvironment(req));

  // SSE: logs do container em tempo real. Rota "crua" (sem transação longa):
  // o containerId é lido numa transação curta e o stream roda fora dela.
  router.get("/:id/logs/stream", (req, res) => streamLogs(req, res));

  route
    .with(requireRole("ADMIN", "QA"), validateBody(createEnvironmentSchema))
    .post("/", (req) => controller.create(req));
  route
    .with(requireRole("ADMIN", "QA"), validateBody(renewSchema))
    .post("/:id/renew", (req) => controller.renew(req));
  mutate.post("/:id/restart", (req) => controller.restart(req));
  mutate.delete("/:id", (req) => controller.remove(req));

  return router;
}

/** Handler SSE dos logs do container do ambiente. */
async function streamLogs(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  const environments = container.get(EnvironmentService);
  const docker = container.get(DockerService);

  let containerId: string | null;
  try {
    containerId = await runInTransaction(async () => (await environments.getById(id)).containerId ?? null);
  } catch {
    res.status(404).json({ error: "NotFound", message: "Ambiente não encontrado" });
    return;
  }
  if (!containerId) {
    res.status(409).json({ error: "Conflict", message: "Ambiente ainda sem container" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: ready\ndata: conectado\n\n`);

  // Converte os chunks do Docker em eventos SSE (uma linha por evento).
  const sink = new Writable({
    write(chunk, _enc, cb) {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line) res.write(`data: ${line}\n\n`);
      }
      cb();
    },
  });

  const stop = await docker.followLogs(containerId, sink);
  req.on("close", () => {
    stop();
    sink.destroy();
  });
}
