-- Vários servidores Pi-hole (DNS balanceado), cada um com URL+senha.
ALTER TABLE "system_settings" ADD COLUMN IF NOT EXISTS "piholeServers" JSONB NOT NULL DEFAULT '[]';
