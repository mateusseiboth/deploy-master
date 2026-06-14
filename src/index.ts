import "reflect-metadata";
import { env } from "@config/env";
import { buildApp } from "@http/buildApp";
import { attachConsoleWebsocket } from "@core/http/consoleWebsocket";

/** Entry point da API HTTP. Workers/cron rodam em processo separado (worker). */
function main(): void {
  const app = buildApp();
  const server = app.listen(env.app.port, () => {
    console.log(`🚀 Deploy Master API ouvindo na porta ${env.app.port}`);
  });

  // Console web interativo do container (WebSocket).
  attachConsoleWebsocket(server);
}

main();
