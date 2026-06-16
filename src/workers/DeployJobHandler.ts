import { Injectable } from "@di/Injectable";
import { runInTransaction } from "@core/transaction/withTransaction";
import { JobType } from "@core/queue/IJobQueue";
import { EnvironmentService } from "@modules/environment/EnvironmentService";
import { DeployOrchestratorService } from "@modules/deploy/DeployOrchestratorService";
import type { IJobHandler } from "./IJobHandler";

interface DeployPayload {
  environmentId: string;
}

/**
 * Processa um job de deploy: carrega os insumos e marca PROVISIONING (em
 * transação), executa o pipeline de infraestrutura FORA de transação (operações
 * longas) e persiste o resultado READY/FAILED (em transação).
 */
@Injectable()
export class DeployJobHandler implements IJobHandler<DeployPayload> {
  readonly type = JobType.DEPLOY;

  constructor(
    private readonly environments: EnvironmentService,
    private readonly orchestrator: DeployOrchestratorService,
  ) {}

  async handle(payload: DeployPayload): Promise<void> {
    const { environmentId } = payload;

    const inputs = await runInTransaction(async () => {
      // Lock de concorrência: só prossegue quem ganhar o CAS PENDING→PROVISIONING.
      const claimed = await this.environments.claimForDeploy(environmentId);
      if (!claimed) return null;
      // Zera a trilha de progresso (limpa tentativas anteriores em restart).
      await this.environments.appendDeployLog(environmentId, "");
      return this.environments.buildDeployInputs(environmentId);
    });

    if (!inputs) {
      console.log(`[deploy] ${environmentId} já em processamento ou estado inválido; descartando job`);
      return;
    }

    // Persiste a trilha de progresso ao vivo (consumida via SSE), com throttle
    // para não saturar o banco — o flush final garante o estado completo.
    const persistProgress = this.throttledProgress(environmentId);

    // Fase corrente (um write por step): exibida inline na lista de ambientes.
    const persistPhase = (label: string): void => {
      void runInTransaction(() => this.environments.setDeployPhase(environmentId, label)).catch(
        () => undefined,
      );
    };

    const { context, result } = await this.orchestrator.provision(
      inputs.project,
      inputs.request,
      inputs.settings,
      persistProgress.push,
      persistPhase,
    );

    await persistProgress.flush(context.logs.join("\n"));

    await runInTransaction(async () => {
      if (result.success) {
        await this.environments.markReady(environmentId, {
          hostname: context.hostname ?? "",
          url: context.url ?? "",
          containerId: context.containerId ?? "",
          networkName: context.networkName ?? "",
          databaseName: context.databaseName ?? "",
          imageTag: context.imageTag ?? "",
        });
        return;
      }
      const reason = `Falha em ${result.failedStep}: ${(result.error as Error)?.message ?? "desconhecida"}`;
      await this.environments.markFailed(environmentId, `${reason}\n\n${context.logs.join("\n")}`);
    });
  }

  /**
   * Persistência da trilha com throttle (~400ms). `push` agenda a gravação da
   * última trilha; `flush` força a gravação final (estado completo).
   */
  private throttledProgress(environmentId: string) {
    let latest = "";
    let timer: ReturnType<typeof setTimeout> | null = null;

    const write = (trail: string) =>
      runInTransaction(() => this.environments.appendDeployLog(environmentId, trail)).catch(() => undefined);

    return {
      push: (trail: string): void => {
        latest = trail;
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          void write(latest);
        }, 400);
      },
      flush: async (trail: string): Promise<void> => {
        if (timer) clearTimeout(timer);
        timer = null;
        await write(trail);
      },
    };
  }
}
