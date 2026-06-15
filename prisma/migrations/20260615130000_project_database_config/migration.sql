-- Banco do ambiente: flag + variável de destino + template de URL.
-- Colunas adicionadas separadamente (a migration anterior já estava aplicada sem
-- elas). IF NOT EXISTS torna a aplicação idempotente entre ambientes.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "requiresDatabase" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "databaseEnvVar" TEXT NOT NULL DEFAULT 'DATABASE_URL';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "databaseUrlTemplate" TEXT;
