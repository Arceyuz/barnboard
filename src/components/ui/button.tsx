import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 text-sm font-medium transition-opacity duration-[var(--motion-quick,150ms)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg rounded-md hover:opacity-90",
        secondary:
          "bg-surface-2 text-fg rounded-md border border-border hover:border-border-strong",
        ghost: "text-muted rounded-md hover:text-fg hover:bg-surface-2",
        danger: "bg-danger text-danger-fg rounded-md hover:opacity-90",
      },
      size: {
        md: "min-h-11 px-4",
        sm: "min-h-10 px-3 text-sm",
        pill: "min-h-9 px-3 rounded-full text-xs tracking-wide uppercase",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
