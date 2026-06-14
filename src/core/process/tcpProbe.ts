import { connect } from "net";

/**
 * Testa se um host:porta está aceitando conexões TCP (ex.: proxy reverso na 443).
 * Resolve true em conexão bem-sucedida, false em erro/timeout. Reutilizável.
 */
export function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
