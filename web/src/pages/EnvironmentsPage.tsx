import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Dialog, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Select} from "@/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {useToast} from "@/components/ui/toast";
import {CreateEnvironmentDialog} from "@/features/environments/CreateEnvironmentDialog";
import {LogsDialog} from "@/features/environments/LogsDialog";
import {StatusBadge} from "@/features/environments/StatusBadge";
import {useEnvironmentAction, useEnvironments} from "@/features/environments/hooks";
import type {Environment} from "@/lib/types";
import {daysUntil, formatDate} from "@/lib/utils";
import {AlertTriangle, Clock, ExternalLink, Plus, RefreshCw, RotateCw, ScrollText, TerminalSquare, Trash2} from "lucide-react";
import * as React from "react";
import {lifeRatio} from "./DashboardPage";

// Console (xterm) é pesado: carregado sob demanda (code-splitting).
const ConsoleDialog = React.lazy(() => import("@/features/environments/ConsoleDialog").then((m) => ({default: m.ConsoleDialog})));

export function EnvironmentsPage() {
  const {data, isLoading} = useEnvironments();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [renewTarget, setRenewTarget] = React.useState<Environment | null>(null);
  const [logsTarget, setLogsTarget] = React.useState<Environment | null>(null);
  const [consoleTarget, setConsoleTarget] = React.useState<Environment | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Operação</p>
          <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Ambientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Listagem em tempo real · atualiza a cada 5s</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo ambiente
        </Button>
      </header>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ambiente</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Nenhum ambiente.
                </TableCell>
              </TableRow>
            )}
            {data?.map((env) => (
              <EnvironmentRow
                key={env.id}
                env={env}
                onRenew={() => setRenewTarget(env)}
                onLogs={() => setLogsTarget(env)}
                onConsole={() => setConsoleTarget(env)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>

      <CreateEnvironmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <RenewDialog
        env={renewTarget}
        onClose={() => setRenewTarget(null)}
      />
      <LogsDialog
        env={logsTarget}
        onClose={() => setLogsTarget(null)}
      />
      {consoleTarget && (
        <React.Suspense fallback={null}>
          <ConsoleDialog
            env={consoleTarget}
            onClose={() => setConsoleTarget(null)}
          />
        </React.Suspense>
      )}
    </div>
  );
}

function EnvironmentRow({
  env,
  onRenew,
  onLogs,
  onConsole,
}: {
  env: Environment;
  onRenew: () => void;
  onLogs: () => void;
  onConsole: () => void;
}) {
  const {notify} = useToast();
  const {restart, remove} = useEnvironmentAction();
  const remaining = daysUntil(env.expiresAt);
  const expiringSoon = remaining !== null && remaining <= 2;

  return (
    <TableRow>
      <TableCell className="font-medium">{env.name}</TableCell>
      <TableCell className="text-muted-foreground">{env.project?.name ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{env.commitHash.slice(0, 7)}</TableCell>
      <TableCell>
        <StatusBadge
          status={env.status}
          ratio={lifeRatio(env)}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs">
          {expiringSoon && <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={expiringSoon ? "text-amber-400" : "text-muted-foreground"}>
            {remaining === null ? "—" : remaining < 0 ? "vencido" : `${remaining}d`}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{formatDate(env.expiresAt)}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {env.url && env.status === "READY" && (
            <a
              href={env.url}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="ghost"
                size="icon"
                title="Abrir"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Ver logs"
            onClick={onLogs}
          >
            <ScrollText className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Console"
            onClick={onConsole}
          >
            <TerminalSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Renovar"
            onClick={onRenew}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Reiniciar"
            onClick={() => restart.mutate(env.id, {onSuccess: () => notify("Reinício enfileirado")})}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Excluir"
            onClick={() => {
              if (confirm(`Excluir o ambiente ${env.name}?`)) {
                remove.mutate(env.id, {onSuccess: () => notify("Exclusão enfileirada")});
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RenewDialog({env, onClose}: {env: Environment | null; onClose: () => void}) {
  const {notify} = useToast();
  const {renew} = useEnvironmentAction();
  const [days, setDays] = React.useState(7);

  if (!env) return null;

  return (
    <Dialog
      open={!!env}
      onOpenChange={(o) => !o && onClose()}
    >
      <DialogHeader>
        <DialogTitle>Renovar {env.name}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value="1">1 dia</option>
          <option value="3">3 dias</option>
          <option value="7">7 dias</option>
          <option value="14">14 dias</option>
        </Select>
        <p className="text-xs text-muted-foreground">Renovações usadas: {env.renewalCount}</p>
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          disabled={renew.isPending}
          onClick={() =>
            renew.mutate(
              {id: env.id, days},
              {
                onSuccess: () => {
                  notify("Ambiente renovado");
                  onClose();
                },
                onError: () => notify("Não foi possível renovar (limite/prazo)", "error"),
              },
            )
          }
        >
          Renovar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
