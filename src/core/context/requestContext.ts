import { AsyncLocalStorage } from "async_hooks";
import type { Prisma } from "@prisma-generated/client";

/** Identidade do requisitante autenticado, anexada ao contexto. */
export interface AuthUser {
  id: string;
  role: "ADMIN" | "QA" | "VIEWER";
  email: string;
}

/**
 * Contexto vivo durante uma request (ou job). Carrega a transação ativa para que
 * os DAOs leiam `this.tx` sem precisar receber a transação por parâmetro — toda
 * operação de banco ocorre dentro de uma transação (CLAUDE.md §9).
 */
export interface RequestContext {
  transaction: Prisma.TransactionClient;
  user?: AuthUser;
  requestId?: string;
  ipAddress?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function requireContext(message?: string): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      message ??
        "RequestContext ausente. Garanta que a operação passa por withTransaction.",
    );
  }
  return ctx;
}
