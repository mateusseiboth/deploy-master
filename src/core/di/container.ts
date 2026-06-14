import "reflect-metadata";
import { DI_PARAMTYPES_KEY } from "./Injectable";

type Ctor<T = unknown> = new (...args: any[]) => T;

/**
 * Container de Injeção de Dependência — singleton com resolução automática via
 * reflect-metadata.
 *
 * Regras:
 * - Toda instância é singleton (uma por tipo durante o ciclo de vida do processo).
 * - Controllers / Services / DAOs devem ser STATELESS (sem estado de request).
 *   O estado de request vive no AsyncLocalStorage (ver core/context).
 * - Suporta `bind(token, impl)` para registrar implementações de interfaces
 *   (Strategy/Factory dependem disso para DIP).
 */
class Container {
  private readonly instances = new Map<Ctor, unknown>();
  private readonly bindings = new Map<Ctor, Ctor>();

  /** Liga um token (classe abstrata/base) a uma implementação concreta. */
  bind<T>(token: Ctor<T>, implementation: Ctor<T>): void {
    this.bindings.set(token, implementation);
  }

  /** Registra uma instância já construída (útil em testes e overrides). */
  register<T>(token: Ctor<T>, instance: T): void {
    this.instances.set(token, instance);
  }

  /** Resolve (ou cria) a instância singleton do tipo informado. */
  get<T>(token: Ctor<T>): T {
    const target = (this.bindings.get(token) ?? token) as Ctor<T>;

    const existing = this.instances.get(target);
    if (existing) return existing as T;

    const deps: Ctor[] =
      (Reflect.getMetadata(DI_PARAMTYPES_KEY, target) as Ctor[]) ??
      (Reflect.getMetadata("design:paramtypes", target) as Ctor[]) ??
      [];

    const args = deps.map((dep) => this.get(dep));
    const instance = new target(...args);
    this.instances.set(target, instance);
    return instance;
  }

  /** Limpa todas as instâncias e bindings (útil em testes). */
  clear(): void {
    this.instances.clear();
    this.bindings.clear();
  }
}

export const container = new Container();
