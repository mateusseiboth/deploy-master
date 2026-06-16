import { Injectable } from "@di/Injectable";
import type { DeployContext } from "@modules/deploy/domain/DeployContext";

import { GitSourceProvider } from "@modules/gitlab/GitSourceProvider";
import { DockerService } from "@modules/docker/DockerService";
import { PiholeDnsService } from "@modules/dns/PiholeDnsService";
import { PostgresAdmin } from "@modules/database/PostgresAdmin";

import { DatabaseStrategyFactory } from "@modules/deploy/domain/strategies/database/DatabaseStrategyFactory";
import { HostnameStrategyFactory } from "@modules/deploy/domain/strategies/hostname/HostnameStrategyFactory";
import { CertificateStrategyFactory } from "@modules/deploy/domain/strategies/certificate/CertificateStrategyFactory";
import { ReverseProxyStrategyFactory } from "@modules/deploy/domain/strategies/proxy/ReverseProxyStrategyFactory";

import { CloneRepositoryStep, CheckoutCommitStep } from "@modules/deploy/domain/steps/sourceSteps";
import { BuildImageStep, CreateNetworkStep, RunContainerStep } from "@modules/deploy/domain/steps/containerSteps";
import { ProvisionDatabaseStep } from "@modules/deploy/domain/steps/databaseStep";
import { ResolveHostnameStep, ResolveEnvVarsStep, ComputeRouteStep } from "@modules/deploy/domain/steps/resolveSteps";
import { RegisterDnsStep, HealthCheckStep } from "@modules/deploy/domain/steps/dnsAndHealthSteps";

import { DeployPipelineBuilder } from "./DeployPipelineBuilder";
import type { DeployPipeline } from "./DeployPipeline";

/**
 * Factory do pipeline: resolve as STRATEGIES a partir da configuração do projeto
 * (via factories especializadas) e usa o BUILDER para montar a ordem dos steps.
 *
 * Concentra a única decisão de "qual implementação para qual config" — nenhum
 * `if/else` de seleção vaza para Services ou steps (OCP/DIP).
 */
@Injectable()
export class DeployPipelineFactory {
  constructor(
    private readonly source: GitSourceProvider,
    private readonly docker: DockerService,
    private readonly dns: PiholeDnsService,
    private readonly postgres: PostgresAdmin,
    private readonly databaseStrategies: DatabaseStrategyFactory,
    private readonly hostnameStrategies: HostnameStrategyFactory,
    private readonly certificateStrategies: CertificateStrategyFactory,
    private readonly proxyStrategies: ReverseProxyStrategyFactory,
  ) {}

  create(ctx: DeployContext): DeployPipeline {
    const { project } = ctx;

    const hostnameStrategy = this.hostnameStrategies.create(project.hostnameFormat);
    const certificateStrategy = this.certificateStrategies.create(project.certificateProvider);
    const proxyStrategy = this.proxyStrategies.create(project.reverseProxy, certificateStrategy);

    // Banco é provisionado ANTES do build: além de falhar cedo (sem desperdiçar
    // build), a URL do banco já entra como build-arg — Dockerfiles que rodam
    // migrations em build-time precisam da env do banco configurada. Projetos
    // sem banco (`requiresDatabase=false`) pulam o provisionamento.
    const builder = new DeployPipelineBuilder()
      .add(new CloneRepositoryStep(this.source))
      .add(new CheckoutCommitStep(this.source))
      .add(new CreateNetworkStep(this.docker));

    if (project.requiresDatabase) {
      builder.add(new ProvisionDatabaseStep(this.databaseStrategies.create(ctx.request.databaseSource), this.postgres));
    }

    return builder
      .add(new ResolveHostnameStep(hostnameStrategy))
      .add(new ResolveEnvVarsStep())
      .add(new BuildImageStep(this.docker))
      .add(new ComputeRouteStep(proxyStrategy))
      .add(new RunContainerStep(this.docker))
      .add(new RegisterDnsStep(this.dns))
      .add(new HealthCheckStep(this.docker, this.dns, this.postgres))
      .build();
  }
}
