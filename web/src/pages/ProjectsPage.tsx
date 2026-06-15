import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useGitlabProjects,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@/features/projects/hooks";
import type { Project } from "@/lib/types";

export function ProjectsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useProjects();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projetos</h2>
          <p className="text-sm text-muted-foreground">Configuração de deploy (admin)</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo projeto
          </Button>
        )}
      </header>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Repositório</TableHead>
              <TableHead>Estratégia de banco</TableHead>
              <TableHead>Domínio</TableHead>
              {isAdmin && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{p.repositoryUrl}</TableCell>
                <TableCell className="text-xs">{p.databaseStrategy}</TableCell>
                <TableCell className="text-xs">{p.baseDomain}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {isAdmin && <CreateProjectDialog open={open} onOpenChange={setOpen} />}
      {isAdmin && editing && (
        <EditProjectDialog project={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { notify } = useToast();
  const create = useCreateProject();
  const gitlab = useGitlabProjects(open);
  const [form, setForm] = React.useState<CreateProjectInput>({
    name: "", gitlabProjectId: "", repositoryUrl: "", gitlabToken: "",
    databaseStrategy: "UPLOAD_SQL", baseDomain: "qa.local",
    requiresDatabase: true, databaseEnvVar: "DATABASE_URL", databaseUrlTemplate: "",
    deadline: { defaultDays: 7, maxDays: 30, maxRenewals: 5 },
  });
  const [variables, setVariables] = React.useState<{ key: string; required: boolean }[]>([]);

  function set<K extends keyof CreateProjectInput>(key: K, value: CreateProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Ao escolher um projeto do catálogo do GitLab, preenche id/URL/nome.
  function onPickGitlab(id: string) {
    const picked = gitlab.data?.find((p) => String(p.id) === id);
    if (!picked) return;
    setForm((f) => ({
      ...f,
      gitlabProjectId: String(picked.id),
      repositoryUrl: picked.httpUrlToRepo,
      name: f.name || picked.name,
    }));
  }

  async function onSubmit() {
    try {
      await create.mutateAsync({ ...form, variables });
      notify("Projeto criado");
      onOpenChange(false);
    } catch {
      notify("Falha ao criar projeto", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo projeto</DialogTitle>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
        <FormRow label="Projeto GitLab (via API)">
          <Select
            value={form.gitlabProjectId}
            onChange={(e) => onPickGitlab(e.target.value)}
            disabled={gitlab.isLoading || !!gitlab.error}
          >
            <option value="">
              {gitlab.isLoading
                ? "Carregando do GitLab…"
                : gitlab.error
                  ? "Configure o GitLab em Configurações"
                  : "Selecione um projeto…"}
            </option>
            {gitlab.data?.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.pathWithNamespace}</option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            Buscado com o token geral. A URL e o ID são preenchidos automaticamente.
          </p>
        </FormRow>
        <FormRow label="Nome"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></FormRow>
        <FormRow label="ID do projeto GitLab">
          <Input value={form.gitlabProjectId} onChange={(e) => set("gitlabProjectId", e.target.value)} placeholder="grupo/projeto ou número" />
        </FormRow>
        <FormRow label="URL do repositório (opcional)">
          <Input value={form.repositoryUrl} onChange={(e) => set("repositoryUrl", e.target.value)} placeholder="auto pelo GitLab; ou https://gitlab…/repo.git" />
        </FormRow>
        <FormRow label="Token GitLab (opcional — usa o token geral)">
          <Input type="password" value={form.gitlabToken} onChange={(e) => set("gitlabToken", e.target.value)} />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Estratégia de banco">
            <Select value={form.databaseStrategy} onChange={(e) => set("databaseStrategy", e.target.value as CreateProjectInput["databaseStrategy"])}>
              <option value="UPLOAD_SQL">Upload .sql</option>
              <option value="COPY_PRODUCTION">Copiar produção</option>
            </Select>
          </FormRow>
          <FormRow label="Domínio base">
            <Input value={form.baseDomain} onChange={(e) => set("baseDomain", e.target.value)} />
          </FormRow>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.requiresDatabase ?? true}
              onChange={(e) => set("requiresDatabase", e.target.checked)}
            />
            Este projeto depende de banco de dados
          </label>
          {form.requiresDatabase && (
            <>
              <FormRow label="Variável de ambiente do banco">
                <Input
                  value={form.databaseEnvVar ?? "DATABASE_URL"}
                  onChange={(e) => set("databaseEnvVar", e.target.value)}
                  placeholder="DATABASE_URL"
                />
              </FormRow>
              <FormRow label="Template da URL (opcional)">
                <Input
                  value={form.databaseUrlTemplate ?? ""}
                  onChange={(e) => set("databaseUrlTemplate", e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/db?schema=public"
                />
                <p className="text-xs text-muted-foreground">
                  A URL do banco efêmero é gerada automaticamente; do template só a query
                  (ex.: <code>?schema=public</code>) é preservada — usuário, senha, IP, porta e
                  banco são substituídos.
                </p>
              </FormRow>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Prazo padrão (d)">
            <Input type="number" value={form.deadline?.defaultDays}
              onChange={(e) => set("deadline", { ...form.deadline, defaultDays: Number(e.target.value) })} />
          </FormRow>
          <FormRow label="Prazo máx (d)">
            <Input type="number" value={form.deadline?.maxDays}
              onChange={(e) => set("deadline", { ...form.deadline, maxDays: Number(e.target.value) })} />
          </FormRow>
          <FormRow label="Máx renovações">
            <Input type="number" value={form.deadline?.maxRenewals}
              onChange={(e) => set("deadline", { ...form.deadline, maxRenewals: Number(e.target.value) })} />
          </FormRow>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Variáveis sobrescrevíveis</Label>
            <Button variant="outline" size="sm" onClick={() => setVariables((v) => [...v, { key: "", required: false }])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {variables.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="API_URL"
                value={v.key}
                onChange={(e) => setVariables((arr) => arr.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={v.required}
                  onChange={(e) => setVariables((arr) => arr.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />
                obrig.
              </label>
              <Button variant="ghost" size="icon" onClick={() => setVariables((arr) => arr.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button disabled={create.isPending || !form.name || !form.gitlabProjectId} onClick={onSubmit}>
          {create.isPending ? "Criando…" : "Criar projeto"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function EditProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const { notify } = useToast();
  const update = useUpdateProject(project.id);
  const [form, setForm] = React.useState<UpdateProjectInput>({
    name: project.name,
    repositoryUrl: project.repositoryUrl ?? "",
    gitlabToken: project.gitlabToken ?? "",
    dockerfilePath: project.dockerfilePath ?? "",
    databaseStrategy: project.databaseStrategy,
    baseDomain: project.baseDomain,
    requiresDatabase: project.requiresDatabase ?? true,
    databaseEnvVar: project.databaseEnvVar ?? "DATABASE_URL",
    databaseUrlTemplate: project.databaseUrlTemplate ?? "",
    enabled: project.enabled ?? true,
    deadline: project.deadline
      ? {
          defaultDays: project.deadline.defaultDays,
          maxDays: project.deadline.maxDays,
          maxRenewals: project.deadline.maxRenewals,
        }
      : undefined,
  });

  function set<K extends keyof UpdateProjectInput>(key: K, value: UpdateProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit() {
    try {
      await update.mutateAsync(form);
      notify("Projeto atualizado");
      onClose();
    } catch {
      notify("Falha ao atualizar projeto", "error");
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogHeader>
        <DialogTitle>Editar projeto — {project.name}</DialogTitle>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-3 overflow-auto pr-1">
        <FormRow label="Nome"><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></FormRow>
        <FormRow label="URL do repositório">
          <Input value={form.repositoryUrl ?? ""} onChange={(e) => set("repositoryUrl", e.target.value)} />
        </FormRow>
        <FormRow label="Token GitLab (opcional — usa o token geral)">
          <Input type="password" value={form.gitlabToken ?? ""} onChange={(e) => set("gitlabToken", e.target.value)} placeholder="inalterado se vazio" />
        </FormRow>
        <FormRow label="Dockerfile">
          <Input value={form.dockerfilePath ?? ""} onChange={(e) => set("dockerfilePath", e.target.value)} placeholder="Dockerfile" />
        </FormRow>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Estratégia de banco">
            <Select value={form.databaseStrategy} onChange={(e) => set("databaseStrategy", e.target.value as CreateProjectInput["databaseStrategy"])}>
              <option value="UPLOAD_SQL">Upload .sql</option>
              <option value="COPY_PRODUCTION">Copiar produção</option>
            </Select>
          </FormRow>
          <FormRow label="Domínio base">
            <Input value={form.baseDomain ?? ""} onChange={(e) => set("baseDomain", e.target.value)} />
          </FormRow>
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.requiresDatabase ?? true} onChange={(e) => set("requiresDatabase", e.target.checked)} />
            Este projeto depende de banco de dados
          </label>
          {form.requiresDatabase && (
            <>
              <FormRow label="Variável de ambiente do banco">
                <Input value={form.databaseEnvVar ?? "DATABASE_URL"} onChange={(e) => set("databaseEnvVar", e.target.value)} placeholder="DATABASE_URL" />
              </FormRow>
              <FormRow label="Template da URL (opcional)">
                <Input value={form.databaseUrlTemplate ?? ""} onChange={(e) => set("databaseUrlTemplate", e.target.value)} placeholder="postgresql://user:pass@host:5432/db?schema=public" />
                <p className="text-xs text-muted-foreground">
                  A URL do banco efêmero é gerada automaticamente; do template só a query
                  (ex.: <code>?schema=public</code>) é preservada — usuário, senha, IP, porta e
                  banco são substituídos.
                </p>
              </FormRow>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Prazo padrão (d)">
            <Input type="number" value={form.deadline?.defaultDays ?? ""}
              onChange={(e) => set("deadline", { ...form.deadline, defaultDays: Number(e.target.value) })} />
          </FormRow>
          <FormRow label="Prazo máx (d)">
            <Input type="number" value={form.deadline?.maxDays ?? ""}
              onChange={(e) => set("deadline", { ...form.deadline, maxDays: Number(e.target.value) })} />
          </FormRow>
          <FormRow label="Máx renovações">
            <Input type="number" value={form.deadline?.maxRenewals ?? ""}
              onChange={(e) => set("deadline", { ...form.deadline, maxRenewals: Number(e.target.value) })} />
          </FormRow>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.enabled ?? true} onChange={(e) => set("enabled", e.target.checked)} />
          Projeto habilitado
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={update.isPending || !form.name} onClick={onSubmit}>
          {update.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
