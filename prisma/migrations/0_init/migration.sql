-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'QA', 'VIEWER');

-- CreateEnum
CREATE TYPE "DatabaseStrategy" AS ENUM ('UPLOAD_SQL', 'COPY_PRODUCTION');

-- CreateEnum
CREATE TYPE "HostnameFormat" AS ENUM ('PROJECT_HASH', 'PROJECT_BRANCH', 'PROJECT_USER_HASH');

-- CreateEnum
CREATE TYPE "CertificateProvider" AS ENUM ('INTERNAL_CA', 'LETS_ENCRYPT');

-- CreateEnum
CREATE TYPE "ReverseProxyProvider" AS ENUM ('TRAEFIK', 'CADDY');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED', 'EXPIRING', 'EXPIRED', 'REMOVING', 'REMOVED');

-- CreateEnum
CREATE TYPE "BackupSource" AS ENUM ('UPLOAD', 'PRODUCTION_COPY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'RENEW', 'RESTART', 'DELETE', 'AUTO_EXPIRE');

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "piholeBaseUrl" TEXT NOT NULL DEFAULT '',
    "piholeApiToken" TEXT NOT NULL DEFAULT '',
    "reverseProxyIp" TEXT NOT NULL DEFAULT '',
    "traefikNetwork" TEXT NOT NULL DEFAULT 'traefik-public',
    "baseDomain" TEXT NOT NULL DEFAULT 'qa.local',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'QA',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gitlabProjectId" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "gitlabToken" TEXT NOT NULL,
    "dockerfilePath" TEXT NOT NULL DEFAULT 'Dockerfile',
    "buildCommand" TEXT,
    "startCommand" TEXT,
    "productionDbUrl" TEXT,
    "databaseStrategy" "DatabaseStrategy" NOT NULL DEFAULT 'UPLOAD_SQL',
    "hostnameFormat" "HostnameFormat" NOT NULL DEFAULT 'PROJECT_HASH',
    "certificateProvider" "CertificateProvider" NOT NULL DEFAULT 'INTERNAL_CA',
    "reverseProxy" "ReverseProxyProvider" NOT NULL DEFAULT 'TRAEFIK',
    "baseDomain" TEXT NOT NULL DEFAULT 'qa.local',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_variables" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,

    CONSTRAINT "project_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_deadlines" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "defaultDays" INTEGER NOT NULL DEFAULT 7,
    "maxDays" INTEGER NOT NULL DEFAULT 30,
    "maxRenewals" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "project_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "commitAuthor" TEXT,
    "commitMessage" TEXT,
    "commitDate" TIMESTAMP(3),
    "status" "EnvironmentStatus" NOT NULL DEFAULT 'PENDING',
    "hostname" TEXT,
    "url" TEXT,
    "containerId" TEXT,
    "networkName" TEXT,
    "volumeName" TEXT,
    "databaseName" TEXT,
    "imageTag" TEXT,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_variable_values" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "environment_variable_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_services" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalPort" INTEGER NOT NULL,
    "hostname" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "environment_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environment_backups" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "source" "BackupSource" NOT NULL,
    "filePath" TEXT,
    "sizeBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "environment_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "environmentId" TEXT,
    "projectId" TEXT,
    "commitHash" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_variables_projectId_key_key" ON "project_variables"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "project_deadlines_projectId_key" ON "project_deadlines"("projectId");

-- CreateIndex
CREATE INDEX "environments_projectId_idx" ON "environments"("projectId");

-- CreateIndex
CREATE INDEX "environments_status_idx" ON "environments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "environment_variable_values_environmentId_key_key" ON "environment_variable_values"("environmentId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "environment_backups_environmentId_key" ON "environment_backups"("environmentId");

-- CreateIndex
CREATE INDEX "audit_logs_environmentId_idx" ON "audit_logs"("environmentId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_variables" ADD CONSTRAINT "project_variables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_deadlines" ADD CONSTRAINT "project_deadlines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environments" ADD CONSTRAINT "environments_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_variable_values" ADD CONSTRAINT "environment_variable_values_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_services" ADD CONSTRAINT "environment_services_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environment_backups" ADD CONSTRAINT "environment_backups_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

