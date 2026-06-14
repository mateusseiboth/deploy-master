import type { EnvironmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Cor de saúde (CSS) por status — o espectro do ciclo de vida. */
function coreColor(status: EnvironmentStatus): string {
  switch (status) {
    case "READY":
      return "rgb(var(--ready))";
    case "EXPIRING":
    case "EXPIRED":
      return "rgb(var(--amber))";
    case "FAILED":
      return "rgb(var(--danger))";
    case "PENDING":
    case "PROVISIONING":
      return "rgb(var(--primary))";
    default:
      return "rgb(var(--slate))";
  }
}

interface Props {
  status: EnvironmentStatus;
  /** Vida restante 0..1 (para o anel esvaziar). Só relevante em estados com TTL. */
  ratio?: number | null;
  size?: number;
  className?: string;
}

/**
 * Status Core — elemento-assinatura. Anel externo que representa a vida restante
 * do ambiente (TTL), ponto interno colorido pela saúde, pulso quando provisionando.
 */
export function StatusCore({ status, ratio, size = 18, className }: Props) {
  const color = coreColor(status);
  const hasTtl = ratio != null && (status === "READY" || status === "EXPIRING");
  const pct = Math.max(0, Math.min(1, ratio ?? 1)) * 360;
  const pulsing = status === "PENDING" || status === "PROVISIONING";

  // Anel: arco preenchido (vida restante) na cor da saúde + restante quase invisível.
  const ring = hasTtl
    ? `conic-gradient(${color} ${pct}deg, rgb(var(--border-strong)) ${pct}deg 360deg)`
    : `conic-gradient(${color} 360deg)`;

  return (
    <span
      className={cn("relative inline-grid place-items-center rounded-full", className)}
      style={{ width: size, height: size, background: ring }}
      aria-hidden
    >
      {/* Recorta o miolo para virar um anel fino */}
      <span
        className="absolute rounded-full bg-background"
        style={{ inset: size > 22 ? 3 : 2.5 }}
      />
      {/* Núcleo */}
      <span
        className={cn("relative rounded-full", pulsing && "animate-pulse-core")}
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: color,
          boxShadow: `0 0 ${size * 0.5}px ${color}`,
        }}
      />
    </span>
  );
}
