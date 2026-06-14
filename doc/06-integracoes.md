# Integrações (Fase 3)

## GitLab

`GitLabClient` (API REST) + `GitLabService` (regras + cache, TTL 30s) + rotas em
`/api/projects/:id/gitlab`:

| Rota                          | Função                                            |
| ----------------------------- | ------------------------------------------------- |
| `GET .../gitlab/validate`     | valida o token de acesso ao projeto               |
| `GET .../gitlab/branches`     | lista branches                                    |
| `GET .../gitlab/commits?branch=` | lista commits da branch                        |
| `GET .../gitlab/commits/:hash`| detalhe (autor, data, mensagem)                   |
| `GET .../gitlab/pipeline?ref=`| pipeline mais recente da ref                      |

O token nunca sai do backend: o controller passa só `projectId`; o service
carrega a config do projeto (`ProjectDAO`) e chama o GitLab. **Validado contra a
API real do gitlab.com** (commits/detalhe/pipeline).

## Banco de produção (cópia em streaming)

`PostgresAdmin.copyFromProduction` usa `pg_dump | psql` via `pipe()` (sem arquivo
intermediário). `canConnect(url)` testa conectividade (`SELECT 1`) para o health
check.

## DNS (Pi-hole)

`register` é idempotente (remove antes de adicionar). `waitForPropagation`
aguarda a resolução bater no IP do proxy. A propagação é validada já no
`RegisterDnsStep` (best-effort) e novamente no `HealthCheckStep` (gate de READY).

## Proxy reverso (Traefik)

Descoberta automática por **labels** no container (geradas pela
`TraefikReverseProxyStrategy` + estratégia de certificado). O health check do
proxy é um probe TCP na porta 443 do `REVERSE_PROXY_IP` (`tcpProbe`).

## Health check (gate para READY)

`HealthCheckStep` valida em paralelo e com retry: **DNS** resolvendo, **container**
saudável, **proxy** ouvindo (TCP 443) e **banco** conectado. Só vira `READY` com
todos OK; caso contrário `FAILED` com logs por verificação.

## Limitações conhecidas

- Validação de cert/HTTP fim-a-fim depende de CA confiável; hoje checamos
  reachability TCP do proxy (não a cadeia TLS).
- Cópia de produção exige `pg_dump`/`psql` no PATH do processo.
