import type { EnvironmentStatus } from "@/lib/types";
import { StatusCore } from "./StatusCore";

const LABEL: Record<EnvironmentStatus, { text: string; tone: string }> = {
  PENDING: { text: "Pendente", tone: "text-primary" },
  PROVISIONING: { text: "Provisionando", tone: "text-primary" },
  READY: { text: "Pronto", tone: "text-ready" },
  FAILED: { text: "Falhou", tone: "text-danger" },
  EXPIRING: { text: "Expirando", tone: "text-amber" },
  EXPIRED: { text: "Expirado", tone: "text-amber" },
  REMOVING: { text: "Removendo", tone: "text-faint" },
  REMOVED: { text: "Removido", tone: "text-faint" },
};

export function StatusBadge({ status, ratio }: { status: EnvironmentStatus; ratio?: number | null }) {
  const { text, tone } = LABEL[status];
  return (
    <span className="inline-flex items-center gap-2">
      <StatusCore status={status} ratio={ratio} />
      <span className={`font-mono text-xs uppercase tracking-[0.08em] ${tone}`}>{text}</span>
    </span>
  );
}
