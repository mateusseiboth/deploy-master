import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export interface SystemSettings {
  // Pi-hole v6 (senha, sem API token)
  piholeBaseUrl: string;
  piholePassword: string;
  reverseProxyIp: string;
  traefikNetwork: string;
  baseDomain: string;
  // GitLab global (token geral)
  gitlabBaseUrl: string;
  gitlabApiToken: string;
  // Backup automático de produção
  prodBackupDbUrl: string;
  prodBackupDir: string;
  prodBackupIntervalHours: number;
  prodBackupEnabled: boolean;
}

export interface ProductionBackupLog {
  id: string;
  trigger: "AUTOMATIC" | "MANUAL";
  status: "RUNNING" | "SUCCESS" | "FAILED";
  directory: string;
  databases?: { name: string; file: string; sizeBytes?: number; ok: boolean; error?: string }[] | null;
  totalBytes?: number | null;
  message?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

const KEY = ["settings"];
const BACKUP_KEY = ["backups", "production"];

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
    refetchInterval: 10_000,
  });
}

export function useTriggerProductionBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/backups/production"),
    onSuccess: () => qc.invalidateQueries({ queryKey: BACKUP_KEY }),
  });
}
