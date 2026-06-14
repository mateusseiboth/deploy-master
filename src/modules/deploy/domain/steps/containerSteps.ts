import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IContainerOrchestrator } from "@modules/deploy/domain/ports";
import { DeployError } from "@core/errors/AppError";
import { DeployStep } from "./IDeployStep";

export class BuildImageStep extends DeployStep {
  readonly name = "BuildImage";
  constructor(private readonly docker: IContainerOrchestrator) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    if (!ctx.workdir) throw new DeployError("workdir ausente para build", this.name);
    ctx.imageTag = `${ctx.slug}:latest`;
    ctx.log(`Buildando imagem ${ctx.imageTag}`);
    await this.docker.buildImage(ctx.workdir, ctx.project.dockerfilePath, ctx.imageTag);
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    if (ctx.imageTag) await this.docker.removeImage(ctx.imageTag);
  }
}

export class CreateNetworkStep extends DeployStep {
  readonly name = "CreateNetwork";
  constructor(private readonly docker: IContainerOrchestrator) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.networkName = `net-${ctx.slug}`;
    ctx.log(`Criando rede isolada ${ctx.networkName}`);
    await this.docker.createNetwork(ctx.networkName);
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    if (ctx.networkName) await this.docker.removeNetwork(ctx.networkName);
  }
}

export class RunContainerStep extends DeployStep {
  readonly name = "RunContainer";
  constructor(private readonly docker: IContainerOrchestrator) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    if (!ctx.imageTag || !ctx.networkName) {
      throw new DeployError("imagem/rede ausentes para executar container", this.name);
    }
    ctx.log(`Subindo container ${ctx.slug}`);
    ctx.containerId = await this.docker.runContainer({
      image: ctx.imageTag,
      name: ctx.slug,
      network: ctx.networkName,
      proxyNetwork: ctx.settings.traefikNetwork,
      env: ctx.resolvedEnv,
      labels: ctx.routeLabels,
      command: ctx.project.startCommand ?? undefined,
    });
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    if (!ctx.containerId) return;
    await this.docker.stopContainer(ctx.containerId);
    await this.docker.removeContainer(ctx.containerId);
  }
}
