import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "error";
}

interface ToastContextValue {
  notify: (message: string, variant?: Toast["variant"]) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const notify = React.useCallback((message: string, variant: Toast["variant"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                "animate-fade-up rounded-md border border-border-strong bg-surface px-4 py-3 text-sm text-foreground shadow-[0_20px_40px_-20px_rgb(0_0_0/0.85)]",
                "border-l-2",
                t.variant === "success" ? "border-l-ready" : "border-l-danger",
              )}
            >
              <span className="mr-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                {t.variant === "success" ? "ok" : "erro"}
              </span>
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}
