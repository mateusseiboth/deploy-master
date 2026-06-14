import { Injectable } from "@di/Injectable";
import { BaseService } from "@core/base/BaseService";
import {
  DeployContext,
  type DeployProjectConfig,
  type DeployRequest,
} from "@modules/deploy/domain/DeployContext";
import { DeployPipelineFactory } from "@modules/deploy/domain/pipeline/DeployPipelineFactory";
import type { PipelineResult } from "@modules/deploy/domain/pipeline/DeployPipeline";

export interface DeployOutcome {
  context: DeployContext;
  result: PipelineResult;
}

/** Snapshot dos recursos provisionados (persistido no Environment). */
export interface EnvRuntimeSnapshot {
  containerId?: string | null;
  networkName?: string | null;
  volumeName?: string | null;
  databaseName?: string | null;
  hostname?: string | null;
  imageTag?: string | null;
}

/**
 * Orquestra o provisionamento e a remoção de ambientes efêmeros usando o
 * pipeline (Factory monta, Builder ordena, Strategies executam). Não persiste
 * estado — devolve o contexto para a camada chamadora (EnvironmentService)
 * gravar status/auditoria. Mantém a regra de negócio de orquestração no Service.
 */
@Injectable()
export class DeployOrchestratorService extends BaseService {
  constructor(private readonly pipelineFactory: DeployPipelineFactory) {
    super();
  }

  /** Executa o pipeline completo de provisionamento. */
  async provision(project: DeployProjectConfig, request: DeployRequest): Promise<DeployOutcome> {
    const context = new DeployContext(project, request);
    const pipeline = this.pipelineFactory.create(context);
    const result = await pipeline.execute(context);
    return { context, result };
  }

  /**
   * Remove todos os recursos do ambiente (cleanup/expiração). Hidrata o contexto
   * com o snapshot persistido para que os `compensate` mirem os recursos reais;
   * identificadores determinísticos (rede/banco/imagem) caem no padrão do slug.
   */
  async destroy(
    project: DeployProjectConfig,
    request: DeployRequest,
    runtime: EnvRuntimeSnapshot = {},
  ): Promise<DeployContext> {
    const context = new DeployContext(project, request);
    context.containerId = runtime.containerId ?? undefined;
    context.networkName = runtime.networkName ?? `net-${context.slug}`;
    context.volumeName = runtime.volumeName ?? undefined;
    context.databaseName = runtime.databaseName ?? undefined;
    context.hostname = runtime.hostname ?? undefined;
    context.imageTag = runtime.imageTag ?? `${context.slug}:latest`;

    const pipeline = this.pipelineFactory.create(context);
    await pipeline.teardown(context);
    return context;
  }
}
