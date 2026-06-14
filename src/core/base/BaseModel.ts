/**
 * Base de modelos. Os modelos concretos devem implementar o tipo gerado pelo
 * Prisma (CLAUDE.md §10/§11) — ex.: `class ProjectModel implements Project`.
 * Esta base oferece apenas helpers comuns de hidratação.
 */
export abstract class BaseModel {
  /** Copia somente as chaves conhecidas do modelo a partir de um objeto cru. */
  protected assign<T extends object>(this: T, data: Partial<T>): T {
    Object.assign(this, data);
    return this;
  }
}
