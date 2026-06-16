import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/features/auth/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EnvironmentsPage } from "@/pages/EnvironmentsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { BackupsPage } from "@/pages/BackupsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import type { JSX } from "react";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/environments" element={<EnvironmentsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/backups" element={<BackupsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
