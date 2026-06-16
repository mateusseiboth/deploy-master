-- Usuário de aplicação (role sujeito a RLS) com que o container conecta. Vazio =
-- conecta como admin (bypassa RLS). A senha é gerada pelo sistema a cada deploy.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "appDbUser" TEXT;
