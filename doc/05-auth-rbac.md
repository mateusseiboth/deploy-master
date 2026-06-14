# Autenticação & RBAC (Fase 2)

## Tokens

- **Access token**: JWT assinado (`JWT_ACCESS_SECRET`), stateless, TTL curto
  (`JWT_ACCESS_TTL`, padrão 15m). Claims: `sub` (id), `role`, `email`.
- **Refresh token**: opaco (UUID) **persistido** (`refresh_tokens`), TTL longo
  (`JWT_REFRESH_TTL`, padrão 7d). Permite **rotação** e **revogação** (logout).

## Fluxo

```text
POST /api/auth/login    {email,password}  -> {accessToken, refreshToken, user}
POST /api/auth/refresh  {refreshToken}    -> rotaciona: revoga o antigo, emite novo par
POST /api/auth/logout   {refreshToken}    -> revoga o refresh
GET  /api/auth/me        (Bearer)         -> identidade do token
POST /api/auth/register  (ADMIN)          -> cria usuário (senha com bcrypt)
```

`authContextMiddleware` lê `Authorization: Bearer <jwt>` e popula `req.user`
quando válido (não bloqueia). `requireRole(...roles)` exige autenticação e,
opcionalmente, um papel. Todos os routers sob `/api` (exceto `/api/auth`) ficam
atrás de `requireRole()` (qualquer papel autenticado, i.e. VIEWER+).

## Papéis (RBAC)

| Papel  | Pode                                                                |
| ------ | ------------------------------------------------------------------- |
| ADMIN  | configurar projetos/variáveis/prazos; excluir qualquer ambiente     |
| QA     | criar/renovar/reiniciar/excluir **ambiente próprio**                |
| VIEWER | apenas consultar                                                    |

A regra de **propriedade** (QA só no próprio ambiente) é aplicada no
`EnvironmentService.requireOwnedOrAdmin` — não só no middleware, garantindo a
regra de negócio na camada certa (CLAUDE.md §5).

## Bootstrap

`bun run seed` cria o primeiro ADMIN (idempotente). Variáveis:
`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`.

## Integração com contexto/transação

`authContextMiddleware` (HTTP) → `req.user` → `withTransaction` injeta no
`RequestContext` (AsyncLocalStorage) → Services leem `this.currentUser`. Assim a
identidade flui para regras de negócio e auditoria sem parâmetros extras.

## Pendências (futuro)

- `checkPermissions` granular por recurso (além do papel).
- 2FA, refresh em cookie httpOnly, expiração/limpeza de tokens revogados.
