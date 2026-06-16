import express, { type Express } from "express";
import cors from "cors";
import { authContextMiddleware } from "@core/http/authMiddleware";
import { requireRole } from "@core/http/currentUser";
import { errorHandler } from "@core/http/errorHandler";
import { authRoutes } from "./routes/authRoutes";
import { environmentRoutes } from "./routes/environmentRoutes";
import { projectRoutes } from "./routes/projectRoutes";
import { gitlabRoutes, gitlabGlobalRoutes } from "./routes/gitlabRoutes";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { backupRoutes } from "./routes/backupRoutes";
import { settingsRoutes } from "./routes/settingsRoutes";
import { queueRoutes } from "./routes/queueRoutes";

/**
 * Monta a aplicação Express: middlewares globais, rotas da API e o handler de
 * erros ao final. `authContextMiddleware` popula `req.user` do JWT; os routers
 * protegidos exigem ao menos um usuário autenticado (VIEWER+).
 */
export function buildApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(authContextMiddleware);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Públicas (login/refresh) + protegidas (register exige ADMIN internamente).
  app.use("/api/auth", authRoutes());

  // Tudo abaixo exige autenticação (qualquer papel).
  const authenticated = requireRole();
  app.use("/api/projects", authenticated, projectRoutes());
  app.use("/api/projects", authenticated, gitlabRoutes());
  app.use("/api/gitlab", authenticated, gitlabGlobalRoutes());
  app.use("/api/environments", authenticated, environmentRoutes());
  app.use("/api/dashboard", authenticated, dashboardRoutes());
  app.use("/api/backups", authenticated, backupRoutes());
  app.use("/api/settings", authenticated, settingsRoutes());
  app.use("/api/queue", authenticated, queueRoutes());

  app.use(errorHandler);
  return app;
}
