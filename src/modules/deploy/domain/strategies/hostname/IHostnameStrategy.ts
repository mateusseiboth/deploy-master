import type { DeployContext } from "@modules/deploy/domain/DeployContext";

/** Estratégia de geração do hostname do ambiente. */
export interface IHostnameStrategy {
  build(ctx: DeployContext): string;
}

/** Normaliza um segmento para uso seguro em hostname (DNS-safe). */
export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos/diacríticos
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
