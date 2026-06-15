import * as React from "react";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api, unwrap } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useProjects, useProject, useBranches, useCommits } from "@/features/projects/hooks";
import { useCreateEnvironment } from "./hooks";

export function CreateEnvironmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { notify } = useToast();
  const create = useCreateEnvironment();

  const [projectId, setProjectId] = React.useState("");
  const [branch, setBranch] = React.useState("");
  const [commitHash, setCommitHash] = React.useState("");
  const [backupSource, setBackupSource] = React.useState<"UPLOAD" | "PRODUCTION_COPY">("UPLOAD");
  const [backupPath, setBackupPath] = React.useState<string>();
  const [overrides, setOverrides] = React.useState<Record<string, string>>({});
  const [uploading, setUploading] = React.useState(false);

  const projects = useProjects();
  const project = useProject(projectId);
  const branches = useBranches(projectId);
  const commits = useCommits(projectId, branch);
  const selectedCommit = commits.data?.find((c) => c.id === commitHash);

  function reset() {
    setProjectId(""); setBranch(""); setCommitHash("");
    setBackupSource("UPLOAD"); setBackupPath(undefined); setOverrides({});
  }

  async function onUpload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      // Sem setar Content-Type manualmente: o browser gera o boundary do
      // multipart (necessário para o multer parsear o arquivo no backend).
      const result = await unwrap<{ filePath: string }>(api.post("/backups", body));
      setBackupPath(result.filePath);
      notify("Backup enviado");
    } catch {
      notify("Falha no upload do backup", "error");
    } finally {
      setUploading(false);
    }
  }

  async function onDeploy() {
    try {
      await create.mutateAsync({
        projectId,
        branch,
        commitHash,
        commitAuthor: selectedCommit?.authorName,
        commitMessage: selectedCommit?.message,
        commitDate: selectedCommit?.createdAt,
        variableOverrides: overrides,
        backup: { source: backupSource, filePath: backupPath },
      });
      notify("Deploy enfileirado");
      reset();
      onOpenChange(false);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  }

  const canDeploy = projectId && branch && commitHash && (backupSource === "PRODUCTION_COPY" || backupPath);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Novo ambiente</DialogTitle>
        <DialogDescription>Projeto → branch → commit → backup → variáveis → deploy</DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-4 overflow-auto pr-1">
        <Field label="Projeto">
          <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); setBranch(""); setCommitHash(""); }}>
            <option value="">Selecione…</option>
            {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>

        {projectId && (
          <Field label="Branch">
            <Select value={branch} onChange={(e) => { setBranch(e.target.value); setCommitHash(""); }}>
              <option value="">{branches.isLoading ? "Carregando…" : "Selecione…"}</option>
              {branches.data?.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
            </Select>
          </Field>
        )}

        {branch && (
          <Field label="Commit">
            <Select value={commitHash} onChange={(e) => setCommitHash(e.target.value)}>
              <option value="">{commits.isLoading ? "Carregando…" : "Selecione…"}</option>
              {commits.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.shortId} — {c.message.split("\n")[0].slice(0, 50)}</option>
              ))}
            </Select>
          </Field>
        )}

        {selectedCommit && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p><span className="text-muted-foreground">Hash:</span> {selectedCommit.shortId}</p>
            <p><span className="text-muted-foreground">Autor:</span> {selectedCommit.authorName}</p>
            <p><span className="text-muted-foreground">Data:</span> {formatDate(selectedCommit.createdAt)}</p>
            <p><span className="text-muted-foreground">Mensagem:</span> {selectedCommit.message.split("\n")[0]}</p>
          </div>
        )}

        <Field label="Banco de dados">
          <Select value={backupSource} onChange={(e) => setBackupSource(e.target.value as typeof backupSource)}>
            <option value="UPLOAD">Enviar arquivo .sql / .sql.gz</option>
            <option value="PRODUCTION_COPY">Copiar banco de produção</option>
          </Select>
        </Field>

        {backupSource === "UPLOAD" && (
          <Field label="Arquivo de backup">
            <Input
              type="file"
              accept=".sql,.gz"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            />
            {backupPath && <p className="mt-1 text-xs text-emerald-400">Backup pronto.</p>}
          </Field>
        )}

        {project.data?.variables?.length ? (
          <div className="space-y-2">
            <Label>Variáveis sobrescrevíveis</Label>
            {project.data.variables.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <span className="w-1/3 truncate text-xs text-muted-foreground">{v.key}{v.required ? " *" : ""}</span>
                <Input
                  className="flex-1"
                  placeholder={v.defaultValue ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [v.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button disabled={!canDeploy || create.isPending} onClick={onDeploy}>
          {create.isPending ? "Enfileirando…" : "Acionar deploy"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function errorMessage(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e.response?.data?.message ?? "Falha ao criar ambiente";
}
