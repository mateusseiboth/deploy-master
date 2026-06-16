import { Router, type NextFunction, type Request, type Response } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { backupUpload } from "@core/http/upload";
import { sendResult, type HttpResult } from "@core/http/HttpResult";
import { BackupController } from "@modules/backup/BackupController";
import { backupConfigSchema } from "@modules/backup/backupSchemas";

/**
 * Backups:
 *  - `POST /` upload do .sql/.sql.gz do ambiente (multer; sem transação/DB).
 *  - `POST /production` dispara backup de todos os bancos habilitados (ADMIN).
 *  - `POST /production/run/:database` dispara backup de um banco (ADMIN).
 *  - `GET  /production` lista as execuções (por banco).
 *  - `GET  /available` backups concluídos disponíveis (ADMIN/QA).
 *  - `GET  /production/config` lista bancos + agendamento (ADMIN; rota crua: faz
 *    psql na URL configurada, fora de transação longa).
 *  - `PUT  /production/config/:database` salva o agendamento de um banco (ADMIN).
 */
export function backupRoutes(): Router {
  const controller = container.get(BackupController);
  const router = Router();

  router.post(
    "/",
    requireRole("ADMIN", "QA"),
    backupUpload.single("file"),
    (req, res) => sendResult(res, controller.upload(req)),
  );

  // Rotas "cruas" (sem withTransaction): o service abre transações curtas e faz
  // I/O de rede (psql) fora delas. Evita segurar transação durante o psql.
  router.get("/production/config", requireRole("ADMIN"), raw(() => controller.listConfigs()));
  router.put(
    "/production/config/:database",
    requireRole("ADMIN"),
    validateBody(backupConfigSchema),
    raw((req) => controller.upsertConfig(req)),
  );
  router.post("/production/run/:database", requireRole("ADMIN"), (req, res) =>
    sendResult(res, controller.triggerDatabase(req)),
  );

  const route = new RouteBuilder(router);
  route.with(requireRole("ADMIN")).post("/production", () => controller.triggerProduction());
  route.with(requireRole("ADMIN")).get("/production", () => controller.listProduction());
  // QA também precisa enxergar os backups concluídos para escolher como origem.
  route.with(requireRole("ADMIN", "QA")).get("/available", () => controller.listAvailable());

  return router;
}

/** Adapta um handler assíncrono que devolve HttpResult para rota Express crua. */
function raw(handler: (req: Request) => Promise<HttpResult>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req)
      .then((result) => sendResult(res, result))
      .catch(next);
  };
}
