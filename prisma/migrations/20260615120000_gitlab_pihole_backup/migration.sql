-- Pi-hole v6 usa senha (não API token): troca a coluna preservando o singleton.
ALTER TABLE "system_settings" DROP COLUMN "piholeApiToken";
ALTER TABLE "system_settings" ADD COLUMN "piholePassword" TEXT NOT NULL DEFAULT '';

-- GitLab global (token geral; projetos buscam pela API).
ALTER TABLE "system_settings" ADD COLUMN "gitlabBaseUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_settings" ADD COLUMN "gitlabApiToken" TEXT NOT NULL DEFAULT '';

-- Backup automático do PostgreSQL de produção.
ALTER TABLE "system_settings" ADD COLUMN "prodBackupDbUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_settings" ADD COLUMN "prodBackupDir" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_settings" ADD COLUMN "prodBackupIntervalHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "system_settings" ADD COLUMN "prodBackupEnabled" BOOLEAN NOT NULL DEFAULT false;

-- URL/token do repositório passam a ter default '' (fallback para o GitLab global).
ALTER TABLE "projects" ALTER COLUMN "repositoryUrl" SET DEFAULT '';
ALTER TABLE "projects" ALTER COLUMN "gitlabToken" SET DEFAULT '';

-- Logs das execuções de backup de produção.
CREATE TYPE "BackupTrigger" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "production_backup_logs" (
    "id" TEXT NOT NULL,
    "trigger" "BackupTrigger" NOT NULL,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "directory" TEXT NOT NULL,
    "databases" JSONB,
    "totalBytes" BIGINT,
    "message" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "production_backup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "production_backup_logs_status_idx" ON "production_backup_logs"("status");
