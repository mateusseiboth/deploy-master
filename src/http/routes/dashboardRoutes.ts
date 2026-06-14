import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { DashboardController } from "@modules/dashboard/DashboardController";

/** Rota de indicadores agregados. */
export function dashboardRoutes(): Router {
  const controller = container.get(DashboardController);
  const router = Router();
  new RouteBuilder(router).get("/", (req, res) => controller.indicators(req, res));
  return router;
}
