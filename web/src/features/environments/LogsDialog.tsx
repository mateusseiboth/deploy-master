import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { tokenStore } from "@/lib/api";
import type { Environment } from "@/lib/types";

/** Logs do container em tempo real via SSE (EventSource). */
export function LogsDialog({ env, onClose }: { env: Environment | null; onClose: () => void }) {
  const [lines, setLines] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<"conectando" | "ligado" | "erro">("conectando");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!env) return;
    setLines([]);
    setStatus("conectando");

    const token = tokenStore.access ?? "";
    const url = `/api/environments/${env.id}/logs/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.addEventListener("ready", () => setStatus("ligado"));
    source.onmessage = (e) => setLines((prev) => [...prev.slice(-2000), e.data]);
    source.onerror = () => setStatus("erro");

    return () => source.close();
  }, [env]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!env) return null;

  return (
    <Dialog open={!!env} onOpenChange={(o) => !o && onClose()}>
      <DialogHeader>
        <DialogTitle>Logs — {env.name}</DialogTitle>
        <DialogDescription>
          Stream em tempo real ·{" "}
          <span className={status === "ligado" ? "text-emerald-400" : status === "erro" ? "text-destructive" : "text-muted-foreground"}>
            {status}
          </span>
        </DialogDescription>
      </DialogHeader>
      <div className="h-[55vh] overflow-auto rounded-md border bg-black/80 p-3 font-mono text-xs leading-relaxed text-emerald-200">
        {lines.length === 0 && <p className="text-muted-foreground">Aguardando logs…</p>}
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </Dialog>
  );
}
