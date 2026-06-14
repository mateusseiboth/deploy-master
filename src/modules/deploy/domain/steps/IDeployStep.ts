import type { DeployContext } from "@modules/deploy/domain/DeployContext";

/**
 * Strategy de um passo do pipeline de deploy. Cada step é atômico, idempotente
 * e sabe compensar (rollback) o que criou. O executor encadeia os steps e, em
 * caso de falha, chama `compensate` na ordem inversa dos já executados.
 */
export interface IDeployStep {
  readonly name: string;
  execute(ctx: DeployContext): Promise<void>;
  /** Desfaz os efeitos do step. Deve ser idempotente e tolerante a "não existe". */
  compensate(ctx: DeployContext): Promise<void>;
}

/** Base com `compensate` no-op para steps puros (sem recurso a desfazer). */
export abstract class DeployStep implements IDeployStep {
  abstract readonly name: string;
  abstract execute(ctx: DeployContext): Promise<void>;
  async compensate(_ctx: DeployContext): Promise<void> {
    /* no-op por padrão */
  }
}
