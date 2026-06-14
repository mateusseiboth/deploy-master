import { lookup } from "dns/promises";
import { Injectable } from "@di/Injectable";
import type { IDnsProvider, PiholeConfig } from "@modules/deploy/domain/ports";

/**
 * Integração com a API do Pi-hole para DNS local (registros A custom).
 * Implementa o port `IDnsProvider`. As credenciais (baseUrl/token) vêm do banco
 * (cadastro do admin), não de env — são passadas em cada chamada.
 */
@Injectable()
export class PiholeDnsService implements IDnsProvider {
  private endpoint(pihole: PiholeConfig, action: string, params: Record<string, string>): string {
    const search = new URLSearchParams({
      customdns: "",
      action,
      auth: pihole.apiToken,
      ...params,
    });
    return `${pihole.baseUrl}/api.php?${search.toString()}`;
  }

  async register(hostname: string, ip: string, pihole: PiholeConfig): Promise<void> {
    // idempotente: remove um registro pré-existente antes de adicionar
    await this.unregister(hostname, ip, pihole);
    const res = await fetch(this.endpoint(pihole, "add", { domain: hostname, ip }), { method: "GET" });
    if (!res.ok) throw new Error(`Pi-hole add falhou: ${res.status}`);
  }

  async unregister(hostname: string, ip: string, pihole: PiholeConfig): Promise<void> {
    // tolerante a falha: cleanup não deve travar por DNS já removido
    await fetch(this.endpoint(pihole, "delete", { domain: hostname, ip }), { method: "GET" }).catch(
      () => undefined,
    );
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
