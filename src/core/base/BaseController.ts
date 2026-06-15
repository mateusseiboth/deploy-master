import type { Request } from "express";
import { type ZodType } from "zod";
import { BadRequestError } from "@core/errors/AppError";
import type { HttpResult } from "@core/http/HttpResult";

/**
 * Base de Controllers. Responsabilidades estritas (CLAUDE.md §7): receber a
 * request, validar entrada, delegar ao Service e devolver um `HttpResult`.
 * Os helpers NÃO escrevem na resposta — quem o faz é o `withTransaction`, após
 * o commit. Sem regra de negócio.
 */
export abstract class BaseController {
  /** Valida e tipa o body via Zod, lançando BadRequest com os detalhes. */
  protected validate<T>(schema: ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new BadRequestError("Dados inválidos", result.error.flatten());
    }
    return result.data;
  }

  protected ok(data: unknown): HttpResult {
    return { status: 200, body: { data } };
  }

  protected created(data: unknown): HttpResult {
    return { status: 201, body: { data } };
  }

  /** 202: requisição aceita para processamento assíncrono (fila). */
  protected accepted(data: unknown): HttpResult {
    return { status: 202, body: { data } };
  }

  protected noContent(): HttpResult {
    return { status: 204 };
  }

  protected param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string" || value.length === 0) {
      throw new BadRequestError(`Parâmetro obrigatório ausente: ${name}`);
    }
    return value;
  }
}
