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
| 3 | `BuildImageStep`           | build da imagem Docker (Dockerfile path/cmd)      |
| 4 | `CreateNetworkStep`        | cria rede isolada `net-<hash>`                     |
| 5 | `ProvisionDatabaseStep`    | cria banco temporário (Strategy)                  |
| 6 | `RestoreBackupStep`        | restaura `.sql`/`.sql.gz` (Strategy)              |
| 7 | `ResolveEnvVarsStep`       | aplica overrides autorizados + injeta DATABASE_URL|
| 8 | `RunContainerStep`         | sobe o container na rede isolada                  |
| 9 | `RegisterDnsStep`          | cria registro no Pi-hole apontando p/ proxy       |
| 10| `RegisterProxyRouteStep`   | cria rota + certificado no proxy (Strategy)       |
| 11| `HealthCheckStep`          | valida DNS, cert, proxy, app e banco              |

Sucesso de todos ⇒ `READY`. Falha ⇒ `compensate()` em ordem inversa ⇒ `FAILED`.

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
