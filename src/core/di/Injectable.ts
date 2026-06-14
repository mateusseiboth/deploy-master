import "reflect-metadata";

/**
 * Marca uma classe como injetável e persiste os tipos do construtor para que o
 * container resolva as dependências recursivamente.
 *
 * Necessário porque `design:paramtypes` só é emitido quando há ao menos um
 * decorator na classe — `@Injectable()` garante essa emissão.
 */
export const DI_PARAMTYPES_KEY = "di:paramtypes";

export function Injectable(): ClassDecorator {
  return (target) => {
    const paramtypes = Reflect.getMetadata("design:paramtypes", target) ?? [];
    Reflect.defineMetadata(DI_PARAMTYPES_KEY, paramtypes, target);
  };
}
