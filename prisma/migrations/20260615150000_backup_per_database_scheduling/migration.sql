-- Backup por banco: agendamento (BackupDatabaseConfig) + log por banco.

-- Frequência de agendamento por banco.
DO $$ BEGIN
  CREATE TYPE "BackupFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Configuração de backup POR BANCO (fonte do scheduler).
CREATE TABLE IF NOT EXISTS "backup_database_configs" (
  "id"           TEXT NOT NULL,
  "databaseName" TEXT NOT NULL,
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "frequency"    "BackupFrequency" NOT NULL DEFAULT 'DAILY',
  "hourOfDay"    INTEGER NOT NULL DEFAULT 2,
  "dayOfWeek"    INTEGER,
  "dayOfMonth"   INTEGER,
  "lastRunAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "backup_database_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "backup_database_configs_databaseName_key"
  ON "backup_database_configs" ("databaseName");

-- ProductionBackupLog agora é POR BANCO: novas colunas + remoção do modelo por execução.
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "databaseName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "production_backup_logs" ALTER COLUMN "databaseName" DROP DEFAULT;
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "filePath" TEXT;
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "sizeBytes" BIGINT;

ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "label";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "directory";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "databases";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "totalBytes";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "totalDatabases";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "processedDatabases";
ALTER TABLE "production_backup_logs" DROP COLUMN IF EXISTS "currentDatabase";

CREATE INDEX IF NOT EXISTS "production_backup_logs_databaseName_status_idx"
  ON "production_backup_logs" ("databaseName", "status");

-- Agendamento global por horas foi substituído pelo agendamento por banco.
ALTER TABLE "system_settings" DROP COLUMN IF EXISTS "prodBackupIntervalHours";

-- Fase corrente do pipeline (exibição inline na lista de ambientes).
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "deployPhase" TEXT;
