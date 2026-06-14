import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary",
        secondary: "border-border bg-surface-2 text-muted-foreground",
        success: "border-ready/30 bg-ready/10 text-ready",
        warning: "border-amber/30 bg-amber/10 text-amber",
        destructive: "border-danger/30 bg-danger/10 text-danger",
        muted: "border-border bg-surface-2 text-faint",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
