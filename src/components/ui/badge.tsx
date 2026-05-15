import type * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100",
        success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
        warning: "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
        danger: "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100",
        outline: "border border-zinc-200 bg-transparent dark:border-zinc-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
