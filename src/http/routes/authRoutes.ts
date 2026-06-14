import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { AuthController } from "@modules/auth/AuthController";
import { loginSchema, refreshSchema, registerSchema } from "@modules/auth/authSchemas";

/** Rotas de autenticação. `login`/`refresh` públicas; `register` só ADMIN. */
export function authRoutes(): Router {
  const controller = container.get(AuthController);
  const router = Router();
  const route = new RouteBuilder(router);

  route.with(validateBody(loginSchema)).post("/login", (req, res) => controller.login(req, res));
  route.with(validateBody(refreshSchema)).post("/refresh", (req, res) => controller.refresh(req, res));
  route.with(validateBody(refreshSchema)).post("/logout", (req, res) => controller.logout(req, res));
  route
    .with(requireRole("ADMIN"), validateBody(registerSchema))
    .post("/register", (req, res) => controller.register(req, res));

  // `me` não usa transação: lê apenas o req.user já resolvido pelo middleware.
  router.get("/me", (req, res) => controller.me(req, res));

  return router;
}
