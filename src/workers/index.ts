import "reflect-metadata";
import { container } from "@di/container";
import { Worker } from "./Worker";
import { ExpirationScheduler } from "./ExpirationScheduler";

/**
 * Entry point do processo de workers: consome a fila (deploy/cleanup) e roda o
 * cron de expiração. Executar com `bun run worker`, separado da API HTTP.
 */
async function main(): Promise<void> {
  const worker = container.get(Worker);
  const scheduler = container.get(ExpirationScheduler);

  scheduler.start();

  const shutdown = () => {
    console.log("Encerrando workers...");
    worker.stop();
    scheduler.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await worker.start();
}

void main();
