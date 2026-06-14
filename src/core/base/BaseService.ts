import { requireContext, type AuthUser } from "@core/context/requestContext";

/**
 * Base de Services. Camada onde vivem as regras de negócio (CLAUDE.md §5/§6):
 * orquestração, validações de negócio, coordenação entre DAOs e integrações,
 * controle de fluxo. Não acessa Prisma diretamente.
 */
export abstract class BaseService {
  /** Usuário autenticado da request corrente (quando houver). */
  protected get currentUser(): AuthUser | undefined {
    return requireContext().user;
  }

  protected get ipAddress(): string | undefined {
    return requireContext().ipAddress;
  }
}
