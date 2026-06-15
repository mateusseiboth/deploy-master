import type { NextFunction, Request, Response } from "express";
import prismaClient from "@database/prisma";
import { env } from "@config/env";
import { runWithContext, type AuthUser } from "@core/context/requestContext";
import { sendResult, type HttpResult } from "@core/http/HttpResult";

/**
 * Abre uma transação Prisma e executa `fn` dentro de um RequestContext
 * (AsyncLocalStorage). Garante a regra: toda operação de banco ocorre em
 * transação (CLAUDE.md §9). Usado tanto por rotas HTTP quanto por workers.
 */
export async function runInTransaction<T>(
  fn: () => Promise<T>,
  meta: { user?: AuthUser; requestId?: string; ipAddress?: string } = {},
): Promise<T> {
  return prismaClient.$transaction(
    (transaction) =>
      Promise.resolve(runWithContext({ transaction, ...meta }, fn)),
    { timeout: env.database.txTimeoutMs, maxWait: env.database.txMaxWaitMs },
  );
}

type RouteHandler = (
  req: Request,
  res: Response,
) => HttpResult | void | Promise<HttpResult | void>;

/**
 * Wrapper de handler Express: executa o handler numa transação + contexto e só
 * então escreve a resposta — DEPOIS do commit. Assim o cliente nunca recebe um
 * 2xx por uma escrita que acabou sofrendo rollback, e o errorHandler consegue
 * responder o erro (a resposta ainda não foi enviada). Centraliza try/catch.
 */
export function withTransaction(handler: RouteHandler) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await runInTransaction(() => Promise.resolve(handler(req, res)), {
        user: (req as Request & { user?: AuthUser }).user,
        ipAddress: req.ip,
      });
      // Transação commitada. Se o handler já respondeu (ex.: stream), não mexe.
      if (result && !res.headersSent) sendResult(res, result);
    } catch (err) {
      next(err);
    }
  };
}
