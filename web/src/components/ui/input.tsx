import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-border-strong bg-surface-2 px-3 text-sm text-foreground shadow-sm transition-colors",
        "placeholder:text-faint hover:border-primary/50",
        "focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
