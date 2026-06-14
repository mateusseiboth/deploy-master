# Logs em Tempo Real & Console Web (diferencial)

## Logs em tempo real (SSE)

- **Endpoint**: `GET /api/environments/:id/logs/stream` (Server-Sent Events).
- Autenticação por `?access_token=` (EventSource não envia header) — o
  `authContextMiddleware` aceita o token na query e `requireRole()` protege a rota.
- O `containerId` é lido numa **transação curta**; o stream roda **fora** de
  qualquer transação (conexão longa não segura o Postgres).
- `DockerService.followLogs` segue `container.logs({follow})`, demultiplexa o
  protocolo stdout/stderr do Docker e escreve cada linha como evento SSE.
- Frontend: `LogsDialog` consome via `EventSource`, com auto-scroll e buffer
  limitado (2000 linhas).

## Console web interativo (WebSocket + xterm)

- **Endpoint**: `WS /api/environments/:id/console`.
- `attachConsoleWebsocket` trata o `upgrade` do HTTP server (`ws`, `noServer`):
  valida o token (`?access_token`), bloqueia VIEWER (403), resolve o container e
  liga o shell ao socket.
- `DockerService.openConsole` cria um `exec` (`/bin/sh`, `Tty`, `hijack`) e
  devolve o stream duplex; o bridge faz `container ↔ navegador` bidirecional.
- Frontend: `ConsoleDialog` usa **xterm.js** (+ FitAddon), carregado sob demanda
  (code-splitting) para não pesar o bundle inicial.

## Validação realizada

- SSE: rota existe e exige auth (401 sem token).
- WS: sem token → rejeitado no handshake; token válido → **handshake 101 OK** e o
  bridge executa (fecha com 1011 apenas por não haver DB/container no sandbox).

## Limitação

Requer Docker + container em execução para exibir conteúdo real. O redimensionamento
do TTY (resize) ainda não é propagado ao `exec` — melhoria futura.
