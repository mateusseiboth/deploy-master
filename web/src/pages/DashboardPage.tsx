import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {StatCard} from "@/features/dashboard/components";
import {useDashboard, useQueue} from "@/features/dashboard/hooks";
import {CreateEnvironmentDialog} from "@/features/environments/CreateEnvironmentDialog";
import {StatusBadge} from "@/features/environments/StatusBadge";
import {useEnvironments} from "@/features/environments/hooks";
import type {Environment, EnvironmentStatus, QueueJob, QueueJobType} from "@/lib/types";
import {daysUntil, formatDate} from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Hammer,
  Link2,
  ListChecks,
  Loader2,
  Plus,
  RotateCw,
  Search,
  ShieldCheck,
  Timer,
  Trash2,
} from "lucide-react";
import * as React from "react";

/** Vida restante 0..1 a partir de createdAt/expiresAt (para o anel do Status Core). */
export function lifeRatio(env: Environment): number | null {
  if (!env.expiresAt) return null;
  const end = new Date(env.expiresAt).getTime();
  const start = new Date(env.createdAt).getTime();
  if (end <= start) return 0;
  return (end - Date.now()) / (end - start);
}

export function DashboardPage() {
  const {data: indicators} = useDashboard();
  const {data: environments, isLoading, refetch, isFetching} = useEnvironments();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | EnvironmentStatus>("all");

  const total = environments?.length ?? 0;
  const ready = indicators?.active ?? 0;
  const filtered = (environments ?? []).filter((e) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !q ||
      e.commitHash.toLowerCase().includes(q) ||
      e.branch.toLowerCase().includes(q) ||
      (e.commitAuthor ?? "").toLowerCase().includes(q) ||
      (e.commitMessage ?? "").toLowerCase().includes(q);
    return matchesQuery && (status === "all" || e.status === status);
  });

  return (
    <div className="space-y-7">
      {/* Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Painel · Ambientes Efêmeros</p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight">Ambientes de QA</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visualize, acesse e gerencie os containers de cada commit para testes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Novo ambiente
          </Button>
        </div>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ambientes ativos"
          value={ready}
          icon={Boxes}
          accent="iris"
          seed={1}
          sub={<span className="text-amber">{indicators?.expiring ?? 0} expirando em breve</span>}
        />
        <StatCard
          label="Prontos / saudáveis"
          value={ready}
          icon={CheckCircle2}
          accent="green"
          seed={4}
          sub={`${ready} de ${total} em operação`}
        />
        <StatCard
          label="Total de ambientes"
          value={total}
          icon={Clock}
          accent="blue"
          seed={9}
          sub="Provisionados no período"
        />
        <StatCard
          label="Falhas"
          value={indicators?.failed ?? 0}
          icon={AlertTriangle}
          accent="amber"
          seed={2}
          sub={(indicators?.failed ?? 0) > 0 ? "Verifique os logs" : "Nenhuma falha"}
        />
      </div>

      {/* Painel: ambientes recentes */}
      <section className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold tracking-tight">Ambientes recentes</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                className="h-9 w-64 pl-9"
                placeholder="Buscar por commit, branch ou autor…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              className="h-9 w-44"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">Todos os status</option>
              <option value="READY">Prontos</option>
              <option value="PROVISIONING">Provisionando</option>
              <option value="EXPIRING">Expirando</option>
              <option value="FAILED">Com falha</option>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Commit</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Criador</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  Nenhum ambiente ainda. Crie o primeiro em <span className="text-primary">Novo ambiente</span>.
                </TableCell>
              </TableRow>
            )}
            {filtered.slice(0, 8).map((env) => {
              const remaining = daysUntil(env.expiresAt);
              return (
                <TableRow key={env.id}>
                  <TableCell>
                    <span className="hash-chip">{env.commitHash.slice(0, 7)}</span>
                    <p className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground">
                      {env.commitMessage?.split("\n")[0] ?? env.name}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {env.branch}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={env.status}
                      ratio={lifeRatio(env)}
                    />
                  </TableCell>
                  <TableCell>
                    {env.url && env.status === "READY" ? (
                      <a
                        href={env.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        {env.hostname} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-faint">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{env.creator?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs">
                      {remaining !== null && remaining <= 2 && <AlertTriangle className="h-3.5 w-3.5 text-amber" />}
                      <span className={remaining !== null && remaining <= 2 ? "text-amber" : "text-muted-foreground"}>
                        {remaining === null ? "—" : remaining < 0 ? "vencido" : `em ${remaining}d`}
                      </span>
                    </div>
                    <span className="font-mono text-[0.625rem] text-faint">{formatDate(env.expiresAt)}</span>
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {/* Fila de operações */}
      <QueueCard />

      {/* Tiles informativos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={Link2}
          accent="text-primary"
          title="Acesse o ambiente"
          text="Clique na URL para abrir em uma nova aba e testar."
        />
        <InfoTile
          icon={ShieldCheck}
          accent="text-ready"
          title="Ambientes isolados"
          text="Cada commit tem seu container e banco próprios."
        />
        <InfoTile
          icon={Timer}
          accent="text-amber"
          title="Expiração automática"
          text="Recursos são removidos ao fim do prazo, sem órfãos."
        />
        <InfoTile
          icon={BookOpen}
          accent="text-sky-300"
          title="Precisa de ajuda?"
          text="Consulte a documentação ou fale com a plataforma."
        />
      </div>

      <CreateEnvironmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}

const JOB_META: Record<QueueJobType, {label: string; icon: typeof Hammer}> = {
  deploy: {label: "Deploy", icon: Hammer},
  cleanup: {label: "Remoção", icon: Trash2},
  backup: {label: "Backup", icon: Database},
};

const JOB_STATUS_META: Record<string, {label: string; cls: string}> = {
  active: {label: "Executando", cls: "text-primary"},
  pending: {label: "Na fila", cls: "text-amber"},
  failed: {label: "Falhou", cls: "text-destructive"},
  completed: {label: "Concluído", cls: "text-ready"},
};

/** Painel da fila de operações: deploys, remoções e backups em andamento. */
function QueueCard() {
  const {data} = useQueue();
  const jobs = data?.jobs ?? [];
  // Ativos/na fila primeiro; depois os finalizados recentes (concluídos e com
  // erro) — backups por banco terminam rápido e some­riam se só mostrássemos os
  // vivos. A lista já vem ordenada por atualização (mais recentes primeiro).
  const live = jobs.filter((j) => j.status === "active" || j.status === "pending");
  const finished = jobs.filter((j) => j.status === "completed" || j.status === "failed").slice(0, 8);
  const active = data?.stats?.active ?? 0;
  const pending = data?.stats?.pending ?? 0;

  return (
    <section className="overflow-hidden rounded-lg border border-border-strong bg-surface shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-tight">Fila de operações</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {active} executando · {pending} na fila
        </span>
      </div>
      {data && data.workerOnline === false && (
        <div className="flex items-center gap-2 border-b border-border bg-destructive/10 px-5 py-2.5 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Worker offline — deploys, remoções e backups não estão sendo processados.</span>
        </div>
      )}
      <div className="divide-y divide-border">
        {live.length === 0 && finished.length === 0 && (
          <p className="p-5 text-center text-sm text-muted-foreground">Nenhuma operação na fila.</p>
        )}
        {[...live, ...finished].map((job) => <QueueRow key={job.id} job={job} />)}
      </div>
    </section>
  );
}

function QueueRow({job}: {job: QueueJob}) {
  const meta = JOB_META[job.type] ?? {label: job.type, icon: ListChecks};
  const status = JOB_STATUS_META[job.status] ?? {label: job.status, cls: "text-muted-foreground"};
  const Icon = meta.icon;
  const target =
    job.type === "backup"
      ? [job.payload?.databaseName, job.payload?.trigger === "AUTOMATIC" ? "automático" : "solicitado"]
          .filter(Boolean)
          .join(" · ")
      : job.payload?.environmentId
        ? `env ${job.payload.environmentId.slice(0, 8)}`
        : "—";

  return (
    <div className="flex items-center justify-between gap-3 p-4 text-sm">
      <div className="flex items-center gap-3">
        {job.status === "active" ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">{meta.label} <span className="text-xs text-muted-foreground">· {target}</span></p>
          {job.lastError && <p className="max-w-[28rem] truncate text-xs text-destructive">{job.lastError}</p>}
        </div>
      </div>
      <div className="text-right">
        <span className={`text-xs font-medium ${status.cls}`}>{status.label}</span>
        {job.attempts > 1 && <p className="text-[0.625rem] text-faint">tentativa {job.attempts}/{job.maxAttempts}</p>}
      </div>
    </div>
  );
}

function InfoTile({icon: Icon, accent, title, text}: {icon: typeof Link2; accent: string; title: string; text: string}) {
  return (
    <div className="rounded-lg border border-border-strong bg-surface p-4">
      <Icon className={`h-5 w-5 ${accent}`} />
      <p className="mt-2.5 text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
