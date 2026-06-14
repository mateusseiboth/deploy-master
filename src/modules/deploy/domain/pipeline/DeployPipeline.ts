import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IDeployStep } from "@modules/deploy/domain/steps/IDeployStep";
import { DeployError } from "@core/errors/AppError";

export interface PipelineResult {
  success: boolean;
  failedStep?: string;
  error?: unknown;
}

/**
 * Executor do pipeline. Roda os steps em ordem; em caso de falha, executa
 * `compensate` dos steps já concluídos na ordem inversa (rollback) e propaga o
 * erro. `teardown` reaproveita os mesmos steps para a remoção do ambiente.
 */
export class DeployPipeline {
  constructor(private readonly steps: ReadonlyArray<IDeployStep>) {}

  async execute(ctx: DeployContext): Promise<PipelineResult> {
    const executed: IDeployStep[] = [];
    try {
      for (const step of this.steps) {
        ctx.log(`▶ ${step.name}`);
        await step.execute(ctx);
        executed.push(step);
      }
      return { success: true };
    } catch (error) {
      const failedStep = executed.length < this.steps.length
        ? this.steps[executed.length]?.name
        : undefined;
      ctx.log(`✖ Falha em ${failedStep}: ${(error as Error).message}`);
      await this.rollback(ctx, executed);
      return { success: false, failedStep, error };
    }
  }

  /** Desfaz, em ordem inversa, os steps informados (rollback ou cleanup). */
  private async rollback(ctx: DeployContext, executed: IDeployStep[]): Promise<void> {
    for (const step of [...executed].reverse()) {
      try {
        await step.compensate(ctx);
        ctx.log(`↩ compensado: ${step.name}`);
      } catch (err) {
        ctx.log(`⚠ falha ao compensar ${step.name}: ${(err as Error).message}`);
      }
    }
  }

  /** Remoção completa do ambiente: compensa todos os steps (ordem inversa). */
  async teardown(ctx: DeployContext): Promise<void> {
    await this.rollback(ctx, [...this.steps]);
  }

  /** Garante que o pipeline tem steps (Builder mal usado falha cedo). */
  assertNotEmpty(): void {
    if (this.steps.length === 0) {
      throw new DeployError("Pipeline de deploy vazio");
    }
  }
}
