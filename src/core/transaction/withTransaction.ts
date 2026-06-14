import type { NextFunction, Request, Response } from "express";
import prismaClient from "@database/prisma";
import { runWithContext, type AuthUser } from "@core/context/requestContext";

/**
 * Abre uma transação Prisma e executa `fn` dentro de um RequestContext
 * (AsyncLocalStorage). Garante a regra: toda operação de banco ocorre em
 * transação (CLAUDE.md §9). Usado tanto por rotas HTTP quanto por workers.
 */
export async function runInTransaction<T>(
  fn: () => Promise<T>,
  meta: { user?: AuthUser; requestId?: string; ipAddress?: string } = {},
): Promise<T> {
  return prismaClient.$transaction((transaction) =>
    Promise.resolve(
      runWithContext({ transaction, ...meta }, fn),
    ),
  );
}

/**
 * Wrapper de handler Express: envolve o handler numa transação + contexto e
 * encaminha erros ao errorHandler. Centraliza o boilerplate try/catch.
 */
export function withTransaction(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await runInTransaction(() => handler(req, res), {
        user: (req as Request & { user?: AuthUser }).user,
        ipAddress: req.ip,
      });
    } catch (err) {
      next(err);
    }
  };
}
