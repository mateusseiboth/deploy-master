import { HostnameFormat } from "@prisma-generated/enums";
import type { IHostnameStrategy } from "./IHostnameStrategy";
import {
  ProjectBranchHostnameStrategy,
  ProjectHashHostnameStrategy,
  ProjectUserHashHostnameStrategy,
} from "./strategies";

/**
 * Factory que seleciona a estratégia de hostname a partir do enum do projeto.
 * Mapa estático evita `switch` espalhado e mantém OCP (novo formato = nova
 * entrada + nova classe).
 */
export class HostnameStrategyFactory {
  private static readonly registry: Record<HostnameFormat, () => IHostnameStrategy> = {
    [HostnameFormat.PROJECT_HASH]: () => new ProjectHashHostnameStrategy(),
    [HostnameFormat.PROJECT_BRANCH]: () => new ProjectBranchHostnameStrategy(),
    [HostnameFormat.PROJECT_USER_HASH]: () => new ProjectUserHashHostnameStrategy(),
  };

  create(format: HostnameFormat): IHostnameStrategy {
    const factory = HostnameStrategyFactory.registry[format];
    if (!factory) throw new Error(`HostnameFormat não suportado: ${format}`);
    return factory();
  }
}
