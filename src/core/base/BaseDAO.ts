import type { Prisma } from "@prisma-generated/client";
import { requireContext } from "@core/context/requestContext";

/**
 * Base de DAOs. ÚNICA camada autorizada a tocar o Prisma (CLAUDE.md §8.1).
 *
 * `this.tx` resolve a transação ativa do AsyncLocalStorage — nunca recebe a
 * conexão por parâmetro, garantindo que toda query rode dentro da transação
 * aberta por withTransaction.
 */
export abstract class BaseDAO {
  protected get tx(): Prisma.TransactionClient {
    return requireContext(
      "Transação ausente no contexto. A operação precisa passar por withTransaction.",
    ).transaction;
  }
}
