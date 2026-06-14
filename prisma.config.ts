// Carrega o .env para o CLI do Prisma (executa em Node, sem o auto-load do Bun).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
});
