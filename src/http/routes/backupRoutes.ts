import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { backupUpload } from "@core/http/upload";
import { sendResult } from "@core/http/HttpResult";
import { BackupController } from "@modules/backup/BackupController";

/**
 * Backups:
 *  - `POST /` upload do .sql/.sql.gz do ambiente (multer; sem transação/DB).
 *  - `POST /production` dispara backup completo de produção (ADMIN; enfileirado).
 *  - `GET  /production` lista as execuções de backup de produção.
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

  const route = new RouteBuilder(router);
  route
    .with(requireRole("ADMIN"))
    .post("/production", () => controller.triggerProduction());
  route
    .with(requireRole("ADMIN"))
    .get("/production", () => controller.listProduction());

  return router;
}
