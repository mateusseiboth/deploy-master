# Fila, Workers e Ciclo de Vida (Fase 1)

## Componentes

```text
HTTP (Express)                         Processo worker (bun run worker)
  Controller                             Worker (polling)
    └─ EnvironmentService                  ├─ DeployJobHandler ─┐
         ├─ EnvironmentDAO (Prisma)        └─ CleanupJobHandler ─┤
         ├─ AuditService/AuditDAO                                │
         └─ SqliteJobQueue ───────────────────────────────────► fila SQLite
                                           ExpirationScheduler (cron)
```

- **Fila**: `SqliteJobQueue` (`bun:sqlite`), tipos `deploy`, `cleanup` e `backup`.
  Reserva atômica (`BEGIN IMMEDIATE` + `UPDATE ... RETURNING`), backoff exponencial,
  `maxAttempts`. Sem Redis (ADR-007).
- **Monitoramento**: `GET /api/queue` (`SqliteJobQueue.list`) expõe os jobs
  (status/tipo/tentativas/erro) lendo o MESMO arquivo SQLite do worker — a UI
  (card "Fila de operações" no Dashboard) mostra deploys, remoções e backups em
  andamento, na fila ou com falha.
- **Worker**: faz polling, reserva o job e despacha ao `IJobHandler` por tipo
  (Strategy). Falha → `retryOrFail` (backoff) → eventual `failed`.
- **Cron**: `ExpirationScheduler` chama `EnvironmentService.processExpirations`
  em transação, marcando `EXPIRING`/`EXPIRED` e enfileirando cleanup.

## Transação × infraestrutura

Regra: operações de banco ocorrem em transação; operações de infra (Docker, git,
pg, DNS) **não** podem segurar uma transação Postgres (são longas). Por isso os
handlers seguem:

1. `runInTransaction`: carrega insumos + muda status (`PROVISIONING`/`REMOVING`).
2. **fora de transação**: `DeployOrchestratorService.provision`/`destroy`
   (pipeline de infra).
3. `runInTransaction`: persiste resultado (`READY`/`FAILED`/`REMOVED`) + auditoria.

## Fluxo de criação (QA)

1. `POST /api/environments` (QA/ADMIN) → valida whitelist de variáveis, política
   de prazo, exige backup quando `UPLOAD_SQL`.
2. Persiste `Environment` (`PENDING`) + valores de variáveis + backup; audita
   `CREATE`; enfileira job `deploy`.
3. Worker executa o pipeline; em sucesso grava runtime (hostname/url/containerId/
   network/db/image) e `READY`; em falha grava `FAILED` com logs.

## Cleanup / Remoção

`remove()` (manual, RBAC) ou cron (expiração) enfileiram `cleanup`. O handler
hidrata o `DeployContext` com o snapshot persistido e roda `teardown()`
(compensação reversa dos steps) — nenhum recurso órfão. Status final `REMOVED`.

O cleanup é **resiliente**: o `teardown` (best-effort/idempotente) roda num
`try`, e o `markRemoved` num `finally` — assim, mesmo que uma etapa de remoção
falhe, o ambiente não fica preso em `REMOVING` (o que bloquearia recriar o mesmo
commit). Recursos remanescentes são limpos por nova execução do cleanup.

## RBAC (placeholder até Fase 2)

`currentUserMiddleware` lê `x-user-id`/`x-user-role`/`x-user-email` (será trocado
por JWT). `requireRole` protege as rotas de escrita. Regra de propriedade no
Service: QA só gerencia ambiente próprio; ADMIN qualquer; VIEWER só leitura.

## Limitações conhecidas (mapeadas no TODO)

- Validação de entrada ocorre dentro do `withTransaction` (com DB indisponível
  retorna 500 em vez de 400). Mover para antes da transação.
- Backup recebido por `filePath`; upload multipart pendente.
- Sem lock de concorrência por ambiente / chave de idempotência ainda.
