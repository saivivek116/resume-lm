'use client';

import { cn } from "@/lib/utils";

interface GradientHoverProps {
  children: React.ReactNode;
  className?: string;
  from?: string;
  via?: string;
  to?: string;
  hoverFrom?: string;
  hoverVia?: string;
  hoverTo?: string;
}

export function GradientHover({
  children,
  className,
  from = "violet-600",
  via = "blue-600",
  to = "violet-600",
  hoverFrom = "blue-600",
  hoverVia = "violet-600",
  hoverTo = "blue-600",
}: GradientHoverProps) {
  return (
    <span
      className={cn(
        "text-violet-700 hover:text-indigo-700 transition-colors duration-700 cursor-pointer",
        className
      )}
    >
      {children}
    </span>
  );
} 