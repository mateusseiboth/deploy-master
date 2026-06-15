import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useSettings,
  useUpdateSettings,
  useProductionBackups,
  useTriggerProductionBackup,
  type SystemSettings,
} from "@/features/settings/hooks";

type StringKey = {
  [K in keyof SystemSettings]: SystemSettings[K] extends string ? K : never;
}[keyof SystemSettings];

interface FieldDef {
  key: StringKey;
  label: string;
  hint?: string;
  secret?: boolean;
}

const INFRA_FIELDS: FieldDef[] = [
  { key: "piholeBaseUrl", label: "Pi-hole — URL base (v6)", hint: "raiz do Pi-hole, ex.: http://10.10.10.2 (sem /admin)" },
  { key: "piholePassword", label: "Pi-hole — senha do admin", secret: true, hint: "v6 autentica por senha (não há mais API token)" },
  { key: "reverseProxyIp", label: "IP do proxy reverso", hint: "para onde os hostnames apontam" },
  { key: "traefikNetwork", label: "Rede do Traefik" },
  { key: "baseDomain", label: "Domínio base", hint: "ex.: qa.local" },
];

const GITLAB_FIELDS: FieldDef[] = [
  { key: "gitlabBaseUrl", label: "GitLab — URL base", hint: "ex.: https://gitlab.empresa.com" },
  { key: "gitlabApiToken", label: "GitLab — token de API (geral)", secret: true, hint: "usado por todos os projetos para buscar pela API" },
];

const BACKUP_FIELDS: FieldDef[] = [
  { key: "prodBackupDbUrl", label: "Backup — conexão do Postgres de produção", hint: "postgresql://user:pass@host:5432/postgres" },
  { key: "prodBackupDir", label: "Backup — pasta destino", hint: "onde os dumps de todos os bancos serão gravados" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { data } = useSettings();
  const update = useUpdateSettings();
  const { notify } = useToast();
  const [form, setForm] = React.useState<Partial<SystemSettings>>({});
  const isAdmin = user?.role === "ADMIN";

  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function setField<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSave() {
    try {
      await update.mutateAsync(form);
      notify("Configurações salvas");
    } catch {
      notify("Falha ao salvar (apenas ADMIN)", "error");
    }
  }

  function renderFields(fields: FieldDef[]) {
    return fields.map((f) => (
      <div key={f.key} className="space-y-1.5">
        <Label>{f.label}</Label>
        <Input
          type={f.secret ? "password" : "text"}
          disabled={!isAdmin}
          value={(form[f.key] as string) ?? ""}
          onChange={(e) => setField(f.key, e.target.value)}
        />
        {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
      </div>
    ));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-sm text-muted-foreground">Pi-hole, GitLab e backup de produção (cadastrados no banco)</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Infraestrutura (DNS e proxy)</CardTitle>
          <CardDescription>Usados pelo pipeline de deploy para DNS e roteamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(INFRA_FIELDS)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitLab</CardTitle>
          <CardDescription>Token geral: os projetos buscam metadados e repositórios pela API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(GITLAB_FIELDS)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup automático de produção</CardTitle>
          <CardDescription>
            Roda um <code>pg_dump</code> completo de todos os bancos do servidor e grava na pasta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderFields(BACKUP_FIELDS)}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intervalo entre backups (horas)</Label>
              <Input
                type="number"
                min={1}
                disabled={!isAdmin}
                value={form.prodBackupIntervalHours ?? 24}
                onChange={(e) => setField("prodBackupIntervalHours", Number(e.target.value))}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={form.prodBackupEnabled ?? false}
                  onChange={(e) => setField("prodBackupEnabled", e.target.checked)}
                />
                Backup automático habilitado
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Somente administradores podem editar.</p>
      )}

      {isAdmin && <ProductionBackups />}
    </div>
  );
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function ProductionBackups() {
  const { data } = useProductionBackups();
  const trigger = useTriggerProductionBackup();
  const { notify } = useToast();

  async function onRun() {
    try {
      await trigger.mutateAsync();
      notify("Backup de produção enfileirado");
    } catch {
      notify("Falha ao disparar backup", "error");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Execuções de backup</CardTitle>
          <CardDescription>Histórico (automático e solicitado).</CardDescription>
        </div>
        <Button size="sm" onClick={onRun} disabled={trigger.isPending}>
          {trigger.isPending ? "Enfileirando…" : "Rodar agora"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!data?.length && <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>}
        {data?.map((log) => (
          <div key={log.id} className="rounded-md border p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {log.trigger === "AUTOMATIC" ? "Automático" : "Solicitado"} · {statusLabel(log.status)}
              </span>
              <span className="text-muted-foreground">{formatDate(log.startedAt)}</span>
            </div>
            <p className="text-muted-foreground">
              {log.databases?.length ?? 0} banco(s) · {formatBytes(log.totalBytes)} · {log.directory}
            </p>
            {log.message && <p className="text-amber-400">{log.message}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: "RUNNING" | "SUCCESS" | "FAILED"): string {
  return status === "SUCCESS" ? "Concluído" : status === "FAILED" ? "Falhou" : "Em execução";
}
