import { Injectable } from "@di/Injectable";
import type { ICache } from "./ICache";
import { CacheFactory } from "./CacheFactory";

/**
 * Fachada de cache injetável (singleton DI). Delega ao driver escolhido pela
 * `CacheFactory` conforme env, mantendo os consumidores acoplados só ao `ICache`.
 */
@Injectable()
export class Cache implements ICache {
  private readonly driver: ICache = CacheFactory.create();

  get<T>(key: string): T | undefined {
    return this.driver.get<T>(key);
  }
  set<T>(key: string, value: T, ttlMs?: number): void {
    this.driver.set(key, value, ttlMs);
  }
  delete(key: string): void {
    this.driver.delete(key);
  }
  deleteByPrefix(prefix: string): void {
    this.driver.deleteByPrefix(prefix);
  }
  clear(): void {
    this.driver.clear();
  }
}
