import { Router } from "express";
import { container } from "@di/container";
import { RouteBuilder } from "@core/http/RouteBuilder";
import { requireRole } from "@core/http/currentUser";
import { validateBody } from "@core/http/validateBody";
import { sendResult } from "@core/http/HttpResult";
import { AuthController } from "@modules/auth/AuthController";
import { loginSchema, refreshSchema, registerSchema } from "@modules/auth/authSchemas";

/** Rotas de autenticação. `login`/`refresh` públicas; `register` só ADMIN. */
export function authRoutes(): Router {
  const controller = container.get(AuthController);
  const router = Router();
  const route = new RouteBuilder(router);

  route.with(validateBody(loginSchema)).post("/login", (req) => controller.login(req));
  route.with(validateBody(refreshSchema)).post("/refresh", (req) => controller.refresh(req));
  route.with(validateBody(refreshSchema)).post("/logout", (req) => controller.logout(req));
  route
    .with(requireRole("ADMIN"), validateBody(registerSchema))
    .post("/register", (req) => controller.register(req));

  // `me` não usa transação: lê apenas o req.user já resolvido pelo middleware.
  router.get("/me", (req, res) => sendResult(res, controller.me(req)));

  return router;
}
