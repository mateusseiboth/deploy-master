import type { DeployContext } from "@modules/deploy/domain/DeployContext";

/**
 * Estratégia de certificado/TLS. Contribui com a configuração de TLS para o
 * roteador do ambiente (ex.: labels do Traefik). Mantém o "como obter HTTPS"
 * isolado do "como rotear" (proxy).
 */
export interface ICertificateStrategy {
  /** Labels/config TLS a serem mescladas na rota do ambiente. */
  tlsLabels(ctx: DeployContext, routerName: string): Record<string, string>;
}
