import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_0_0_rgb(255_255_255/0.2)_inset,0_6px_18px_-8px_rgb(124_132_255/0.7)] hover:shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_8px_24px_-6px_rgb(124_132_255/0.85)] hover:brightness-110",
        destructive: "bg-destructive/90 text-foreground hover:bg-destructive",
        outline:
          "border border-border-strong bg-surface-2/40 text-foreground hover:border-primary/50 hover:bg-surface-2",
        secondary: "bg-surface-2 text-foreground hover:bg-surface-2/70",
        ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
