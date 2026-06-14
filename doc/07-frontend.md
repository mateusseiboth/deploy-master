# Frontend (Fase 5) — `web/`

SPA em React + TypeScript + Vite, UI no estilo ShadCN (Tailwind + CVA + `cn`) e
estado de servidor com TanStack Query.

## Stack & estrutura

```text
web/src/
  lib/        utils (cn/datas), types (contratos da API), api (axios+refresh), queryClient
  components/ui/   primitivas estilo ShadCN (button, card, input, select, badge,
                   table, dialog, toast)
  components/      AppLayout (sidebar + nav)
  features/
    auth/          AuthContext (login/refresh/me/logout)
    environments/  hooks (lista/ações), StatusBadge, CreateEnvironmentDialog
    projects/      hooks (projetos + navegação GitLab)
    dashboard/     hooks (indicadores)
  pages/      Login, Dashboard, Environments, Projects
  App.tsx     rotas + ProtectedRoute
  main.tsx    providers (QueryClient, Toast, Router, Auth)
```

## Autenticação

`AuthContext` guarda o usuário; `lib/api.ts` injeta o `Bearer` e, em 401,
**rotaciona o refresh token uma vez** (deduplicado) antes de redirecionar ao
login. Tokens em `localStorage`. `ProtectedRoute` bloqueia rotas sem sessão.

## Fluxo de criação (wizard)

`CreateEnvironmentDialog`: projeto → branch (`/gitlab/branches`) → commit
(`/gitlab/commits`, exibe hash/autor/data/mensagem) → banco (upload `.sql/.sql.gz`
via `/backups` ou cópia de produção) → variáveis sobrescrevíveis (só as
autorizadas do projeto) → **Acionar deploy** (`POST /environments`).

## Painel de ambientes (tempo real)

Lista com `refetchInterval` (polling 5s). Status traduzido em `StatusBadge`.
Ações por linha: abrir (URL), renovar (modal com 1/3/7/14 dias respeitando o
limite do backend), reiniciar, excluir (confirmação). Aviso visual de expiração
quando faltam ≤ 2 dias.

## Admin de projetos

Lista + `CreateProjectDialog` (config GitLab, estratégia de banco, domínio,
política de prazo e variáveis sobrescrevíveis). Botão de criação só para ADMIN.

## Dev / build

- `bun run dev` (porta 5173) com proxy `/api → http://localhost:3000`.
- `bun run build` → `tsc --noEmit && vite build` (validado: 0 erros, bundle OK).

## Pendências (futuro)

- Logs em tempo real (stream) + console web do container.
- Trocar primitivas leves pela biblioteca ShadCN/Radix oficial.
- Edição/remoção de variáveis e projetos na UI (endpoints já existem no backend).
