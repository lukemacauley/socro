import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-blue-950 focus-visible:ring-blue-950/50 focus-visible:ring-[3px] aria-invalid:ring-blue-500/20 dark:aria-invalid:ring-blue-500/40 aria-invalid:border-blue-500 dark:focus-visible:border-blue-300 dark:focus-visible:ring-blue-300/50 dark:aria-invalid:ring-blue-800/20 dark:dark:aria-invalid:ring-blue-800/40 dark:aria-invalid:border-blue-800",
  {
    variants: {
      variant: {
        default:
          "bg-blue-800 text-blue-50 shadow-xs hover:bg-blue-800/90 dark:bg-blue-50 dark:text-blue-800 dark:hover:bg-blue-50/90",
        destructive:
          "bg-blue-500 text-white shadow-xs hover:bg-blue-500/90 focus-visible:ring-blue-500/20 dark:focus-visible:ring-blue-500/40 dark:bg-blue-500/60 dark:bg-blue-800 dark:hover:bg-blue-800/90 dark:focus-visible:ring-blue-800/20 dark:dark:focus-visible:ring-blue-800/40 dark:dark:bg-blue-800/60",
        outline:
          "border bg-white shadow-xs hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-200/30 dark:border-blue-200 dark:hover:bg-blue-200/50 dark:bg-blue-950 dark:hover:bg-blue-800 dark:hover:text-blue-50 dark:dark:bg-blue-800/30 dark:dark:border-blue-800 dark:dark:hover:bg-blue-800/50",
        secondary:
          "bg-blue-100 text-blue-800 shadow-xs hover:bg-blue-100/80 dark:bg-blue-800 dark:text-blue-50 dark:hover:bg-blue-800/80",
        ghost:
          "hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-100/50 dark:hover:bg-blue-800 dark:hover:text-blue-50 dark:dark:hover:bg-blue-800/50",
        link: "text-blue-800 underline-offset-4 hover:underline dark:text-blue-50",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
