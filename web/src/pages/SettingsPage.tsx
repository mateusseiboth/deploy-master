import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/AuthContext";
import { useSettings, useUpdateSettings, type SystemSettings } from "@/features/settings/hooks";

const FIELDS: { key: keyof SystemSettings; label: string; hint?: string; secret?: boolean }[] = [
  { key: "piholeBaseUrl", label: "Pi-hole — URL base", hint: "ex.: http://10.10.10.2/admin" },
  { key: "piholeApiToken", label: "Pi-hole — API token", secret: true },
  { key: "reverseProxyIp", label: "IP do proxy reverso", hint: "para onde os hostnames apontam" },
  { key: "traefikNetwork", label: "Rede do Traefik" },
  { key: "baseDomain", label: "Domínio base", hint: "ex.: qa.local" },
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

  async function onSave() {
    try {
      await update.mutateAsync(form);
      notify("Configurações salvas");
    } catch {
      notify("Falha ao salvar (apenas ADMIN)", "error");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Configurações</h2>
        <p className="text-sm text-muted-foreground">Endereços de Pi-hole e proxy reverso (cadastrados no banco)</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Infraestrutura</CardTitle>
          <CardDescription>Usados pelo pipeline de deploy para DNS e roteamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input
                type={f.secret ? "password" : "text"}
                disabled={!isAdmin}
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
          {isAdmin ? (
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Somente administradores podem editar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
