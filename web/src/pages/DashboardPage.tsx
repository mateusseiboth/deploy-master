import { Boxes, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/features/dashboard/hooks";

const CARDS = [
  { key: "active", label: "Ativos", icon: Boxes, color: "text-emerald-400" },
  { key: "expiring", label: "Expirando", icon: AlertTriangle, color: "text-amber-400" },
  { key: "expired", label: "Expirados", icon: Clock, color: "text-amber-400" },
  { key: "failed", label: "Falhas", icon: XCircle, color: "text-destructive" },
] as const;

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Indicadores em tempo real</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "—" : (data?.[key] ?? 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deploys por projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.deploysByProject.length
              ? data.deploysByProject.map((row) => (
                  <div key={row.key} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{row.key}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                ))
              : <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Deploys por usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.deploysByUser.length
              ? data.deploysByUser.map((row) => (
                  <div key={row.key} className="flex justify-between text-sm">
                    <span className="truncate text-muted-foreground">{row.key}</span>
                    <span className="font-medium">{row.count}</span>
                  </div>
                ))
              : <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
