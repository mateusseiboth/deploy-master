import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export interface PiholeServer {
  baseUrl: string;
  password: string;
}

export interface SystemSettings {
  // Pi-hole v6 (senha, sem API token). `piholeServers` suporta vários DNS
  // balanceados; os campos singulares ficam por compatibilidade.
  piholeServers: PiholeServer[];
  piholeBaseUrl: string;
  piholePassword: string;
  reverseProxyIp: string;
  traefikNetwork: string;
  baseDomain: string;
  // GitLab global (token geral)
  gitlabBaseUrl: string;
  gitlabApiToken: string;
  // Conexões globais de origem para cópia de banco (produção/homologação)
  prodDbUrl: string;
  homologDbUrl: string;
  // Backup de produção (agendamento é por banco; aqui só conexão/pasta/chave)
  prodBackupDbUrl: string;
  prodBackupDir: string;
  prodBackupEnabled: boolean;
}

export type BackupFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

/** Uma execução de backup de UM banco. */
export interface ProductionBackupLog {
  id: string;
  databaseName: string;
  trigger: "AUTOMATIC" | "MANUAL";
  status: "RUNNING" | "SUCCESS" | "FAILED";
  filePath?: string | null;
  sizeBytes?: number | null;
  message?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

/** Banco do servidor configurado + seu agendamento (tela de Backups). */
export interface BackupDatabaseConfig {
  databaseName: string;
  enabled: boolean;
  frequency: BackupFrequency;
  hourOfDay: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  lastRunAt: string | null;
  present: boolean;
}

export interface BackupConfigInput {
  enabled: boolean;
  frequency: BackupFrequency;
  hourOfDay: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
}

const KEY = ["settings"];
const BACKUP_KEY = ["backups", "production"];
const CONFIG_KEY = ["backups", "config"];

export function useSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => unwrap<SystemSettings>(api.get("/settings")) });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SystemSettings>) => unwrap<SystemSettings>(api.put("/settings", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useProductionBackups() {
  return useQuery({
    queryKey: BACKUP_KEY,
    queryFn: () => unwrap<ProductionBackupLog[]>(api.get("/backups/production")),
    // Acelera o polling enquanto houver execução em andamento (feedback ao vivo).
    refetchInterval: (query) =>
      query.state.data?.some((log) => log.status === "RUNNING") ? 1500 : 10_000,
  });
}

/** Backups concluídos disponíveis para o QA escolher como origem do banco. */
export function useAvailableBackups(enabled = true) {
  return useQuery({
    queryKey: [...BACKUP_KEY, "available"],
    queryFn: () => unwrap<ProductionBackupLog[]>(api.get("/backups/available")),
    enabled,
  });
}

/** Bancos do servidor configurado com seu agendamento (tela de Backups). */
export function useBackupConfigs(enabled = true) {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => unwrap<BackupDatabaseConfig[]>(api.get("/backups/production/config")),
    enabled,
    retry: false,
  });
}

export function useUpsertBackupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ databaseName, input }: { databaseName: string; input: BackupConfigInput }) =>
      unwrap(api.put(`/backups/production/config/${encodeURIComponent(databaseName)}`, input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONFIG_KEY }),
  });
}

/** Dispara backup manual de TODOS os bancos habilitados. */
export function useTriggerProductionBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/backups/production"),
    onSuccess: () => qc.invalidateQueries({ queryKey: BACKUP_KEY }),
  });
}

/** Dispara backup manual de UM banco. */
export function useRunDatabaseBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (databaseName: string) =>
      api.post(`/backups/production/run/${encodeURIComponent(databaseName)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: BACKUP_KEY }),
  });
}
