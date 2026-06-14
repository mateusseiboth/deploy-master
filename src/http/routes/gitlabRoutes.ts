import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { GitLabController } from "@modules/gitlab/GitLabController";

/**
 * Rotas de navegação GitLab, aninhadas em `/api/projects/:id/gitlab`.
 * Montadas junto com `projectRoutes` (mesmo prefixo).
 */
export function gitlabRoutes(): Router {
  const controller = container.get(GitLabController);
  const router = Router();
  const route = new RouteBuilder(router);

  route.get("/:id/gitlab/validate", (req, res) => controller.validateToken(req, res));
  route.get("/:id/gitlab/branches", (req, res) => controller.branches(req, res));
  route.get("/:id/gitlab/commits", (req, res) => controller.commits(req, res));
  route.get("/:id/gitlab/commits/:hash", (req, res) => controller.commitDetail(req, res));
  route.get("/:id/gitlab/pipeline", (req, res) => controller.pipeline(req, res));

  return router;
}
