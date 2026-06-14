import { Router, type RequestHandler } from "express";
import { withTransaction } from "@core/transaction/withTransaction";

type Handler = (req: import("express").Request, res: import("express").Response) => Promise<void>;

/**
 * Builder fluente de rotas sobre um Express Router.
 *
 * - `.use()` adiciona middlewares à cadeia (ex.: auth, RBAC) e retorna `this`.
 * - Os verbos (`get/post/put/delete`) embrulham o handler em `withTransaction`,
 *   garantindo transação + contexto sem repetir try/catch (DRY).
 */
export class RouteBuilder {
  private readonly chain: RequestHandler[] = [];

  constructor(private readonly router: Router = Router()) {}

  use(...middlewares: RequestHandler[]): this {
    this.chain.push(...middlewares);
    return this;
  }

  /** Deriva um novo builder com middlewares adicionais, preservando a cadeia. */
  with(...middlewares: RequestHandler[]): RouteBuilder {
    const next = new RouteBuilder(this.router);
    next.chain.push(...this.chain, ...middlewares);
    return next;
  }

  get(path: string, handler: Handler): this {
    this.router.get(path, ...this.chain, withTransaction(handler));
    return this;
  }

  post(path: string, handler: Handler): this {
    this.router.post(path, ...this.chain, withTransaction(handler));
    return this;
  }

  put(path: string, handler: Handler): this {
    this.router.put(path, ...this.chain, withTransaction(handler));
    return this;
  }

  delete(path: string, handler: Handler): this {
    this.router.delete(path, ...this.chain, withTransaction(handler));
    return this;
  }

  build(): Router {
    return this.router;
  }
}
