import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { ProjectController } from "@modules/project/ProjectController";
import { createProjectSchema, updateProjectSchema, addVariableSchema } from "@modules/project/projectSchemas";

/** Rotas de projetos (cadastro/admin). */
export function projectRoutes(): Router {
  const controller = container.get(ProjectController);
  const router = Router();
  const route = new RouteBuilder(router);
  const admin = route.with(requireRole("ADMIN"));

  route.get("/", () => controller.list());
  route.get("/:id", (req) => controller.getById(req));

  route
    .with(requireRole("ADMIN"), validateBody(createProjectSchema))
    .post("/", (req) => controller.create(req));
  route
    .with(requireRole("ADMIN"), validateBody(updateProjectSchema))
    .put("/:id", (req) => controller.update(req));
  route
    .with(requireRole("ADMIN"), validateBody(addVariableSchema))
    .post("/:id/variables", (req) => controller.addVariable(req));
  admin.delete("/:id/variables/:key", (req) => controller.removeVariable(req));

  return router;
}
