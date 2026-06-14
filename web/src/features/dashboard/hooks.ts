import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import type { DashboardIndicators } from "@/lib/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap<DashboardIndicators>(api.get("/dashboard")),
    refetchInterval: 10_000,
  });
}
