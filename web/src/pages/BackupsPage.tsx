import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatBytes, formatDate } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useSettings,
  useUpdateSettings,
  useBackupConfigs,
  useUpsertBackupConfig,
  useProductionBackups,
  useTriggerProductionBackup,
  useRunDatabaseBackup,
  type BackupDatabaseConfig,
  type BackupConfigInput,
  type BackupFrequency,
  type ProductionBackupLog,
  type SystemSettings,
} from "@/features/settings/hooks";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const FREQUENCY_LABEL: Record<BackupFrequency, string> = {
  DAILY: "Diário",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
};

export function BackupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Somente administradores acessam os backups.</p>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <p className="eyebrow">Operação</p>
        <h2 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Backups</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conexão, agendamento por banco e histórico das execuções.
        </p>
      </header>

      <ConnectionCard />
      <SchedulesCard />
      <ExecutionsCard />
    </div>
  );
}

// ── Conexão / chave-mestra ────────────────────────────────────────────────────

function ConnectionCard() {
  const { data } = useSettings();
  const update = useUpdateSettings();
  const { notify } = useToast();
  const [form, setForm] = React.useState<Partial<SystemSettings>>({});

  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  async function onSave() {
    try {
      await update.mutateAsync(form);
      notify("Configurações salvas");
    } catch {
      notify("Falha ao salvar", "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conexão do servidor de produção</CardTitle>
        <CardDescription>
          O backup roda <code>pg_dump</code> por banco e grava em <code>.sql.gz</code> na pasta destino,
          organizados em <code>AAAA/banco/MM/</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Conexão do Postgres de produção</Label>
          <Input
            value={form.prodBackupDbUrl ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, prodBackupDbUrl: e.target.value }))}
            placeholder="postgresql://user:pass@host:5432/postgres"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Pasta destino</Label>
          <Input
            value={form.prodBackupDir ?? ""}
            onChange={(e) => setForm((s) => ({ ...s, prodBackupDir: e.target.value }))}
            placeholder="/var/backups/postgres"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.prodBackupEnabled ?? false}
            onChange={(e) => setForm((s) => ({ ...s, prodBackupEnabled: e.target.checked }))}
          />
          Backup automático habilitado (chave-mestra do agendamento)
        </label>
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar conexão"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Agendamento por banco ─────────────────────────────────────────────────────

function SchedulesCard() {
  const { data: settings } = useSettings();
  const hasUrl = !!settings?.prodBackupDbUrl;
  const configs = useBackupConfigs(hasUrl);
  const trigger = useTriggerProductionBackup();
  const { notify } = useToast();

  async function onRunAll() {
    try {
      await trigger.mutateAsync();
      notify("Backup enfileirado para os bancos habilitados");
    } catch {
      notify("Falha ao disparar backup", "error");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Bancos para backup</CardTitle>
          <CardDescription>Frequência e horário por banco (descobertos da URL configurada).</CardDescription>
        </div>
        <Button size="sm" onClick={onRunAll} disabled={trigger.isPending}>
          {trigger.isPending ? "Enfileirando…" : "Rodar habilitados"}
        </Button>
      </CardHeader>
      <CardContent>
        {!hasUrl && (
          <p className="text-sm text-muted-foreground">Configure a conexão acima para listar os bancos.</p>
        )}
        {hasUrl && configs.isLoading && <p className="text-sm text-muted-foreground">Carregando bancos…</p>}
        {hasUrl && configs.isError && (
          <p className="text-sm text-destructive">Não foi possível listar os bancos (verifique a URL).</p>
        )}
        {hasUrl && configs.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum banco encontrado no servidor.</p>
        )}
        {hasUrl && !!configs.data?.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Quando</TableHead>
                <TableHead>Última</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.data.map((config) => (
                <ScheduleRow key={config.databaseName} config={config} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleRow({ config }: { config: BackupDatabaseConfig }) {
  const upsert = useUpsertBackupConfig();
  const run = useRunDatabaseBackup();
  const { notify } = useToast();

  const [draft, setDraft] = React.useState<BackupConfigInput>({
    enabled: config.enabled,
    frequency: config.frequency,
    hourOfDay: config.hourOfDay,
    dayOfWeek: config.dayOfWeek,
    dayOfMonth: config.dayOfMonth,
  });

  // Resincroniza quando a config recarrega (ex.: após salvar/refetch).
  React.useEffect(() => {
    setDraft({
      enabled: config.enabled,
      frequency: config.frequency,
      hourOfDay: config.hourOfDay,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
    });
  }, [config.enabled, config.frequency, config.hourOfDay, config.dayOfWeek, config.dayOfMonth]);

  function patch(p: Partial<BackupConfigInput>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  async function onSave() {
    // Defaults sensatos ao trocar a frequência sem ter escolhido dia.
    const input: BackupConfigInput = {
      ...draft,
      dayOfWeek: draft.frequency === "WEEKLY" ? draft.dayOfWeek ?? 0 : null,
      dayOfMonth: draft.frequency === "MONTHLY" ? draft.dayOfMonth ?? 1 : null,
    };
    try {
      await upsert.mutateAsync({ databaseName: config.databaseName, input });
      notify(`Agendamento de ${config.databaseName} salvo`);
    } catch {
      notify("Falha ao salvar agendamento", "error");
    }
  }

  async function onRun() {
    try {
      await run.mutateAsync(config.databaseName);
      notify(`Backup de ${config.databaseName} enfileirado`);
    } catch {
      notify("Falha ao disparar backup", "error");
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        {config.databaseName}
        {!config.present && <span className="ml-1 text-amber-400" title="Banco não existe mais no servidor">⚠</span>}
      </TableCell>
      <TableCell>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
      </TableCell>
      <TableCell>
        <Select
          value={draft.frequency}
          onChange={(e) => patch({ frequency: e.target.value as BackupFrequency })}
        >
          {(Object.keys(FREQUENCY_LABEL) as BackupFrequency[]).map((f) => (
            <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {draft.frequency === "WEEKLY" && (
            <Select
              value={String(draft.dayOfWeek ?? 0)}
              onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
            >
              {WEEKDAYS.map((label, i) => <option key={i} value={i}>{label}</option>)}
            </Select>
          )}
          {draft.frequency === "MONTHLY" && (
            <Input
              type="number"
              min={1}
              max={28}
              className="w-16"
              value={draft.dayOfMonth ?? 1}
              onChange={(e) => patch({ dayOfMonth: Number(e.target.value) })}
            />
          )}
          <Input
            type="number"
            min={0}
            max={23}
            className="w-16"
            value={draft.hourOfDay}
            onChange={(e) => patch({ hourOfDay: Number(e.target.value) })}
            title="Hora do dia (0–23)"
          />
          <span className="text-xs text-muted-foreground">h</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDate(config.lastRunAt)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" onClick={onSave} disabled={upsert.isPending}>Salvar</Button>
          <Button size="sm" variant="ghost" onClick={onRun} disabled={run.isPending}>Rodar</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Histórico de execuções ────────────────────────────────────────────────────

function ExecutionsCard() {
  const { data } = useProductionBackups();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Execuções</CardTitle>
        <CardDescription>Histórico por banco (automático e solicitado).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data?.length && <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>}
        {data?.map((log) => <BackupLogRow key={log.id} log={log} />)}
      </CardContent>
    </Card>
  );
}

function BackupLogRow({ log }: { log: ProductionBackupLog }) {
  const running = log.status === "RUNNING";
  const color =
    log.status === "SUCCESS" ? "text-emerald-400" : log.status === "FAILED" ? "text-destructive" : "text-primary";

  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          <span className="font-mono">{log.databaseName}</span> · {log.trigger === "AUTOMATIC" ? "Automático" : "Solicitado"} ·{" "}
          <span className={color}>{statusLabel(log.status)}</span>
        </span>
        <span className="text-muted-foreground">{formatDate(log.startedAt)}</span>
      </div>
      {/* Barra de progresso: indeterminada (pulse) enquanto roda; cheia ao fim. */}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full w-full transition-all ${
            log.status === "FAILED" ? "bg-destructive" : running ? "bg-primary animate-pulse" : "bg-emerald-500"
          }`}
        />
      </div>
      <p className="mt-1.5 text-muted-foreground">
        {running ? (
          <>gerando dump (.sql.gz)…</>
        ) : (
          <>
            {formatBytes(log.sizeBytes)}
            {log.finishedAt && <> · concluído em {formatDate(log.finishedAt)}</>}
          </>
        )}
      </p>
      {log.message && <p className="text-amber-400">{log.message}</p>}
    </div>
  );
}

function statusLabel(status: ProductionBackupLog["status"]): string {
  return status === "SUCCESS" ? "Concluído" : status === "FAILED" ? "Falhou" : "Em execução";
}
