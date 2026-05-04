'use client'

import React, { useState } from "react"
import Image from "next/image"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  getModelById,
  getProviderById,
  isModelAvailable,
  groupModelsByProvider,
  type AIModel,
} from '@/lib/ai-models'
import type { ServiceName } from '@/lib/types'

interface ModelSelectorProps {
  value: string
  onValueChange: (value: string) => void
  availableProviders: ServiceName[]
  className?: string
  placeholder?: string
  showToast?: boolean
}

// Helper component for unavailable model popover
function UnavailableModelPopover({ children, model }: { children: React.ReactNode; model: AIModel }) {
  const [open, setOpen] = useState(false)
  const provider = getProviderById(model.provider)
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="w-full"
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 z-50"
        side="right"
        align="start"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">API Key Required</p>
          <p className="text-xs text-muted-foreground">
            Add your {provider?.name ?? 'provider'} API key in Profile settings to use this model.
          </p>
          <a
            href="/profile"
            className="flex items-center gap-2 text-xs text-teal-600 hover:underline"
          >
            Go to Profile → API Keys
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ModelSelector({
  value,
  onValueChange,
  availableProviders,
  className,
  placeholder = "Select an AI model",
  showToast = true
}: ModelSelectorProps) {

  const isModelSelectable = (modelId: string) => {
    return isModelAvailable(modelId, availableProviders)
  }

  const handleModelChange = (modelId: string) => {
    const selectedModel = getModelById(modelId)
    if (!selectedModel) return

    // Check if model is available for the user
    if (!isModelAvailable(modelId, availableProviders)) {
      if (showToast) {
        const provider = getProviderById(selectedModel.provider)
        toast.error(`Please add your ${provider?.name || selectedModel.provider} API key first`)
      }
      return
    }

    onValueChange(modelId)
    if (showToast) {
      toast.success('Model updated successfully')
    }
  }

  // Use the centralized grouping function
  const getModelsByProvider = () => groupModelsByProvider()

  return (
    <Select value={value} onValueChange={handleModelChange}>
      <SelectTrigger className={cn(
        "bg-white/50 border-purple-600/60 hover:border-purple-600/80 focus:border-purple-600/40 transition-colors",
        className
      )}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="min-w-[300px] max-w-[400px]">
        {getModelsByProvider().map((group, groupIndex) => (
          <div key={group.provider}>
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                <div className="flex items-center gap-2">
                  {getProviderById(group.provider)?.logo && (
                    <Image
                      src={getProviderById(group.provider)!.logo!}
                      alt={`${group.name} logo`}
                      width={14}
                      height={14}
                      className="rounded-sm"
                    />
                  )}
                  {group.name}
                </div>
              </SelectLabel>
              {group.models.map((model) => {
                const provider = getProviderById(model.provider)
                const isSelectable = isModelSelectable(model.id)
                
                const selectItem = (
                  <SelectItem 
                    key={model.id} 
                    value={model.id}
                    disabled={!isSelectable}
                    className={cn(
                      "transition-colors",
                      !isSelectable ? 'opacity-50' : 'hover:bg-purple-50'
                    )}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {provider?.logo && (
                        <Image
                          src={provider.logo}
                          alt={`${provider.name} logo`}
                          width={16}
                          height={16}
                          className="rounded-sm flex-shrink-0"
                        />
                      )}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate font-medium">{model.name}</span>
                        {model.features.isRecommended && (
                          <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                            Recommended
                          </span>
                        )}
                        {model.features.isFree && (
                          <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                            Free
                          </span>
                        )}
                        {model.features.isUnstable && (
                          <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                            Unstable
                          </span>
                        )}
                      </div>
                      {!isSelectable && (
                        <span className="ml-1.5 text-muted-foreground flex-shrink-0">(No API Key set)</span>
                      )}
                    </div>
                  </SelectItem>
                )

                // Wrap unavailable models with popover
                if (!isSelectable) {
                  return (
                    <UnavailableModelPopover key={model.id} model={model}>
                      {selectItem}
                    </UnavailableModelPopover>
                  )
                }

                return selectItem
              })}
            </SelectGroup>
            {groupIndex < getModelsByProvider().length - 1 && (
              <SelectSeparator />
            )}
          </div>
        ))}
      </SelectContent>
    </Select>
  )
}

// Re-export types from centralized location
export type { AIModel } from '@/lib/ai-models' 