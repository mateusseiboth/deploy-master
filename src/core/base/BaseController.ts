import type { Request, Response } from "express";
import { type ZodType } from "zod";
import { BadRequestError } from "@core/errors/AppError";

/**
 * Base de Controllers. Responsabilidades estritas (CLAUDE.md §7): receber a
 * request, validar entrada, delegar ao Service e responder. Sem regra de negócio.
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

  protected ok(res: Response, data: unknown): void {
    res.status(200).json({ data });
  }

  protected created(res: Response, data: unknown): void {
    res.status(201).json({ data });
  }

  protected noContent(res: Response): void {
    res.status(204).end();
  }

  protected param(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string" || value.length === 0) {
      throw new BadRequestError(`Parâmetro obrigatório ausente: ${name}`);
    }
    return value;
  }
}
