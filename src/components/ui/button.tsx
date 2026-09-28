import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Button.
 *
 * A real `<button>` by default, rendering as an `<a>` when `href` is supplied,
 * so links stay navigable (middle-click, open-in-new-tab, keyboard) while still
 * sharing the visual language. The styles live here rather than in
 * `@apply` so Tailwind v4 can see the class names.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "accent"
  | "link";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-paper hover:border-brand-300",
  ghost: "text-ink-soft hover:text-ink hover:bg-ink/5",
  danger: "bg-danger-500 text-white hover:bg-danger-700",
  accent: "bg-accent-600 text-white hover:bg-accent-700",
  link: "text-brand-700 underline underline-offset-4 hover:text-brand-800 px-0",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-sm",
  xl: "h-14 px-9 text-base",
};

const buttonClasses = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  full: boolean,
  className?: string,
) => cn(base, variants[variant], sizes[size], full && "w-full", className);

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant,
  size,
  full = false,
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClasses(variant, size, full, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  full = false,
  className,
  children,
  ...rest
}: CommonProps & React.ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses(variant, size, full, className)} {...rest}>
      {children}
    </Link>
  );
}
