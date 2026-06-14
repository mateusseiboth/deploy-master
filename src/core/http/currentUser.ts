import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "@core/context/requestContext";

/** Exige usuário autenticado e, opcionalmente, um dos papéis informados. */
export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request & { user?: AuthUser }, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "Autenticação requerida" });
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden", message: "Permissão insuficiente" });
      return;
    }
    next();
  };
}
