import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { LoginResponse } from "./types";

const ACCESS_KEY = "dm.accessToken";
const REFRESH_KEY = "dm.refreshToken";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: "/api" });

// Anexa o access token em toda request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Em 401, tenta rotacionar o refresh uma vez; se falhar, limpa a sessão.
let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const refreshToken = tokenStore.refresh;

    if (error.response?.status === 401 && refreshToken && original && !original._retried) {
      original._retried = true;
      try {
        refreshing ??= axios
          .post<{ data: LoginResponse }>("/api/auth/refresh", { refreshToken })
          .then((r) => {
            tokenStore.set(r.data.data);
            return r.data.data.accessToken;
          })
          .finally(() => {
            refreshing = null;
          });

        const newAccess = await refreshing;
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** Extrai a propriedade `data` das respostas `{ data }` da API. */
export async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  return (await promise).data.data;
}
