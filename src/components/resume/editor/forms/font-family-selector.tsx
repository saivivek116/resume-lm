'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  RESUME_FONT_OPTIONS,
  DEFAULT_RESUME_FONT,
  type ResumeFontFamily,
} from "@/lib/fonts/resume-fonts"

interface FontFamilySelectorProps {
  value?: ResumeFontFamily
  onValueChange: (value: ResumeFontFamily) => void
  className?: string
}

// Preview font stacks so each option renders in something close to its actual look.
const PREVIEW_FONT_STACK: Record<ResumeFontFamily, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  calibri: "Carlito, Calibri, 'Segoe UI', sans-serif",
  garamond: "'EB Garamond', Garamond, Georgia, serif",
}

const GROUP_ORDER: Array<'Sans-serif' | 'Serif'> = ['Sans-serif', 'Serif']

export function FontFamilySelector({ value, onValueChange, className }: FontFamilySelectorProps) {
  const current = value ?? DEFAULT_RESUME_FONT

  return (
    <Select value={current} onValueChange={(v) => onValueChange(v as ResumeFontFamily)}>
      <SelectTrigger
        className={cn(
          "bg-white/50 border-teal-600/40 hover:border-teal-600/60 focus:border-teal-600/40 transition-colors",
          className
        )}
      >
        <SelectValue placeholder="Select a font" />
      </SelectTrigger>
      <SelectContent className="min-w-[280px] max-w-[360px]">
        {GROUP_ORDER.map((category) => {
          const options = RESUME_FONT_OPTIONS.filter((o) => o.category === category)
          if (options.length === 0) return null
          return (
            <SelectGroup key={category}>
              <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                {category}
              </SelectLabel>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} className="hover:bg-teal-50">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className="font-medium truncate"
                      style={{ fontFamily: PREVIEW_FONT_STACK[option.value] }}
                    >
                      {option.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {option.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
