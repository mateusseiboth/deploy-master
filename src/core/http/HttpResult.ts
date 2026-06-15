import type { Response } from "express";

/**
 * Resultado HTTP devolvido pelos controllers. A resposta só é escrita na
 * `Response` DEPOIS do commit da transação (ver `withTransaction`), evitando
 * responder ao cliente antes de confirmar a persistência — e o clássico
 * "Cannot set headers after they are sent" quando o COMMIT falha.
 */
export interface HttpResult {
  status: number;
  body?: unknown;
}

/** Escreve um `HttpResult` na resposta Express. */
export function sendResult(res: Response, result: HttpResult): void {
  if (result.body === undefined) {
    res.status(result.status).end();
    return;
  }
  res.status(result.status).json(result.body);
}
