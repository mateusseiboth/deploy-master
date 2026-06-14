# Infra local, Migrations e Configurações no Banco

## Migrations (Prisma 7)

- `prisma.config.ts` carrega o `.env` (`import "dotenv/config"`) porque o CLI do
  Prisma roda em Node (sem o auto-load do Bun). Sem isso: `PrismaConfigEnvError:
  Cannot resolve environment variable: DATABASE_URL`.
- O usuário `prismauser` **não tem** `CREATEDB`, então `prisma migrate dev`
  (que cria um shadow DB) falha. Usamos o fluxo de **baseline** (sem shadow DB):

  ```bash
  mkdir -p prisma/migrations/0_init
  bunx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
    > prisma/migrations/0_init/migration.sql
  bunx prisma migrate deploy
  ```

- O database `deploy_master` precisa existir (criado pelo superusuário, com
  `OWNER prismauser`). `migrate deploy` aplica as migrations sem shadow DB.
- Próximas alterações: editar `schema.prisma` → gerar nova pasta em
  `prisma/migrations/<n>_<nome>` com `migrate diff --from-migrations` → `migrate deploy`.

## Configurações no banco (não env) — Pi-hole e proxy

Endereços de Pi-hole e proxy reverso são **cadastrados pelo ADMIN** e ficam na
tabela `system_settings` (linha única `singleton`), não em env. O `.env` serve só
como **semente inicial** quando a linha ainda não existe.

- API: `GET /api/settings` (autenticado) · `PUT /api/settings` (ADMIN).
- UI: página **Configurações** (admin).
- O pipeline lê via `SettingsService.get()` (cacheado), injeta em
  `DeployContext.settings` e os steps (DNS, proxy, health check) usam de lá.

## Infra local (Docker)

`docker-compose.infra.yml`: Postgres (ephemeral), **Traefik** (proxy) e
**Pi-hole v5** (`2024.07.0` — a v6 trocou a API `customdns`). O DNS do Pi-hole é
bindado no IP de LAN (`${REVERSE_PROXY_IP}:53`) porque o `systemd-resolved` ocupa
a porta 53 no loopback. Web admin do Pi-hole em `:8081`.

```bash
export REVERSE_PROXY_IP=20.0.0.128 PIHOLE_WEBPASSWORD=admintest
docker compose -f docker-compose.infra.yml up -d
```

O **API token do Pi-hole v5** = `sha256(sha256(WEBPASSWORD))`; cadastre-o em
`/api/settings` (`piholeApiToken`). Aponte a máquina-cliente para
`${REVERSE_PROXY_IP}` como servidor DNS.

## Backend em container (container-to-container)

`Dockerfile` + `docker-compose.yml` rodam **api** e **worker** em containers com
`/var/run/docker.sock` mapeado — o backend orquestra os ambientes efêmeros no
mesmo daemon Docker (sibling containers), na rede `traefik-public`.

```bash
docker compose -f docker-compose.infra.yml -f docker-compose.yml up -d --build
```

## Validação realizada (infra real)

- Migrations aplicadas no Postgres remoto; `bun run seed` criou o admin.
- Login → JWT → `/auth/me` → `/projects` OK contra o banco real.
- Pi-hole no ar; API `customdns` `add/get/delete` funcionou (igual ao
  `PiholeDnsService`).
- `PUT/GET /api/settings` persistiu Pi-hole/proxy no banco; escrita bloqueada
  para VIEWER (403).

## Pendência

- Migrar `PiholeDnsService` para a API do Pi-hole **v6** (sessão/app-password)
  para usar a imagem `latest`.
