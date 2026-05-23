'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateTheirStackSecret } from '@/utils/actions/jobs/theirstack';
import { toast } from 'sonner';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface TheirStackWebhookSectionProps {
  webhookUrl: string;
  hasSecret: boolean;
}

export function TheirStackWebhookSection({ webhookUrl, hasSecret: initialHasSecret }: TheirStackWebhookSectionProps) {
  const [hasSecret, setHasSecret] = useState(initialHasSecret);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerateSecret() {
    setIsGenerating(true);
    try {
      const secret = await generateTheirStackSecret();
      setRevealedSecret(secret);
      setShowSecret(true);
      setHasSecret(true);
      toast.success('New webhook secret generated. Copy it now — it will not be shown again.');
    } catch {
      toast.error('Failed to generate secret');
    } finally {
      setIsGenerating(false);
    }
  }

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configure this URL and secret in TheirStack under <strong>Webhooks → New Webhook</strong>. TheirStack will push new jobs matching your saved searches to this endpoint in real time.
      </p>

      <div className="space-y-2">
        <Label htmlFor="webhook-url">Your Webhook URL</Label>
        <div className="flex gap-2">
          <Input
            id="webhook-url"
            value={webhookUrl}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Signing Secret</Label>
        {revealedSecret ? (
          <div className="flex gap-2">
            <Input
              value={showSecret ? revealedSecret : '•'.repeat(64)}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSecret(v => !v)}
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(revealedSecret, 'Secret')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {hasSecret ? 'A secret is configured. Generate a new one to replace it.' : 'No secret configured yet.'}
          </p>
        )}
      </div>

      <Button
        variant="outline"
        onClick={handleGenerateSecret}
        disabled={isGenerating}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
        {hasSecret ? 'Regenerate Secret' : 'Generate Secret'}
      </Button>

      {hasSecret && !revealedSecret && (
        <p className="text-xs text-amber-600">
          Regenerating will invalidate your current secret. Update it in TheirStack immediately after.
        </p>
      )}
    </div>
  );
}
