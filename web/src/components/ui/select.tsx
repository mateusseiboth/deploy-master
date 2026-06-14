import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Select nativo, estilizado: aparência removida + chevron próprio (SVG embutido).
 * `color-scheme: dark` (global) faz o popup nativo renderizar escuro.
 */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-border-strong bg-surface-2 pl-3 pr-9 text-sm text-foreground",
          "shadow-sm transition-colors hover:border-primary/50",
          "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";
