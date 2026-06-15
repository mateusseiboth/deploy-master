import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IContainerOrchestrator, IDnsProvider, PiholeConfig } from "@modules/deploy/domain/ports";
import { DeployError } from "@core/errors/AppError";
import { tcpProbe } from "@core/process/tcpProbe";
import type { PostgresAdmin } from "@modules/database/PostgresAdmin";
import { DeployStep } from "./IDeployStep";

/** Extrai as credenciais do Pi-hole do contexto (cadastro do admin). */
function piholeOf(ctx: DeployContext): PiholeConfig {
  return { baseUrl: ctx.settings.piholeBaseUrl, password: ctx.settings.piholePassword };
}

/** Registra o hostname no Pi-hole apontando para o IP do proxy reverso. */
export class RegisterDnsStep extends DeployStep {
  readonly name = "RegisterDns";
  constructor(private readonly dns: IDnsProvider) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    if (!ctx.hostname) throw new DeployError("hostname ausente para DNS", this.name);
    const ip = ctx.settings.reverseProxyIp;
    ctx.log(`Registrando DNS ${ctx.hostname} -> ${ip}`);
    await this.dns.register(ctx.hostname, ip, piholeOf(ctx));

    // Valida propagação (best-effort: o HealthCheck é o gate final para READY).
    const propagated = await this.dns.waitForPropagation(ctx.hostname, ip);
    ctx.log(propagated ? "DNS propagado" : "DNS ainda não propagado (será revalidado no health check)");
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    if (ctx.hostname) await this.dns.unregister(ctx.hostname, ctx.settings.reverseProxyIp, piholeOf(ctx));
  }
}

/**
 * Gate final para READY: valida DNS resolvendo, app/proxy respondendo e
 * container saudável. Sem isto, o ambiente não vira READY.
 */
export class HealthCheckStep extends DeployStep {
  readonly name = "HealthCheck";
  constructor(
    private readonly docker: IContainerOrchestrator,
    private readonly dns: IDnsProvider,
    private readonly postgres: PostgresAdmin,
    private readonly attempts = 10,
    private readonly delayMs = 3000,
  ) {
    super();
  }

  async execute(ctx: DeployContext): Promise<void> {
    if (!ctx.containerId || !ctx.hostname) {
      throw new DeployError("dados insuficientes para health check", this.name);
    }
    for (let attempt = 1; attempt <= this.attempts; attempt++) {
      const checks = await this.runChecks(ctx);
      const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
      if (failed.length === 0) {
        ctx.log(`Health check OK (tentativa ${attempt}): DNS, container, proxy e banco`);
        return;
      }
      ctx.log(`Health check pendente (${attempt}/${this.attempts}); falhando: ${failed.join(", ")}`);
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    throw new DeployError("Health check falhou após múltiplas tentativas", this.name);
  }

  /** Verifica DNS resolvendo, container saudável, proxy ouvindo e banco conectado. */
  private async runChecks(ctx: DeployContext): Promise<Record<string, boolean>> {
    const proxyIp = ctx.settings.reverseProxyIp;
    const [dns, container, proxy, database] = await Promise.all([
      this.dns.isResolving(ctx.hostname!, proxyIp),
      this.docker.isHealthy(ctx.containerId!),
      tcpProbe(proxyIp, 443),
      ctx.databaseUrl ? this.postgres.canConnect(ctx.databaseUrl) : Promise.resolve(true),
    ]);
    return { dns, container, proxy, database };
  }
}
