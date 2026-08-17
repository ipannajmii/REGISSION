import React from "react";
import Link from "next/link";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  asChild?: boolean;
  href?: string; // allow Button as link
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  asChild,
  href,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition";
  const styles =
    variant === "primary"
      ? "bg-orange-500 text-neutral-950 hover:opacity-90"
      : "border border-neutral-800 bg-neutral-950/40 text-neutral-100 hover:bg-neutral-900";

  const cn = `${base} ${styles} ${className}`;

  // If you pass href, render a real Link
  if (href) {
    return (
      <Link href={href} className={cn}>
        {children}
      </Link>
    );
  }

  // If user wraps Link inside Button asChild, render a span wrapper (still ok)
  if (asChild) {
    return <span className={cn}>{children}</span>;
  }

  return (
    <button className={cn} {...props}>
      {children}
    </button>
  );
}