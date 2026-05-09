'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function ResumeSearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('search') ?? '')

  // Sync if URL param changes externally
  useEffect(() => {
    setValue(searchParams.get('search') ?? '')
  }, [searchParams])

  const pushSearch = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams)
      if (query) {
        params.set('search', query)
      } else {
        params.delete('search')
      }
      params.delete('page') // reset to page 1
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  // Debounce URL updates
  useEffect(() => {
    const timer = setTimeout(() => {
      pushSearch(value)
    }, 300)
    return () => clearTimeout(timer)
  }, [value, pushSearch])

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search resumes..."
        className="pl-9 pr-8 h-10 w-56 bg-white/60 border-purple-200/60 focus-visible:ring-purple-400/40"
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
