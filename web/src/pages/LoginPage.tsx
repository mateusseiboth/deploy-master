import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Credenciais inválidas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-primary/40 bg-primary/10 shadow-[0_0_40px_-8px_rgb(124_132_255/0.9)]">
            <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_14px_rgb(124_132_255)]" />
          </span>
          <p className="eyebrow">Ephemeral Environments</p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Deploy Master</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Ambientes temporários de QA, sob controle.</p>
        </div>

        <div className="rounded-lg border border-border-strong bg-surface p-6 shadow-panel">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)} required placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"} {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faint">
          Acesso restrito · QA / Admin
        </p>
      </div>
    </div>
  );
}
