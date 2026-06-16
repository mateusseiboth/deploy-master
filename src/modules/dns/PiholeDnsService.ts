import { lookup } from "dns/promises";
import { Injectable } from "@di/Injectable";
import type { IDnsProvider, PiholeConfig } from "@modules/deploy/domain/ports";

interface PiholeSession {
  sid: string;
  csrf?: string;
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

  /** Autentica (ou reaproveita a sessão) e devolve o SID + CSRF. */
  private async authenticate(pihole: PiholeConfig, force = false): Promise<PiholeSession> {
    const cached = this.sessions.get(pihole.baseUrl);
    if (!force && cached && cached.expiresAt > Date.now()) return cached;

    const res = await fetch(`${this.apiBase(pihole)}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pihole.password }),
    });
    if (!res.ok) {
      throw new Error(`Pi-hole auth falhou: ${res.status} ${res.statusText} ${await safeBody(res)}`);
    }

    const body = (await res.json()) as {
      session?: { valid: boolean; sid: string; csrf?: string; validity: number };
    };
    const session = body.session;
    if (!session?.valid || !session.sid) throw new Error("Pi-hole auth: senha inválida");

    // Renova com margem de segurança antes do fim da validade informada.
    const ttlMs = Math.max((session.validity ?? 300) - 30, 30) * 1000;
    const stored: PiholeSession = { sid: session.sid, csrf: session.csrf, expiresAt: Date.now() + ttlMs };
    this.sessions.set(pihole.baseUrl, stored);
    return stored;
  }

  /**
   * Requisição autenticada à API v6 (SID via header `X-FTL-SID`, CSRF quando há).
   * Reautentica uma vez em 401/403 (sessão pode ter sido invalidada no servidor).
   */
  private async request(
    pihole: PiholeConfig,
    method: "PUT" | "DELETE" | "GET",
    path: string,
  ): Promise<Response> {
    const send = (session: PiholeSession) => {
      const headers: Record<string, string> = { "X-FTL-SID": session.sid, accept: "application/json" };
      if (session.csrf) headers["X-FTL-CSRF"] = session.csrf;
      return fetch(`${this.apiBase(pihole)}${path}`, { method, headers });
    };

    let res = await send(await this.authenticate(pihole));
    if (res.status === 401 || res.status === 403) {
      this.sessions.delete(pihole.baseUrl);
      res = await send(await this.authenticate(pihole, true));
    }
    return res;
  }

  /** Caminho do registro de host local: `config/dns/hosts/<IP domínio>`. */
  private hostPath(hostname: string, ip: string): string {
    return `/config/dns/hosts/${encodeURIComponent(`${ip} ${hostname}`)}`;
  }

  /** Registra o host em TODOS os Pi-holes (DNS balanceado). Falha se algum falhar. */
  async register(hostname: string, ip: string, piholes: PiholeConfig[]): Promise<void> {
    if (piholes.length === 0) throw new Error("Nenhum servidor Pi-hole configurado");

    const errors: string[] = [];
    for (const pihole of piholes) {
      try {
        // idempotente: remove um registro pré-existente antes de adicionar
        await this.registerOne(hostname, ip, pihole);
      } catch (err) {
        errors.push(`${pihole.baseUrl}: ${(err as Error).message}`);
      }
    }
    // Registro deve existir em todos (eles balanceiam): qualquer falha falha o step.
    if (errors.length > 0) {
      throw new Error(`Pi-hole add falhou em ${errors.length}/${piholes.length}: ${errors.join(" | ")}`);
    }
  }

  private async registerOne(hostname: string, ip: string, pihole: PiholeConfig): Promise<void> {
    await this.request(pihole, "DELETE", this.hostPath(hostname, ip)).catch(() => undefined);
    const res = await this.request(pihole, "PUT", this.hostPath(hostname, ip));
    // 201 (criado) é o esperado; 200 também é aceitável.
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} ${await safeBody(res)}`);
    }
  }

  /** Remove o host de TODOS os Pi-holes (tolerante a falha: cleanup). */
  async unregister(hostname: string, ip: string, piholes: PiholeConfig[]): Promise<void> {
    for (const pihole of piholes) {
      await this.request(pihole, "DELETE", this.hostPath(hostname, ip)).catch(() => undefined);
    }
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

/** Lê o corpo da resposta para diagnóstico, truncado e tolerante a falha. */
async function safeBody(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim();
    return text ? `— ${text.slice(0, 300)}` : "";
  } catch {
    return "";
  }
}
