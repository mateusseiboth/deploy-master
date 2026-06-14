import multer from "multer";
import { mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { env } from "@config/env";

const BACKUPS_DIR = join(env.docker.workspaceDir, "backups");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    cb(null, BACKUPS_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.toLowerCase().endsWith(".gz") ? "sql.gz" : "sql";
    cb(null, `${randomUUID()}.${safe}`);
  },
});

/** Upload de backups: aceita apenas `.sql` e `.sql.gz`, até 1GB. */
export const backupUpload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    cb(null, name.endsWith(".sql") || name.endsWith(".sql.gz"));
  },
});
