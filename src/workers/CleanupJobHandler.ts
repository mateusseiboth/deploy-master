import { Injectable } from "@di/Injectable";
import { runInTransaction } from "@core/transaction/withTransaction";
import { JobType } from "@core/queue/IJobQueue";
import { EnvironmentService } from "@modules/environment/EnvironmentService";
import { DeployOrchestratorService } from "@modules/deploy/DeployOrchestratorService";
import type { IJobHandler } from "./IJobHandler";

interface CleanupPayload {
  environmentId: string;
  reason: string;
}

/**
 * Processa um job de cleanup: marca REMOVING, executa o teardown da
 * infraestrutura (compensa todos os steps) com o snapshot persistido e marca
 * REMOVED. Nenhum recurso deve permanecer órfão.
 */
@Injectable()
export class CleanupJobHandler implements IJobHandler<CleanupPayload> {
  readonly type = JobType.CLEANUP;

  constructor(
    private readonly environments: EnvironmentService,
    private readonly orchestrator: DeployOrchestratorService,
  ) {}

  async handle(payload: CleanupPayload): Promise<void> {
    const { environmentId } = payload;

    // Teardown é best-effort (idempotente e tolerante a "não existe"). Mesmo que
    // algo falhe, marcamos REMOVED no `finally` para o ambiente não ficar preso
    // em REMOVING (o que bloquearia recriar o mesmo commit). Recursos remanescentes
    // são removíveis por nova execução do cleanup (idempotência).
    try {
      const { inputs, snapshot } = await runInTransaction(async () => {
        const data = await this.environments.buildDeployInputs(environmentId);
        const environment = await this.environments.getById(environmentId);
        await this.environments.markRemoving(environmentId);
        return {
          inputs: data,
          snapshot: {
            containerId: environment.containerId,
            networkName: environment.networkName,
            volumeName: environment.volumeName,
            databaseName: environment.databaseName,
            hostname: environment.hostname,
            imageTag: environment.imageTag,
          },
        };
      });

      await this.orchestrator.destroy(inputs.project, inputs.request, inputs.settings, snapshot);
    } catch (err) {
      console.error(`[cleanup] ${environmentId} teardown com erro (marcando REMOVED): ${(err as Error).message}`);
    } finally {
      await runInTransaction(() => this.environments.markRemoved(environmentId)).catch((err) =>
        console.error(`[cleanup] ${environmentId} falha ao marcar REMOVED: ${(err as Error).message}`),
      );
    }
  }
}
