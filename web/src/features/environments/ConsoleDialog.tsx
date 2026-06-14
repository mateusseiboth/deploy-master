import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { tokenStore } from "@/lib/api";
import type { Environment } from "@/lib/types";

/** Console web interativo (xterm.js) ligado ao container via WebSocket. */
export function ConsoleDialog({ env, onClose }: { env: Environment | null; onClose: () => void }) {
  const mountRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!env || !mountRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "ui-monospace, monospace",
      theme: { background: "#0b1220" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(mountRef.current);
    fit.fit();

    const token = tokenStore.access ?? "";
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/api/environments/${env.id}/console?access_token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const encoder = new TextEncoder();
    // Envia o tamanho atual do terminal como frame de TEXTO (controle).
    const sendResize = () => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    };

    ws.onopen = () => {
      term.writeln("\x1b[32m● conectado ao container\x1b[0m");
      sendResize(); // dimensões iniciais
    };
    ws.onmessage = (e) => term.write(typeof e.data === "string" ? e.data : new Uint8Array(e.data));
    ws.onclose = () => term.writeln("\r\n\x1b[31m● conexão encerrada\x1b[0m");
    ws.onerror = () => term.writeln("\r\n\x1b[31m● erro de conexão\x1b[0m");

    // stdin como frame BINÁRIO (não confunde com o controle de resize).
    const sub = term.onData((data) => ws.readyState === ws.OPEN && ws.send(encoder.encode(data)));
    // Quando o terminal muda de tamanho (fit/janela), propaga ao container.
    const resizeSub = term.onResize(() => sendResize());
    const onWindowResize = () => fit.fit();
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      resizeSub.dispose();
      sub.dispose();
      ws.close();
      term.dispose();
    };
  }, [env]);

  if (!env) return null;

  return (
    <Dialog open={!!env} onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>Console — {env.name}</DialogTitle>
        <DialogDescription>Shell interativo no container (sh)</DialogDescription>
      </DialogHeader>
      <div ref={mountRef} className="h-[55vh] overflow-hidden rounded-md border bg-[#0b1220] p-2" />
    </Dialog>
  );
}
