import { CertificateProvider } from "@prisma-generated/enums";
import type { ICertificateStrategy } from "./ICertificateStrategy";
import {
  InternalCaCertificateStrategy,
  LetsEncryptCertificateStrategy,
} from "./strategies";

export class CertificateStrategyFactory {
  create(provider: CertificateProvider): ICertificateStrategy {
    switch (provider) {
      case CertificateProvider.INTERNAL_CA:
        return new InternalCaCertificateStrategy();
      case CertificateProvider.LETS_ENCRYPT:
        return new LetsEncryptCertificateStrategy();
      default:
        throw new Error(`CertificateProvider não suportado: ${provider}`);
    }
  }
}
