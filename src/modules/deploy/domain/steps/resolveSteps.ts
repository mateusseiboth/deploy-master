import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { IHostnameStrategy } from "@modules/deploy/domain/strategies/hostname/IHostnameStrategy";
import type { IReverseProxyStrategy } from "@modules/deploy/domain/strategies/proxy/IReverseProxyStrategy";
import { DeployStep } from "./IDeployStep";

/** Gera hostname + URL do ambiente conforme a estratégia do projeto. */
export class ResolveHostnameStep extends DeployStep {
  readonly name = "ResolveHostname";
  constructor(private readonly hostname: IHostnameStrategy) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    const host = `${this.hostname.build(ctx)}.${ctx.project.baseDomain}`;
    ctx.hostname = host;
    ctx.url = `https://${host}`;
    ctx.log(`Hostname resolvido: ${host}`);
  }
}

/**
 * Aplica a query de um template (ex.: `?schema=public`) sobre a URL do banco
 * efêmero, preservando usuário/senha/host/porta/banco gerados automaticamente.
 */
function applyUrlTemplate(databaseUrl: string, template?: string | null): string {
  if (!template) return databaseUrl;
  try {
    const generated = new URL(databaseUrl);
    generated.search = new URL(template).search;
    return generated.toString();
  } catch {
    return databaseUrl;
  }
}

/**
 * Resolve as variáveis finais do container: overrides AUTORIZADOS informados
 * pelo QA + injeção automática da URL do banco efêmero (quando o projeto depende
 * de banco) na variável configurada (`databaseEnvVar`, ex.: DATABASE_URL).
 * (Whitelist é validada no Service antes de chegar aqui.)
 */
export class ResolveEnvVarsStep extends DeployStep {
  readonly name = "ResolveEnvVars";
  async execute(ctx: DeployContext): Promise<void> {
    const resolved: Record<string, string> = {
      ...ctx.request.variableOverrides,
      ENVIRONMENT_URL: ctx.url ?? "",
    };

    if (ctx.project.requiresDatabase) {
      const key = ctx.project.databaseEnvVar || "DATABASE_URL";
      resolved[key] = applyUrlTemplate(ctx.databaseUrl ?? "", ctx.project.databaseUrlTemplate);
    }

    ctx.resolvedEnv = resolved;
    ctx.log(`Variáveis resolvidas (${Object.keys(ctx.resolvedEnv).length})`);
  }
}

/** Calcula as labels/config de rota do proxy (com TLS) para o container. */
export class ComputeRouteStep extends DeployStep {
  readonly name = "ComputeRoute";
  constructor(private readonly proxy: IReverseProxyStrategy) {
    super();
  }
  async execute(ctx: DeployContext): Promise<void> {
    ctx.routeLabels = this.proxy.buildRouteLabels(ctx);
    ctx.log("Rota do proxy reverso calculada");
  }
  override async compensate(ctx: DeployContext): Promise<void> {
    await this.proxy.removeRoute(ctx);
  }
}
