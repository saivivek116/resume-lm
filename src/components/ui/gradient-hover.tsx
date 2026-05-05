'use client';

import { cn } from "@/lib/utils";

interface GradientHoverProps {
  children: React.ReactNode;
  className?: string;
}

export function GradientHover({
  children,
  className,
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