import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { ProjectController } from "@modules/project/ProjectController";
import { createProjectSchema, addVariableSchema } from "@modules/project/projectSchemas";

/** Rotas de projetos (cadastro/admin). */
export function projectRoutes(): Router {
  const controller = container.get(ProjectController);
  const router = Router();
  const route = new RouteBuilder(router);
  const admin = route.with(requireRole("ADMIN"));

  route.get("/", (req, res) => controller.list(req, res));
  route.get("/:id", (req, res) => controller.getById(req, res));

  route
    .with(requireRole("ADMIN"), validateBody(createProjectSchema))
    .post("/", (req, res) => controller.create(req, res));
  route
    .with(requireRole("ADMIN"), validateBody(addVariableSchema))
    .post("/:id/variables", (req, res) => controller.addVariable(req, res));
  admin.delete("/:id/variables/:key", (req, res) => controller.removeVariable(req, res));

  return router;
}
