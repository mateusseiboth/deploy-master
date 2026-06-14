import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { Injectable } from "@di/Injectable";
import { env } from "@config/env";
import { UnauthorizedError } from "@core/errors/AppError";
import type { AuthUser } from "@core/context/requestContext";

interface AccessClaims {
  sub: string;
  role: AuthUser["role"];
  email: string;
}

/** Converte durações tipo `15m`/`7d`/`30s`/`12h` em milissegundos. */
function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

/**
 * Emissão/verificação de tokens. Access token é JWT assinado (stateless);
 * refresh token é opaco (UUID) persistido para permitir rotação/revogação.
 */
@Injectable()
export class TokenService {
  signAccess(user: AuthUser): string {
    const payload: AccessClaims = { sub: user.id, role: user.role, email: user.email };
    return jwt.sign(payload, env.auth.accessSecret, {
      expiresIn: env.auth.accessTtl as jwt.SignOptions["expiresIn"],
    });
  }

  verifyAccess(token: string): AuthUser {
    try {
      const decoded = jwt.verify(token, env.auth.accessSecret) as AccessClaims;
      return { id: decoded.sub, role: decoded.role, email: decoded.email };
    } catch {
      throw new UnauthorizedError("Token de acesso inválido ou expirado");
    }
  }

  /** Gera um refresh token opaco e sua data de expiração. */
  issueRefresh(): { token: string; expiresAt: Date } {
    return {
      token: randomUUID(),
      expiresAt: new Date(Date.now() + durationToMs(env.auth.refreshTtl)),
    };
  }
}
