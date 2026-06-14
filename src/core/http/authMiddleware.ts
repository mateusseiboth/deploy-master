import type { NextFunction, Request, Response } from "express";
import { container } from "@di/container";
import { TokenService } from "@modules/auth/TokenService";
import type { AuthUser } from "@core/context/requestContext";

/**
 * Lê o Bearer token e popula `req.user` quando válido. Não bloqueia: a decisão
 * de exigir autenticação/role fica com `requireRole` (ISP — cada middleware com
 * uma responsabilidade). Substitui o placeholder por header.
 */
export function authContextMiddleware(
  req: Request & { user?: AuthUser },
  _res: Response,
  next: NextFunction,
): void {
  // Bearer no header (padrão) ou `access_token` na query (SSE/EventSource).
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : typeof req.query.access_token === "string"
      ? req.query.access_token
      : undefined;

  if (token) {
    try {
      req.user = container.get(TokenService).verifyAccess(token);
    } catch {
      // token inválido → segue sem usuário; requireRole devolve 401 se necessário
    }
  }
  next();
}

/** Verifica um token (ex.: handshake de WebSocket). Retorna null se inválido. */
export function verifyTokenOrNull(token: string | undefined): AuthUser | null {
  if (!token) return null;
  try {
    return container.get(TokenService).verifyAccess(token);
  } catch {
    return null;
  }
}
