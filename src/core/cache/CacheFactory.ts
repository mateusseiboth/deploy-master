import { env } from "@config/env";
import type { ICache } from "./ICache";
import { MemoryCache } from "./MemoryCache";
import { SqliteCache } from "./SqliteCache";

/** Factory que escolhe o driver de cache a partir de `CACHE_DRIVER`. */
export class CacheFactory {
  static create(driver = env.cache.driver, dbPath = env.cache.dbPath): ICache {
    switch (driver) {
      case "sqlite":
        return new SqliteCache(dbPath);
      case "memory":
        return new MemoryCache();
      default:
        throw new Error(`CACHE_DRIVER não suportado: ${driver}`);
    }
  }
}
