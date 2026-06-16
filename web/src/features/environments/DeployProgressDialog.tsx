import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { tokenStore } from "@/lib/api";
import type { Environment } from "@/lib/types";

/**
 * Progresso do deploy em tempo real via SSE: clone → build → rede → banco →
 * container → DNS → health. A fonte é a trilha persistida pelo worker; o stream
 * encerra com o evento `done` quando o ambiente sai dos estados em andamento.
 */
export function DeployProgressDialog({ env, onClose }: { env: Environment | null; onClose: () => void }) {
  const [lines, setLines] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"conectando" | "ligado" | "concluído" | "erro">("conectando");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!env) return;
    setLines([]);
    setStatus("conectando");

    const token = tokenStore.access ?? "";
    const url = `/api/environments/${env.id}/deploy/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.addEventListener("ready", () => setStatus("ligado"));
    source.onmessage = (e) => setLines((prev) => [...prev.slice(-2000), e.data]);
    source.addEventListener("done", () => {
      setStatus("concluído");
      source.close();
    });
    source.onerror = () => setStatus((s) => (s === "concluído" ? s : "erro"));

    return () => source.close();
  }, [env]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!env) return null;

  const statusColor =
    status === "ligado"
      ? "text-emerald-400"
      : status === "concluído"
        ? "text-sky-400"
        : status === "erro"
          ? "text-destructive"
          : "text-muted-foreground";

  return (
    <Dialog open={!!env} onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>Progresso do deploy — {env.name}</DialogTitle>
        <DialogDescription>
          Acompanhamento em tempo real · <span className={statusColor}>{status}</span>
        </DialogDescription>
      </DialogHeader>
      <div className="h-[55vh] overflow-auto rounded-md border bg-black/80 p-3 font-mono text-xs leading-relaxed text-sky-200">
        {lines.length === 0 && <p className="text-muted-foreground">Aguardando progresso…</p>}
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </Dialog>
  );
}
