# Pipeline de Deploy & Máquina de Estados

## Estados do ambiente (`EnvironmentStatus`)

```
PENDING ─▶ PROVISIONING ─▶ READY
                 │            │
                 ▼            ▼
              FAILED       EXPIRING ─▶ EXPIRED
                              │
                              ▼
                          REMOVING ─▶ REMOVED
```

- `PENDING`     job enfileirado, ainda não iniciado.
- `PROVISIONING` pipeline executando os steps.
- `READY`       todos os health checks passaram.
- `FAILED`      algum step falhou (logs detalhados; compensação executada).
- `EXPIRING`    faltam menos de X dias (aviso visual / pode renovar).
- `EXPIRED`     prazo vencido; job de expiração dispara remoção.
- `REMOVING`    cleanup em andamento.
- `REMOVED`     todos os recursos liberados; nenhum órfão.

## Steps do pipeline (ordem)

Cada step implementa `IDeployStep { name, execute(ctx), compensate(ctx) }`.

| # | Step                       | Responsabilidade                                  |
|---|----------------------------|---------------------------------------------------|
| 1 | `CloneRepositoryStep`      | clona a branch (GitLab + token do projeto)        |
| 2 | `CheckoutCommitStep`       | checkout no commit selecionado                    |
| 3 | `CreateNetworkStep`        | cria rede isolada `net-<hash>`                     |
| 4 | `ProvisionDatabaseStep`    | cria + restaura banco isolado (Strategy)          |
| 5 | `ResolveHostnameStep`      | gera hostname + URL do ambiente                   |
| 6 | `ResolveEnvVarsStep`       | aplica overrides autorizados + injeta DATABASE_URL|
| 7 | `BuildImageStep`           | build da imagem (Dockerfile + build-args da env)  |
| 8 | `ComputeRouteStep`         | calcula labels de rota do proxy reverso           |
| 9 | `RunContainerStep`         | sobe o container na rede isolada                  |
| 10| `RegisterDnsStep`          | cria registro no Pi-hole apontando p/ proxy       |
| 11| `HealthCheckStep`          | valida DNS, proxy, app e banco                    |

Sucesso de todos ⇒ `READY`. Falha ⇒ `compensate()` em ordem inversa ⇒ `FAILED`.

**Banco antes do build:** `ProvisionDatabaseStep` + `ResolveEnvVarsStep` rodam ANTES
de `BuildImageStep`. Assim falha-se cedo (sem desperdiçar build) e a env resolvida
(incl. a URL do banco isolado) é passada como **build-args** — ver "Migrations" abaixo.

Cada step expõe um `label` legível (PT) usado no progresso ao vivo.

## Origem do banco (por deploy, não por projeto)

A estratégia de banco é escolhida pela ORIGEM selecionada no ambiente
(`BackupSource`), não pelo padrão do projeto — o QA decide de onde o banco vem a
cada deploy. O `Project.databaseStrategy` apenas pré-seleciona a opção na tela.

| `BackupSource`      | Estratégia                                     | Origem do banco                          |
|---------------------|------------------------------------------------|------------------------------------------|
| `UPLOAD`            | `UploadSqlDatabaseStrategy` (restaura arquivo) | arquivo `.sql/.sql.gz` enviado pelo QA   |
| `STORED_BACKUP`     | `UploadSqlDatabaseStrategy` (backup salvo)     | dump escolhido de um backup concluído    |
| `PRODUCTION_COPY`   | `CopyDatabaseStrategy("produção")`             | `Project.productionDbUrl` **ou** global  |
| `HOMOLOGATION_COPY` | `CopyDatabaseStrategy("homologação")`          | `Project.homologationDbUrl` **ou** global|

`CopyDatabaseStrategy` é parametrizada por um resolver de URL de origem — a mesma
classe atende produção e homologação (parametrização > duplicação).

**Cópia COMPLETA antes do build (inclui `_prisma_migrations`):** o banco isolado é
dropado+recriado (slate limpo) e recebe um `pg_dump` completo da origem — schema,
dados e a tabela `_prisma_migrations`. Como a cópia roda ANTES do `BuildImage`, o
`prisma migrate deploy` do Dockerfile encontra todas as migrations já aplicadas e
vira **no-op** (não tenta recriar tipos/tabelas → sem `type "X" already exists`).
A URL de origem tem a query (`?schema=public`) removida e `connect_timeout` para
não pendurar; o progresso do `pg_dump --verbose` é transmitido ao vivo.

**Config pelo ADMIN, clique pelo QA:** as conexões de produção e homologação são
cadastradas pelo admin — global em **Configurações** (`SystemSettings.prodDbUrl`
/ `homologDbUrl`) e, opcionalmente, sobrescritas por projeto
(`Project.productionDbUrl` / `homologationDbUrl`). O QA **não digita URL**: só
escolhe a origem. A resolução (`EnvironmentService.buildDeployInputs`) é
`override do projeto || padrão global`.

## Porta do container (roteamento do proxy)

O Traefik precisa saber a porta interna do container — o `ComputeRouteStep`
(estratégia Traefik) emite `traefik.http.services.<router>.loadbalancer.server.port`.
Sem isso o Traefik erra `service ... error: port is missing` quando a imagem não
expõe exatamente uma porta. A porta é `ctx.appPort` = `request.appPort` (override
por deploy) **ou** `project.appPort` (padrão do projeto, default `80`), ambos
cadastrados pelo admin / escolhidos na criação do ambiente.

## Usuário de aplicação e RLS

O admin (`postgres`) **bypassa RLS** (superuser ignora policies). Para a aplicação
respeitar Row Level Security, o projeto pode definir `appDbUser` (nome do role):

- O role é criado (`ensureLoginRole`, idempotente, cluster-wide) **antes da cópia**,
  para que `CREATE POLICY ... TO <user>` da origem seja restaurado com sucesso.
- É um role comum (LOGIN, **sem** SUPERUSER/BYPASSRLS) → **sujeito a RLS**.
- Recebe GRANT de DML no banco copiado; como **não é dono** das tabelas
  (restauradas com `--no-owner`, dono = admin), continua sujeito às policies.
- O `DATABASE_URL` injetado no container usa esse usuário (senha gerada pelo
  sistema a cada deploy). O nome deve **casar com o role das policies** da origem.
- Vazio (`appDbUser` não informado) → conecta como admin (ignora RLS, comportamento padrão).

## Dockerfile por deploy

`BuildImageStep` usa `ctx.dockerfile` = `request.dockerfilePath || project.dockerfilePath`.
O QA escolhe, na criação do ambiente, qual Dockerfile usar (lista vinda da árvore
do repositório no GitLab — `GET /projects/:id/gitlab/dockerfiles`), útil em repos
com vários Dockerfiles.

## Migrations e a URL do banco (build-time x runtime)

O banco de cada ambiente é **isolado** (`db_<hash>` no Postgres efêmero). A URL desse
banco chega ao container de dois jeitos:

- **Runtime:** `RunContainerStep` injeta `DATABASE_URL` (a var de banco do projeto) via
  `docker createContainer Env`, que **sobrescreve** qualquer `ENV` da imagem. Logo, em
  runtime o app sempre usa o banco isolado — mesmo que o Dockerfile tenha `ENV` hardcoded.
- **Build-time:** `BuildImageStep` passa `ctx.resolvedEnv` como **build-args**. Mas
  build-arg só é aplicado se o Dockerfile **declarar `ARG`**. Um `ENV` hardcoded NÃO é
  sobrescrito por build-arg (limitação do Docker).

➡️ Para Dockerfiles que rodam migrations em build-time (`RUN npx prisma migrate deploy`),
parametrize a URL no estágio de build para que ela acerte o banco isolado:

```dockerfile
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma migrate deploy   # roda contra db_<hash> (banco isolado do ambiente)
```

Sem isso, a migration em build-time roda contra o banco fixo do Dockerfile, não contra
o banco do ambiente.

## Progresso ao vivo (SSE)

A trilha de `ctx.log()` é persistida incrementalmente em `Environment.deployLog`
pelo worker (throttle ~400ms + flush final). Como API e worker rodam em processos
separados, o endpoint SSE `GET /api/environments/:id/deploy/stream` faz *tail*
dessa coluna (polling ~700ms), emitindo as linhas novas e encerrando com
`event: done` quando o ambiente sai de `PENDING`/`PROVISIONING`. A trilha fica
persistida (visível também em `FAILED`).

## Cleanup / Remoção (reuso dos steps)

A remoção roda `compensate()` dos steps já executados, em ordem inversa:
remove rota proxy → remove DNS → para/remove container → remove volume →
remove banco → remove rede → remove imagens órfãs → grava auditoria.

## Idempotência

Nomes derivados do hash (`env-<hash>`, `net-<hash>`, `db_<hash>`) tornam cada step
idempotente: "create if not exists". Re-tentativas (BullMQ retry) não duplicam.

## Health Check (gate para READY)

- DNS resolvendo o hostname.
- Certificado válido.
- Proxy respondendo (rota ativa).
- Aplicação respondendo (HTTP 2xx/3xx no endpoint de health).
- Banco conectado.
