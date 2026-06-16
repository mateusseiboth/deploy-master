import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useSettings,
  useUpdateSettings,
  type SystemSettings,
  type PiholeServer,
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
  { key: "reverseProxyIp", label: "IP do proxy reverso", hint: "para onde os hostnames apontam" },
  { key: "traefikNetwork", label: "Rede do Traefik" },
  { key: "baseDomain", label: "Domínio base", hint: "ex.: qualitysistemas.localdev — usado por projetos sem domínio próprio" },
];

const GITLAB_FIELDS: FieldDef[] = [
  { key: "gitlabBaseUrl", label: "GitLab — URL base", hint: "ex.: https://gitlab.empresa.com" },
  { key: "gitlabApiToken", label: "GitLab — token de API (geral)", secret: true, hint: "usado por todos os projetos para buscar pela API" },
];

const COPY_SOURCE_FIELDS: FieldDef[] = [
  { key: "prodDbUrl", label: "Banco de PRODUÇÃO (origem da cópia)", hint: "postgresql://user:pass@host:5432/db — usado quando o QA escolhe 'Copiar produção'. Recomenda-se usuário read-only." },
  { key: "homologDbUrl", label: "Banco de HOMOLOGAÇÃO (origem da cópia)", hint: "postgresql://user:pass@host:5432/db — usado quando o QA escolhe 'Copiar homologação'." },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { data } = useSettings();
  const update = useUpdateSettings();
  const { notify } = useToast();
  const [form, setForm] = React.useState<Partial<SystemSettings>>({});
  const isAdmin = user?.role === "ADMIN";

  React.useEffect(() => {
    if (!data) return;
    // Semeia a lista a partir do par legado (URL+senha) quando ainda vazia, para
    // o admin enxergar/migrar a config antiga de um único Pi-hole.
    const piholeServers =
      data.piholeServers?.length
        ? data.piholeServers
        : data.piholeBaseUrl
          ? [{ baseUrl: data.piholeBaseUrl, password: data.piholePassword }]
          : [];
    setForm({ ...data, piholeServers });
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
        <p className="text-sm text-muted-foreground">Pi-hole, GitLab e bancos de origem (cadastrados no banco). Backups ficam na aba Backups.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Infraestrutura (DNS e proxy)</CardTitle>
          <CardDescription>Usados pelo pipeline de deploy para DNS e roteamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(INFRA_FIELDS)}</CardContent>
      </Card>

      <PiholeServersCard
        servers={form.piholeServers ?? []}
        disabled={!isAdmin}
        onChange={(servers) => setField("piholeServers", servers)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GitLab</CardTitle>
          <CardDescription>Token geral: os projetos buscam metadados e repositórios pela API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(GITLAB_FIELDS)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bancos de origem para cópia</CardTitle>
          <CardDescription>
            Conexões padrão de produção e homologação. O QA só escolhe a origem; um projeto
            pode sobrescrever estas URLs no seu cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{renderFields(COPY_SOURCE_FIELDS)}</CardContent>
      </Card>

      {isAdmin ? (
        <Button onClick={onSave} disabled={update.isPending}>
          {update.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Somente administradores podem editar.</p>
      )}
    </div>
  );
}

function PiholeServersCard({
  servers,
  disabled,
  onChange,
}: {
  servers: PiholeServer[];
  disabled: boolean;
  onChange: (servers: PiholeServer[]) => void;
}) {
  function patch(i: number, p: Partial<PiholeServer>) {
    onChange(servers.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  }
  function add() {
    onChange([...servers, { baseUrl: "", password: "" }]);
  }
  function remove(i: number) {
    onChange(servers.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Servidores Pi-hole (DNS)</CardTitle>
        <CardDescription>
          Pi-hole v6 (autentica por senha). O registro de DNS é gravado em <strong>todos</strong> os
          servidores — útil quando há múltiplos DNS balanceados. URL base sem <code>/admin</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum servidor. Adicione ao menos um.</p>
        )}
        {servers.map((server, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>URL base #{i + 1}</Label>
              <Input
                disabled={disabled}
                value={server.baseUrl}
                placeholder="http://10.1.2.4"
                onChange={(e) => patch(i, { baseUrl: e.target.value })}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                disabled={disabled}
                value={server.password}
                onChange={(e) => patch(i, { password: e.target.value })}
              />
            </div>
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => remove(i)}>
              Remover
            </Button>
          </div>
        ))}
        {!disabled && (
          <Button variant="outline" size="sm" onClick={add}>
            + Adicionar servidor
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
