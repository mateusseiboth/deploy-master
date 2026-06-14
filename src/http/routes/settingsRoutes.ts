import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { SettingsController } from "@modules/settings/SettingsController";
import { updateSettingsSchema } from "@modules/settings/settingsSchemas";

/** Configurações do sistema (Pi-hole / proxy). Escrita restrita a ADMIN. */
export function settingsRoutes(): Router {
  const controller = container.get(SettingsController);
  const router = Router();
  const route = new RouteBuilder(router);

  route.get("/", (req, res) => controller.get(req, res));
  route
    .with(requireRole("ADMIN"), validateBody(updateSettingsSchema))
    .put("/", (req, res) => controller.update(req, res));

  return router;
}
