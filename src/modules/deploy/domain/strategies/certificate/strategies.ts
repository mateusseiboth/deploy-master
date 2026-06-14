import type { DeployContext } from "@modules/deploy/domain/DeployContext";
import type { ICertificateStrategy } from "./ICertificateStrategy";

/**
 * CA interna corporativa: Traefik usa o certificado default (montado no proxy).
 * Apenas habilita TLS no router, sem certresolver ACME.
 */
export class InternalCaCertificateStrategy implements ICertificateStrategy {
  tlsLabels(_ctx: DeployContext, routerName: string): Record<string, string> {
    return {
      [`traefik.http.routers.${routerName}.tls`]: "true",
    };
  }
}

/** Let's Encrypt: usa o certresolver ACME configurado no Traefik. */
export class LetsEncryptCertificateStrategy implements ICertificateStrategy {
  constructor(private readonly resolverName = "letsencrypt") {}

  tlsLabels(_ctx: DeployContext, routerName: string): Record<string, string> {
    return {
      [`traefik.http.routers.${routerName}.tls`]: "true",
      [`traefik.http.routers.${routerName}.tls.certresolver`]: this.resolverName,
    };
  }
}
