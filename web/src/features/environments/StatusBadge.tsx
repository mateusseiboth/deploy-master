import { Badge } from "@/components/ui/badge";
import type { EnvironmentStatus } from "@/lib/types";

const MAP: Record<EnvironmentStatus, { label: string; variant: "default" | "success" | "warning" | "destructive" | "muted" | "secondary" }> = {
  PENDING: { label: "Pendente", variant: "secondary" },
  PROVISIONING: { label: "Provisionando", variant: "default" },
  READY: { label: "Pronto", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
  EXPIRING: { label: "Expirando", variant: "warning" },
  EXPIRED: { label: "Expirado", variant: "warning" },
  REMOVING: { label: "Removendo", variant: "muted" },
  REMOVED: { label: "Removido", variant: "muted" },
};

export function StatusBadge({ status }: { status: EnvironmentStatus }) {
  const { label, variant } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
