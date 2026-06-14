/**
 * Port de cache. Consumidores dependem desta interface (DIP); o driver concreto
 * (memória ou SQLite) é escolhido pela `CacheFactory` via env. Sem Redis.
 */
export interface ICache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
  /** Remove todas as chaves com o prefixo informado (invalidação por namespace). */
  deleteByPrefix(prefix: string): void;
  clear(): void;
}
