'use server';

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function generateTheirStackSecret(): Promise<string> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const secret = crypto.randomBytes(32).toString('hex');

  const { error } = await supabase
    .from('profiles')
    .update({ theirstack_webhook_secret: secret })
    .eq('user_id', user.id);

  if (error) throw error;

  return secret;
}
