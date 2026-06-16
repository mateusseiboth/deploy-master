-- Porta interna do container para o Traefik rotear (loadbalancer.server.port).
-- Padrão por projeto + override por deploy (ambiente). Idempotente.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "appPort" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "environments" ADD COLUMN IF NOT EXISTS "appPort" INTEGER;
