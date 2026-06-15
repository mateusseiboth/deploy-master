import { Router } from "express";
import { container } from "@di/container";
import { sendResult } from "@core/http/HttpResult";
import { GitLabController } from "@modules/gitlab/GitLabController";

/**
 * Rotas de navegação GitLab, aninhadas em `/api/projects/:id/gitlab`.
 * Montadas junto com `projectRoutes` (mesmo prefixo).
 *
 * IMPORTANTE: NÃO usam `RouteBuilder`/`withTransaction`. Estas rotas fazem
 * chamadas HTTP ao GitLab — mantê-las dentro de uma transação Prisma faria a
 * transação expirar (P2028) quando o GitLab demorasse. O `GitLabService` abre
 * transações curtas só para as leituras de banco. Express 5 encaminha rejeições
 * de promises ao errorHandler automaticamente.
 */
export function gitlabRoutes(): Router {
  const controller = container.get(GitLabController);
  const router = Router();

  router.get("/:id/gitlab/validate", async (req, res) => sendResult(res, await controller.validateToken(req)));
  router.get("/:id/gitlab/branches", async (req, res) => sendResult(res, await controller.branches(req)));
  router.get("/:id/gitlab/commits", async (req, res) => sendResult(res, await controller.commits(req)));
  router.get("/:id/gitlab/commits/:hash", async (req, res) => sendResult(res, await controller.commitDetail(req)));
  router.get("/:id/gitlab/pipeline", async (req, res) => sendResult(res, await controller.pipeline(req)));

  return router;
}

/**
 * Rotas GitLab GLOBAIS (token geral em settings), montadas em `/api/gitlab`.
 * Usadas no cadastro para listar projetos sem informar URL/token por projeto.
 * Também sem transação (ver nota acima).
 */
export function gitlabGlobalRoutes(): Router {
  const controller = container.get(GitLabController);
  const router = Router();

  router.get("/projects", async (_req, res) => sendResult(res, await controller.listProjects()));

  return router;
}
