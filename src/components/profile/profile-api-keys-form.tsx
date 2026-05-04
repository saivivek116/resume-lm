'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Key, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { upsertApiKey, deleteApiKey } from '@/utils/actions/api-keys/actions'
import { PROVIDERS } from '@/lib/ai-models'
import type { ServiceName } from '@/lib/types'

interface ProviderKeyState {
  hasKey: boolean
  inputValue: string
}

interface ProfileApiKeysFormProps {
  keyStatus: Record<ServiceName, boolean>
}

const SUPPORTED_PROVIDERS: ServiceName[] = ['openai', 'anthropic', 'openrouter']

export function ProfileApiKeysForm({ keyStatus }: ProfileApiKeysFormProps) {
  const [states, setStates] = useState<Record<ServiceName, ProviderKeyState>>(
    () => Object.fromEntries(
      SUPPORTED_PROVIDERS.map(p => [p, { hasKey: keyStatus[p] ?? false, inputValue: '' }])
    ) as Record<ServiceName, ProviderKeyState>
  )
  const [isPending, startTransition] = useTransition()

  const handleSave = (provider: ServiceName) => {
    const value = states[provider].inputValue.trim()
    if (!value) {
      toast.error('Please enter an API key', { position: 'bottom-right' })
      return
    }
    startTransition(async () => {
      const result = await upsertApiKey(provider, value)
      if (result.error) {
        toast.error(result.error, { position: 'bottom-right' })
        return
      }
      setStates(prev => ({
        ...prev,
        [provider]: { hasKey: true, inputValue: '' },
      }))
      toast.success(`${PROVIDERS[provider]?.name} API key saved`, {
        position: 'bottom-right',
        className: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-none',
      })
    })
  }

  const handleRemove = (provider: ServiceName) => {
    startTransition(async () => {
      const result = await deleteApiKey(provider)
      if (result.error) {
        toast.error(result.error, { position: 'bottom-right' })
        return
      }
      setStates(prev => ({
        ...prev,
        [provider]: { hasKey: false, inputValue: '' },
      }))
      toast.success(`${PROVIDERS[provider]?.name} API key removed`, { position: 'bottom-right' })
    })
  }

  return (
    <Card className="bg-white/50 backdrop-blur-sm border-white/40 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Key className="h-5 w-5 text-teal-600" />
          API Keys
        </CardTitle>
        <CardDescription>
          Add your own API keys to use AI features. Keys are encrypted and never shown after saving.
          Get keys from each provider&apos;s dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SUPPORTED_PROVIDERS.map(provider => {
          const providerInfo = PROVIDERS[provider]
          const state = states[provider]
          if (!providerInfo) return null

          return (
            <div key={provider} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {providerInfo.name}
                  {state.hasKey && (
                    <span className="ml-2 text-xs text-emerald-600 font-normal">● Key saved</span>
                  )}
                </Label>
                <a
                  href={providerInfo.apiLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline"
                >
                  Get API key →
                </a>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={state.hasKey ? '••••••••••••••••' : `Enter ${providerInfo.name} API key`}
                  value={state.inputValue}
                  onChange={e =>
                    setStates(prev => ({
                      ...prev,
                      [provider]: { ...prev[provider], inputValue: e.target.value },
                    }))
                  }
                  className="flex-1 bg-white/50 border-white/40"
                  disabled={isPending}
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(provider)}
                  disabled={isPending || !states[provider].inputValue.trim()}
                  className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700"
                >
                  <Save className="h-4 w-4" />
                </Button>
                {state.hasKey && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemove(provider)}
                    disabled={isPending}
                    className="border-rose-500/20 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
