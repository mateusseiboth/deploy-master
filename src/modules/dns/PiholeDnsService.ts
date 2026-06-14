import { lookup } from "dns/promises";
import { env } from "@config/env";
import { Injectable } from "@di/Injectable";
import type { IDnsProvider } from "@modules/deploy/domain/ports";

/**
 * Integração com a API do Pi-hole para DNS local (registros A custom).
 * Implementa o port `IDnsProvider`. Usa a API `customdns` do admin.
 */
@Injectable()
export class PiholeDnsService implements IDnsProvider {
  private endpoint(action: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      customdns: "",
      action,
      auth: env.dns.piholeApiToken,
      ...params,
    });
    return `${env.dns.piholeBaseUrl}/api.php?${search.toString()}`;
  }

  async register(hostname: string, ip: string): Promise<void> {
    // idempotente: remove um registro pré-existente antes de adicionar
    await this.unregister(hostname);
    const res = await fetch(this.endpoint("add", { domain: hostname, ip }), { method: "GET" });
    if (!res.ok) throw new Error(`Pi-hole add falhou: ${res.status}`);
  }

  /** Aguarda a propagação resolvendo o hostname até bater no IP esperado. */
  async waitForPropagation(
    hostname: string,
    expectedIp: string,
    attempts = 8,
    delayMs = 2000,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (await this.isResolving(hostname, expectedIp)) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  }

  async unregister(hostname: string): Promise<void> {
    // tolerante a falha: cleanup não deve travar por DNS já removido
    await fetch(this.endpoint("delete", { domain: hostname, ip: env.dns.reverseProxyIp }), {
      method: "GET",
    }).catch(() => undefined);
  }

  /** Valida propagação resolvendo o hostname localmente. */
  async isResolving(hostname: string, expectedIp: string): Promise<boolean> {
    try {
      const { address } = await lookup(hostname);
      return address === expectedIp;
    } catch {
      return false;
    }
  }
}
