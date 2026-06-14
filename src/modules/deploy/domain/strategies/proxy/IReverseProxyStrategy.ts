import type { DeployContext } from "@modules/deploy/domain/DeployContext";

/**
 * Estratégia de proxy reverso. Produz a configuração de roteamento do ambiente
 * e sabe desfazê-la. No Traefik a rota é declarada por labels no container; em
 * Caddy seria via Admin API.
 */
export interface IReverseProxyStrategy {
  /** Labels/config de roteamento aplicadas ao container (TLS incluso). */
  buildRouteLabels(ctx: DeployContext): Record<string, string>;
  /** Remove a rota (no Traefik é no-op: some com o container). */
  removeRoute(ctx: DeployContext): Promise<void>;
}
