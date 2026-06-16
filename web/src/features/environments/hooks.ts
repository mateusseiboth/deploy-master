import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { Environment } from "@/lib/types";

export type BackupSource = "UPLOAD" | "STORED_BACKUP" | "PRODUCTION_COPY" | "HOMOLOGATION_COPY";

export interface CreateEnvironmentInput {
  projectId: string;
  branch: string;
  commitHash: string;
  commitAuthor?: string;
  commitMessage?: string;
  commitDate?: string;
  variableOverrides?: Record<string, string>;
  backup: { source: BackupSource; filePath?: string };
  dockerfilePath?: string;
}

const KEY = ["environments"];

export function useEnvironments(refetchMs = 5000) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => unwrap<Environment[]>(api.get("/environments")),
    refetchInterval: refetchMs, // listagem "em tempo real"
  });
}

export function useEnvironment(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => unwrap<Environment>(api.get(`/environments/${id}`)),
    enabled: !!id,
  });
}

export function useCreateEnvironment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEnvironmentInput) => unwrap<Environment>(api.post("/environments", input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEnvironmentAction() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  return {
    renew: useMutation({
      mutationFn: ({ id, days }: { id: string; days: number }) =>
        api.post(`/environments/${id}/renew`, { days }),
      onSuccess: invalidate,
    }),
    restart: useMutation({
      mutationFn: (id: string) => api.post(`/environments/${id}/restart`),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.delete(`/environments/${id}`),
      onSuccess: invalidate,
    }),
  };
}
