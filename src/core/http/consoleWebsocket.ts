import type { Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { container } from "@di/container";
import { runInTransaction } from "@core/transaction/withTransaction";
import { verifyTokenOrNull } from "@core/http/authMiddleware";
import { EnvironmentService } from "@modules/environment/EnvironmentService";
import { DockerService } from "@modules/docker/DockerService";

const CONSOLE_PATH = /^\/api\/environments\/([^/]+)\/console$/;

/**
 * Anexa o servidor WebSocket do console web ao HTTP server. No upgrade:
 * autentica via `?access_token`, resolve o container do ambiente e liga o
 * shell interativo (exec hijack) ao socket (bidirecional).
 */
export function attachConsoleWebsocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const match = CONSOLE_PATH.exec(url.pathname);
    if (!match) return; // outro handler de upgrade pode tratar

    const user = verifyTokenOrNull(url.searchParams.get("access_token") ?? undefined);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    if (user.role === "VIEWER") {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const environmentId = decodeURIComponent(match[1]!);
    wss.handleUpgrade(req, socket, head, (ws) => {
      void bridge(ws, environmentId);
    });
  });
}

async function bridge(ws: WebSocket, environmentId: string): Promise<void> {
  const environments = container.get(EnvironmentService);
  const docker = container.get(DockerService);

  let containerId: string | null;
  try {
    containerId = await runInTransaction(async () => (await environments.getById(environmentId)).containerId ?? null);
  } catch {
    ws.close(1011, "Ambiente não encontrado");
    return;
  }
  if (!containerId) {
    ws.close(1011, "Ambiente ainda sem container");
    return;
  }

  const { stream, resize } = await docker.openConsole(containerId);

  // Container -> navegador
  stream.on("data", (chunk: Buffer) => ws.readyState === ws.OPEN && ws.send(chunk));
  stream.on("close", () => ws.close());
  stream.on("error", () => ws.close(1011, "Erro no stream do container"));

  // Navegador -> container. Protocolo: frame BINÁRIO = stdin; frame TEXTO = controle (resize).
  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      stream.write(data);
      return;
    }
    try {
      const msg = JSON.parse(data.toString()) as { type?: string; rows?: number; cols?: number };
      if (msg.type === "resize") void resize(Number(msg.rows), Number(msg.cols)).catch(() => undefined);
    } catch {
      // mensagem de texto não-JSON: ignora
    }
  });
  ws.on("close", () => stream.destroy());
}
