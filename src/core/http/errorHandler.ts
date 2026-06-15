import type { NextFunction, Request, Response } from "express";
import { AppError } from "@core/errors/AppError";

/**
 * Middleware final de tratamento de erros. Traduz AppError -> status HTTP sem
 * acoplar a tipos concretos (cada erro carrega seu próprio statusCode — OCP).
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // A resposta já começou a ser enviada (ex.: handler respondeu e o COMMIT da
  // transação falhou depois). Não dá para trocar status/headers; delega ao
  // Express, que encerra o socket — em vez de estourar "headers already sent".
  if (res.headersSent) {
    console.error("[unhandled:after-response]", err);
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      details: err.details,
    });
    return;
  }

  console.error("[unhandled]", err);
  res.status(500).json({
    error: "InternalServerError",
    message: "Erro interno inesperado.",
  });
}
