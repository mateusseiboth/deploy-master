import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { BadRequestError } from "@core/errors/AppError";

/**
 * Middleware de validação de body que roda ANTES do `withTransaction` — entrada
 * inválida retorna 400 sem abrir transação no banco. Substitui o body por sua
 * versão parseada/coagida, que o controller consome com segurança de tipos.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new BadRequestError("Dados inválidos", result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}
