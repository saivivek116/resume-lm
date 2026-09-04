'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResumeSearchInputProps {
  /** URL param this input owns, so several inputs can coexist on one page. */
  searchParam?: string
  /** Page param reset to 1 whenever the query changes. */
  pageParam?: string
  className?: string
}

export function ResumeSearchInput({
  searchParam = 'search',
  pageParam = 'page',
  className,
}: ResumeSearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.get(searchParam) ?? ''

  const [value, setValue] = useState(currentQuery)
  // The last query this input put into the URL. Navigations that land on it are our own
  // echo, so adopting them would overwrite whatever the user has typed since.
  const lastPushed = useRef(currentQuery)

  // Adopt only the URL changes we did not cause: back/forward, or an external link.
  useEffect(() => {
    if (currentQuery === lastPushed.current) return
    lastPushed.current = currentQuery
    setValue(currentQuery)
  }, [currentQuery])

  // Debounce URL updates
  useEffect(() => {
    // Nothing to push. Without this the timer also fires on mount and after every
    // navigation (searchParams changes identity), clearing the page param each time.
    if (value === currentQuery) return

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (value) {
        params.set(searchParam, value)
      } else {
        params.delete(searchParam)
      }
      params.delete(pageParam) // reset to page 1
      lastPushed.current = value
      // replace, not push: typing a query would otherwise leave one history entry per
      // debounce, so leaving the search takes as many Back presses as characters typed.
      router.replace(`?${params.toString()}`, { scroll: false })
    }, 300)

    return () => clearTimeout(timer)
  }, [value, currentQuery, searchParams, searchParam, pageParam, router])

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search resumes..."
        className={cn(
          'pl-9 pr-8 h-10 w-56 bg-white/60 border-purple-200/60 focus-visible:ring-purple-400/40',
          className
        )}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setValue('')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
