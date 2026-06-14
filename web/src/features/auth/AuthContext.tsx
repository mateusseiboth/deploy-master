import * as React from "react";
import { api, tokenStore, unwrap } from "@/lib/api";
import type { AuthUser, LoginResponse } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Restaura a sessão: se há access token, busca /auth/me.
  React.useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    unwrap<AuthUser>(api.get("/auth/me"))
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const data = await unwrap<LoginResponse>(api.post("/auth/login", { email, password }));
    tokenStore.set(data);
    setUser(data.user);
  }, []);

  const logout = React.useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
    tokenStore.clear();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
