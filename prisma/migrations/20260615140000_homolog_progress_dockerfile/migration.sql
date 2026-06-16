-- Origem de homologação para cópia de banco (ao lado de produção), por projeto.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "homologationDbUrl" TEXT;

-- Conexões GLOBAIS de origem para cópia (produção/homologação), config. do admin.
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "prodDbUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "homologDbUrl" TEXT NOT NULL DEFAULT '';

-- Dockerfile escolhido por deploy + trilha de progresso do pipeline (ao vivo).
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "dockerfilePath" TEXT;
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "deployLog" TEXT;

-- Progresso incremental do backup de produção + nome legível da execução.
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "totalDatabases" INTEGER;
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "processedDatabases" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "production_backup_logs" ADD COLUMN IF NOT EXISTS "currentDatabase" TEXT;

-- Novas origens de banco do ambiente: backup salvo (arquivo) e cópia de homologação.
ALTER TYPE "BackupSource" ADD VALUE IF NOT EXISTS 'STORED_BACKUP';
ALTER TYPE "BackupSource" ADD VALUE IF NOT EXISTS 'HOMOLOGATION_COPY';
