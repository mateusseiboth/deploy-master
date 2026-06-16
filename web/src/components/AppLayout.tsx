import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Boxes, FolderGit2, Archive, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";

const NAV = [
  { to: "/", label: "Dashboard", code: "00", icon: LayoutDashboard, end: true },
  { to: "/environments", label: "Ambientes", code: "01", icon: Boxes, end: false },
  { to: "/projects", label: "Projetos", code: "02", icon: FolderGit2, end: false },
  { to: "/backups", label: "Backups", code: "03", icon: Archive, end: false },
  { to: "/settings", label: "Configurações", code: "04", icon: Settings, end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-r border-border-strong bg-surface">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-primary/40 bg-primary/10 shadow-[0_0_24px_-6px_rgb(124_132_255/0.8)]">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_rgb(124_132_255)]" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">Deploy Master</p>
            <p className="eyebrow !text-[0.625rem] text-faint">Ephemeral Envs</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map(({ to, label, code, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "h-4 w-px rounded-full transition-colors",
                      isActive ? "bg-primary shadow-[0_0_8px_rgb(124_132_255)]" : "bg-transparent",
                    )}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 font-medium">{label}</span>
                  <span className="font-mono text-[0.625rem] text-faint">{code}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2.5 px-2 py-1">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surface-2 font-mono text-xs uppercase text-muted-foreground">
              {user?.name?.slice(0, 2) ?? "··"}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-faint">{user?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => logout().then(() => navigate("/login"))}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl animate-fade-up px-8 py-9">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
