# Arquitetura — Deploy Master (Ephemeral Environments)

> Documentação contínua conforme exigido pelo CLAUDE.md (seção 4).
> Toda descoberta, decisão e convenção é registrada aqui.

## 1. Visão geral

Sistema web para o setor de QA criar **ambientes temporários isolados** a partir
de qualquer branch/commit do GitLab, sem depender de Dev/Infra.

Cada ambiente = container isolado + banco próprio + backup restaurado + URL única
(DNS + proxy reverso + HTTPS) + validade com renovação + remoção automática +
auditoria.

## 2. Stack

| Camada        | Tecnologia                                  |
| ------------- | ------------------------------------------- |
| Runtime       | BunJS + TypeScript                          |
| HTTP          | Express 5                                   |
| ORM           | Prisma 7 (`@prisma/adapter-pg`)             |
| Banco         | PostgreSQL                                  |
| Fila          | SQLite (`bun:sqlite`) — sem Redis           |
| Cache         | Memória / SQLite — sem Redis                |
| Orquestração  | Docker / Docker Compose                     |
| DNS           | Pi-hole (API)                               |
| Proxy reverso | Traefik (preferencial) / Caddy              |
| Auth          | JWT + Refresh Token                         |
| Frontend      | React + TS + ShadCN + TanStack Query        |

## 3. Padrão arquitetural (espelhado de `backend-base`)

Camadas e regra de dependência (DIP — sempre depender de abstração):

```
HTTP (RouteBuilder)
   -> Controller   (recebe req, valida, chama service, responde)
      -> Service   (regras de negócio, orquestração, transações)
         -> DAO    (única camada que toca o Prisma)
            -> Prisma
```

Regras absolutas herdadas do CLAUDE.md:

- **Regras de negócio só em Services.**
- **Prisma só em Repository/DAO.**
- **Toda operação de banco dentro de transação** (contexto via `AsyncLocalStorage`).
- **Models implementam os tipos gerados pelo Prisma** (fonte da verdade).
- **Sempre aliases**, nunca import relativo.

### 3.1 `core` local e self-contained

O projeto é **independente**: não depende de pacotes externos da organização.
As primitivas de infraestrutura (`Injectable` + DI container, `withTransaction`,
`BaseController/Service/DAO/Model`, `RouteBuilder`) vivem em `src/core/*` e são
próprias deste repositório. Mantemos as interfaces pequenas (ISP) e os
consumidores dependendo da abstração (DIP), de modo que qualquer primitiva possa
evoluir sem reescrever as camadas de domínio. Decisão em `doc/02-decisoes.md`.

## 4. Módulos de domínio

```
src/modules/
  auth/         JWT + refresh, RBAC (Admin / QA / Viewer)
  project/      cadastro de projetos GitLab + config de deploy
  variable/     variáveis sobrescrevíveis (whitelist do admin)
  environment/  ciclo de vida do ambiente efêmero
  backup/       upload .sql/.sql.gz ou cópia do banco de produção
  audit/        trilha de auditoria imutável
  gitlab/       cliente da API GitLab (projetos/branches/commits)
  docker/       adapter de orquestração de containers/redes/volumes
  dns/          integração Pi-hole
  proxy/        Traefik/Caddy (Strategy)
  deploy/       <-- coração: pipeline de provisionamento (Builder+Strategy+Factory)
  dashboard/    indicadores agregados
```

## 5. Convenções

- Aliases: `@core/*`, `@modules/*`, `@database/*`, `@config/*`, `@di/*`,
  `@prisma-generated/*`. Definidos em `tsconfig.json` **e** `bunfig.toml`.
- Models implementam `Prisma.<Model>` e são a fonte da estrutura.
- IDs de ambiente derivam do `COMMIT_HASH`: `env-<hash>` (ver pipeline).
- Status do ambiente segue máquina de estados em `doc/03-pipeline-deploy.md`.

## 6. Observabilidade / NFRs

Multi-tenant, auditoria completa, logs centralizados, deploy idempotente,
retry automático (BullMQ), cleanup automático, isolamento por rede Docker,
controle de concorrência (lock por ambiente), rate limit, RBAC.
