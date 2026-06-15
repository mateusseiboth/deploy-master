import { lookup } from "dns/promises";
import { Injectable } from "@di/Injectable";
import type { IDnsProvider, PiholeConfig } from "@modules/deploy/domain/ports";

interface PiholeSession {
  sid: string;
  expiresAt: number;
}

/**
 * Integração com a API REST do Pi-hole v6 para DNS local (registros A custom).
 * Implementa o port `IDnsProvider`. As credenciais (baseUrl/senha) vêm do banco
 * (cadastro do admin), não de env — são passadas em cada chamada.
 *
 * Diferente da v5 (que usava `api.php?auth=<token>`), a v6 exige autenticar com a
 * SENHA do admin em `POST /api/auth` para obter uma sessão (SID), e gerencia os
 * registros A locais via `config/dns/hosts` (lista de "IP domínio").
 */
@Injectable()
export class PiholeDnsService implements IDnsProvider {
  /** Cache de sessão por baseUrl para evitar reautenticar a cada chamada. */
  private readonly sessions = new Map<string, PiholeSession>();

  /** Normaliza a base: sem barra final e sem o sufixo `/admin` da v5. */
  private apiBase(pihole: PiholeConfig): string {
    return `${pihole.baseUrl.replace(/\/+$/, "").replace(/\/admin$/, "")}/api`;
  }

  /** Autentica (ou reaproveita a sessão) e devolve o SID. */
  private async authenticate(pihole: PiholeConfig): Promise<string> {
    const cached = this.sessions.get(pihole.baseUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.sid;

    const res = await fetch(`${this.apiBase(pihole)}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pihole.password }),
    });
    if (!res.ok) throw new Error(`Pi-hole auth falhou: ${res.status} ${res.statusText}`);

    const body = (await res.json()) as { session?: { valid: boolean; sid: string; validity: number } };
    const session = body.session;
    if (!session?.valid || !session.sid) throw new Error("Pi-hole auth: senha inválida");

    // Renova com margem de segurança antes do fim da validade informada.
    const ttlMs = Math.max((session.validity ?? 300) - 30, 30) * 1000;
    this.sessions.set(pihole.baseUrl, { sid: session.sid, expiresAt: Date.now() + ttlMs });
    return session.sid;
  }

  /** Requisição autenticada à API v6 (SID via header `X-FTL-SID`). */
  private async request(
    pihole: PiholeConfig,
    method: "PUT" | "DELETE" | "GET",
    path: string,
  ): Promise<Response> {
    const sid = await this.authenticate(pihole);
    return fetch(`${this.apiBase(pihole)}${path}`, {
      method,
      headers: { "X-FTL-SID": sid, accept: "application/json" },
    });
  }

  /** Caminho do registro de host local: `config/dns/hosts/<IP domínio>`. */
  private hostPath(hostname: string, ip: string): string {
    return `/config/dns/hosts/${encodeURIComponent(`${ip} ${hostname}`)}`;
  }

  async register(hostname: string, ip: string, pihole: PiholeConfig): Promise<void> {
    // idempotente: remove um registro pré-existente antes de adicionar
    await this.unregister(hostname, ip, pihole);
    const res = await this.request(pihole, "PUT", this.hostPath(hostname, ip));
    // 201 (criado) é o esperado; 200 também é aceitável.
    if (!res.ok) throw new Error(`Pi-hole add falhou: ${res.status} ${res.statusText}`);
  }

  async unregister(hostname: string, ip: string, pihole: PiholeConfig): Promise<void> {
    // tolerante a falha: cleanup não deve travar por DNS já removido (404)
    await this.request(pihole, "DELETE", this.hostPath(hostname, ip)).catch(() => undefined);
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
