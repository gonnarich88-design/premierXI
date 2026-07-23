import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "gradient" | "outline" | "solid" | "ghost";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  gradient:
    "rounded-full bg-gradient-to-r from-primary to-primary-strong text-primary-foreground hover:brightness-110",
  outline: "rounded-full border border-primary text-primary hover:bg-primary/10",
  solid: "rounded-xl bg-primary text-primary-foreground hover:bg-primary-strong",
  ghost: "rounded-xl text-muted hover:text-foreground",
};

const SIZES: Record<Size, string> = {
  md: "px-4 py-2.5 text-sm",
  lg: "w-full py-3 text-base",
};

type Props = {
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

/** ปุ่มมาตรฐานตาม docs/design.md — variant "gradient"/"outline" คือ pill CTA จากรูปตัวอย่าง */
export default function Button({
  variant = "solid",
  size = "md",
  href,
  className = "",
  children,
  ...rest
}: Props) {
  const cls = `inline-flex items-center justify-center gap-2 font-bold transition disabled:opacity-60 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
