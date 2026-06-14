# Decisões Arquiteturais (ADR resumido)

## ADR-001 — `core` local e self-contained
**Contexto:** o projeto não deve depender de pacotes externos da organização.
**Decisão:** primitivas de infraestrutura próprias em `src/core/*` (DI, contexto
transacional, base de camadas, RouteBuilder), com interfaces pequenas.
**Consequência:** código independente; consumidores dependem da abstração (DIP),
permitindo evoluir cada primitiva sem reescrever o domínio.

## ADR-002 — Pipeline de deploy como Builder + Chain of Steps
**Contexto:** o provisionamento tem 11 etapas ordenadas, com falha/retry/rollback.
**Decisão:** `DeployPipelineBuilder` (Builder) monta uma lista ordenada de
`IDeployStep` (Strategy). Cada step é atômico, idempotente e sabe fazer
`compensate()` (rollback). Um `DeployContext` mutável carrega o estado entre steps.
**Consequência:** OCP — novos steps sem alterar o executor; cleanup reaproveita os
mesmos steps na ordem inversa.

## ADR-003 — Strategies plugáveis por configuração do projeto
- **Banco:** `UploadSqlStrategy` vs `CopyProductionStrategy` (`IDatabaseProvisionStrategy`).
- **Hostname:** `{projeto}-{hash}` / `{projeto}-{branch}` / `{projeto}-{usuario}-{hash}`
  (`IHostnameStrategy`).
- **Certificado:** `InternalCaStrategy` vs `LetsEncryptStrategy` (`ICertificateStrategy`).
- **Proxy:** `TraefikStrategy` vs `CaddyStrategy` (`IReverseProxyStrategy`).

Cada família tem uma **Factory** que escolhe a implementação a partir de enums
persistidos no projeto. Nenhum `if/else` de seleção vaza para os Services.

## ADR-004 — Transação obrigatória via AsyncLocalStorage
**Decisão:** `withTransaction` abre `prisma.$transaction`, injeta o client
transacional no contexto (`AsyncLocalStorage`) e seta o tenant para RLS. DAOs leem
`this.tx` do contexto. Espelha o `backend-base`.

## ADR-005 — Orquestração Docker via Docker Engine API
**Decisão:** adapter `DockerService` encapsula chamadas ao Docker (build, run,
network, volume, rm). Mantido atrás de `IContainerOrchestrator` para permitir
trocar por SDK (`dockerode`) ou CLI sem afetar o pipeline.

## ADR-007 — Fila e cache sem Redis (SQLite/memória)
**Contexto:** decisão do time de não usar Redis.
**Decisão:** fila de jobs persistente em SQLite (`bun:sqlite`, nativo) atrás do
port `IJobQueue`; cache atrás de `ICache` com drivers `MemoryCache` e
`SqliteCache` (Factory por env `CACHE_DRIVER`). BullMQ/ioredis removidos.
**Consequência:** zero dependência de infra externa para fila/cache; processo de
worker único consome a fila com polling + lock por linha (status/owner).

## ADR-006 — Identificador do ambiente = COMMIT_HASH
`env-<hash>` é o identificador estável; nomes de rede/volume/host derivam dele,
garantindo idempotência (re-deploy do mesmo commit reaproveita nomes).
