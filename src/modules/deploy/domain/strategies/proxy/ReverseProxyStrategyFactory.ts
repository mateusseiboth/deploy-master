import { ReverseProxyProvider } from "@prisma-generated/enums";
import type { ICertificateStrategy } from "../certificate/ICertificateStrategy";
import type { IReverseProxyStrategy } from "./IReverseProxyStrategy";
import {
  CaddyReverseProxyStrategy,
  TraefikReverseProxyStrategy,
} from "./strategies";

/**
 * Factory do proxy reverso. Recebe a estratégia de certificado já resolvida e a
 * injeta no proxy (composição), garantindo HTTPS independente do provider.
 */
export class ReverseProxyStrategyFactory {
  create(
    provider: ReverseProxyProvider,
    certificate: ICertificateStrategy,
  ): IReverseProxyStrategy {
    switch (provider) {
      case ReverseProxyProvider.TRAEFIK:
        return new TraefikReverseProxyStrategy(certificate);
      case ReverseProxyProvider.CADDY:
        return new CaddyReverseProxyStrategy(certificate);
      default:
        throw new Error(`ReverseProxyProvider não suportado: ${provider}`);
    }
  }
}
