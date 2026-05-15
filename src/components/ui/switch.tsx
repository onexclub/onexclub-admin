"use client";

import * as SwitchPrimitives from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-orange-600 dark:bg-zinc-700 dark:data-[state=checked]:bg-orange-500",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 translate-x-1 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 dark:bg-zinc-950",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
