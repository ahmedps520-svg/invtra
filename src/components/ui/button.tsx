import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "subtle" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ivory hover:bg-bronze-800 shadow-soft",
  accent: "bg-bronze-600 text-white hover:bg-bronze-700 shadow-soft",
  outline: "border border-line-strong bg-paper/60 text-ink hover:border-bronze-400 hover:bg-paper",
  ghost: "text-ink-soft hover:text-ink hover:bg-sand",
  subtle: "bg-sand text-ink hover:bg-mist",
  danger: "bg-rosewood text-white hover:bg-[#8a4334]",
  link: "text-bronze-700 underline-offset-4 hover:underline px-0! h-auto!",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-full",
  md: "h-10 px-5 text-sm gap-2 rounded-full",
  lg: "h-12 px-7 text-[15px] gap-2.5 rounded-full",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap font-medium tracking-wide transition-all duration-300 ease-luxe",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    variants[variant],
    sizes[size],
    className,
  );
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
});
