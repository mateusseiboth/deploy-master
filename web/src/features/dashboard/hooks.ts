import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { DashboardIndicators, QueueSnapshot } from "@/lib/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap<DashboardIndicators>(api.get("/dashboard")),
    refetchInterval: 10_000,
  });
}

/** Estado da fila de jobs (deploys, cleanups e backups) em tempo quase real. */
export function useQueue() {
  return useQuery({
    queryKey: ["queue"],
    queryFn: () => unwrap<QueueSnapshot>(api.get("/queue")),
    refetchInterval: 3000,
  });
}
