import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export interface SystemSettings {
  piholeBaseUrl: string;
  piholeApiToken: string;
  reverseProxyIp: string;
  traefikNetwork: string;
  baseDomain: string;
}

const KEY = ["settings"];

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
