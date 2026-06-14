import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { ICertificateStrategy } from "../certificate/ICertificateStrategy";
import type { IReverseProxyStrategy } from "./IReverseProxyStrategy";

/**
 * Traefik via labels do container. Compõe com a estratégia de certificado
 * (Composition) para acrescentar as labels de TLS.
 */
export class TraefikReverseProxyStrategy implements IReverseProxyStrategy {
  constructor(private readonly certificate: ICertificateStrategy) {}

  buildRouteLabels(ctx: DeployContext): Record<string, string> {
    const router = ctx.slug;
    const host = ctx.hostname;
    if (!host) throw new Error("hostname não definido antes da rota do proxy");

    const labels: Record<string, string> = {
      "traefik.enable": "true",
      [`traefik.http.routers.${router}.rule`]: `Host(\`${host}\`)`,
      [`traefik.http.routers.${router}.entrypoints`]: "websecure",
      [`traefik.docker.network`]: ctx.settings.traefikNetwork,
    };

    return { ...labels, ...this.certificate.tlsLabels(ctx, router) };
  }

  async removeRoute(): Promise<void> {
    // Traefik descobre rotas pelas labels; ao remover o container a rota some.
  }
}

/**
 * Caddy: roteamento dinâmico via Admin API. Implementação de integração fica
 * para a Fase 3; a estrutura já respeita o contrato (OCP).
 */
export class CaddyReverseProxyStrategy implements IReverseProxyStrategy {
  constructor(private readonly certificate: ICertificateStrategy) {}

  buildRouteLabels(ctx: DeployContext): Record<string, string> {
    // Caddy não usa labels; o roteamento será aplicado via Admin API no step.
    // Mantém o contrato retornando metadados de rota para o adapter consumir.
    return {
      "deploy-master.caddy.host": ctx.hostname ?? "",
      "deploy-master.caddy.tls": "true",
    };
  }

  async removeRoute(_ctx: DeployContext): Promise<void> {
    // TODO(Fase 3): DELETE na Admin API do Caddy para a rota do hostname.
  }
}
