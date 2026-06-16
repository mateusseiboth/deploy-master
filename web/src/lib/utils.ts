import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind resolvendo conflitos (padrão ShadCN). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Formata bytes em unidade legível (B, KB, MB, …). */
export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/** Dias restantes até a expiração (negativo = vencido). */
export function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
