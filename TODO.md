# TODO — Deploy Master (Ephemeral Environments)

Rastreamento das etapas. `[x]` feito · `[~]` em andamento · `[ ]` pendente.
Doc viva em `/doc`. Patterns obrigatórios: Factory, Strategy, Builder. SOLID + sem duplicação.

---

## Fase 0 — Fundação (esta sessão)

- [x] Levantar arquitetura da casa (`backend-base`, `ts-decorators`)
- [x] Documentação inicial em `/doc` (arquitetura, decisões, pipeline)
- [x] `TODO.md`
- [x] Config do projeto: `package.json`, `tsconfig.json`, `bunfig.toml`, aliases
- [x] `.env.example` + `docker-compose.infra.yml` (postgres, redis, traefik, pihole)
- [x] Prisma schema — modelo de domínio completo
- [x] `core/` — DI (`Injectable`, container), `AsyncLocalStorage` context,
      `withTransaction`, errors, `BaseController/Service/DAO/Model`, `RouteBuilder`
- [x] `database/prisma.ts`
- [x] Deploy pipeline: `DeployPipelineBuilder` (Builder) + `IDeployStep` (Strategy)
      + `DeployStepFactory` (Factory) + `DeployContext`
- [x] Strategies + Factories: database, hostname, certificate, proxy
- [x] Adapters: `GitLabClient`, `GitSourceProvider`, `DockerService`, `PiholeDnsService`
- [x] `DeployOrchestratorService` (entrada de provisionamento/remoção)
- [x] Validação: `tsc --noEmit` zero erros + smoke test do grafo de DI/pipeline

## Fase 1 — Backend: ciclo de vida do ambiente

- [x] `EnvironmentService`: criar (enfileira deploy), renovar, reiniciar, excluir
- [x] Fila SQLite (`IJobQueue` + `SqliteJobQueue`) — sem Redis
- [x] Worker: `deploy` (provisionamento) com retry/backoff
- [x] Worker: `cleanup` (remoção/expiração)
- [x] Job agendado de expiração (cron) → marca `EXPIRING`/`EXPIRED` e enfileira cleanup
- [x] Controllers + rotas REST (environment, project) + bootstrap HTTP + worker entry
- [x] Validação de prazos (padrão/máximo/limite de renovações) no Service
- [x] Validação de whitelist de variáveis + RBAC (QA só ambiente próprio)
- [x] Cache (`ICache` + `MemoryCache`/`SqliteCache`, Factory por env) usado em `ProjectService`
- [x] Idempotência (env ativo único por project+commit) + lock de concorrência (CAS de status)
- [x] Upload multipart do backup `.sql/.sql.gz` (multer + `BackupController`)
- [x] Rotas REST de variável de projeto, auditoria e dashboard
- [x] Validar entrada ANTES de abrir transação (`validateBody` middleware → 400 sem DB)

## Fase 2 — Auth & RBAC

- [x] JWT (access) + Refresh Token opaco com rotação (login, refresh, logout)
- [x] `authContextMiddleware` (JWT real) + `requireRole` (substituiu placeholder)
- [x] Perfis: Administrador / QA / Visualizador (`requireRole` + regra no Service)
- [x] Regras: QA só gerencia ambiente próprio; Admin qualquer; Viewer só leitura
- [x] Hash de senha (bcryptjs) + `register` (ADMIN) + seed do admin (`bun run seed`)
- [ ] `checkPermissions` granular por recurso (além de papel) — futuro
- [ ] 2FA / expiração de sessão / refresh httpOnly cookie — futuro

## Fase 3 — Integrações (completar)

- [x] GitLab: navegação (branches/commits/detalhe autor-data-msg/pipeline/validate) via REST com cache
- [x] Pi-hole: registro idempotente + espera de propagação do DNS
- [x] Proxy: descoberta automática (labels Traefik) + health check de proxy (TCP 443)
- [x] Estratégia de cópia do banco de produção (`pg_dump | psql` em streaming)
- [x] HealthCheck reforçado: DNS + container + proxy + banco conectado (gate READY)
- [ ] Renovação automática de certificado (Traefik/LE já auto-renova; CA interna: rotina) — futuro
- [ ] Logs em tempo real do container (stream) + console web — futuro (diferencial)

## Fase 4 — Observabilidade & NFRs

- [ ] Logs centralizados + correlação por ambiente
- [ ] OpenTelemetry (traces/metrics)
- [ ] Rate limit
- [ ] Dashboard: ativos/expirando/expirados, consumo, deploys por projeto/usuário
- [ ] Logs em tempo real do container (stream) + console web

## Fase 5 — Frontend (React + ShadCN + TanStack Query) — `web/`

- [x] Setup Vite + Tailwind + UI estilo ShadCN + TanStack Query + cliente HTTP (axios)
- [x] Auth: login, refresh automático (interceptor), sessão, ProtectedRoute, layout/nav
- [x] Fluxo de criação (projeto → branch → commit → backup/upload → envs → deploy)
- [x] Painel de ambientes em tempo real (polling) + ações (renovar/reiniciar/abrir/excluir)
- [x] Painel admin (projetos, variáveis, prazos)
- [x] Dashboard de indicadores
- [x] Avisos de expiração + modal de renovação
- [x] `tsc --noEmit` 0 erros + `vite build` OK + preview servindo 200
- [x] Logs em tempo real (SSE) + console web interativo (xterm + WebSocket)
- [ ] Migrar primitivas UI para ShadCN/Radix oficial (hoje versões leves equivalentes)

## Infra & Configuração (executado)

- [x] Migrations Prisma 7 via baseline (sem shadow DB): `migrate diff` + `migrate deploy`
- [x] `prisma.config.ts` carrega `.env` (dotenv) — corrige `PrismaConfigEnvError`
- [x] Seed do admin (`bun run seed`) validado contra o banco real
- [x] Pi-hole/proxy **cadastráveis pelo admin no banco** (`SystemSettings`) — fora do env
- [x] Rotas `GET/PUT /api/settings` + tela "Configurações" (admin)
- [x] Pipeline lê Pi-hole/proxy de `DeployContext.settings` (banco), não env
- [x] `docker-compose.infra.yml`: Traefik + Pi-hole v5 (+ Postgres) — subido e testado
- [x] `Dockerfile` + `docker-compose.yml`: api+worker em container com sock do Docker
- [x] Validado: Pi-hole `customdns` add/get/delete + settings persistidas (RBAC 403 p/ VIEWER)
- [x] Resize do TTY propagado ao container (console web)
- [ ] Migrar `PiholeDnsService` para API do Pi-hole v6 (usar imagem `latest`)

## Fase 6 — Qualidade

- [ ] Testes unitários dos Services e Strategies (antes de qualquer refactor)
- [ ] Testes do pipeline (mock dos adapters)
- [ ] Testes e2e do fluxo de criação
- [ ] CI

---

### Convenções de trabalho
- Regras de negócio só em Services. Prisma só em DAO. Tudo em transação (RLS).
- Models implementam tipos do Prisma. Sempre aliases. Sem import relativo.
- Antes de criar: procurar solução/decorator/helper/service existente.
