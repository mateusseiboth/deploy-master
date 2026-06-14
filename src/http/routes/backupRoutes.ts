import { Router } from "express";
import { container } from "@di/container";
import { requireRole } from "@core/http/currentUser";
import { backupUpload } from "@core/http/upload";
import { BackupController } from "@modules/backup/BackupController";

/**
 * Upload de backup (.sql/.sql.gz). Não usa `RouteBuilder`/transação: é apenas
 * armazenamento de arquivo. O `filePath` retornado é informado na criação do
 * ambiente.
 */
export function backupRoutes(): Router {
  const controller = container.get(BackupController);
  const router = Router();

  router.post(
    "/",
    requireRole("ADMIN", "QA"),
    backupUpload.single("file"),
    (req, res) => controller.upload(req, res),
  );

  return router;
}
