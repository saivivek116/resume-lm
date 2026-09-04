import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from './supabase/server';
import AuthCache from './auth-cache';

/**
 * Resolves the current user, memoised for the lifetime of one request.
 *
 * `supabase.auth.getUser()` is a network call to the auth server, not a local JWT decode,
 * and a single render can need the user several times over — the dashboard resolves the
 * profile and both resume sections in parallel. React's `cache()` collapses those into
 * one call. The `AuthCache` below is a second layer that only engages when something
 * upstream sets `x-request-id`; nothing in this app does today, so `cache()` is what
 * actually does the deduplication.
 */
export const getAuthenticatedUser = cache(async () => {
  const headersList = await headers();
  const requestId = headersList.get('x-request-id');
  const userId = headersList.get('x-user-id');
  
  // If we have a request ID and user ID in headers, check cache first
  if (requestId && userId) {
    const cachedUser = AuthCache.get(requestId);
    if (cachedUser) {
      return {
        id: cachedUser.id,
        email: cachedUser.email
      };
    }
  }

  // If not in cache, get from Supabase
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('User not authenticated');
  }

  // If we have a request ID, cache the result
  if (requestId) {
    AuthCache.set(requestId, {
      id: user.id,
      email: user.email || null,
      timestamp: Date.now()
    });
  }

  return user;
});

// Helper to get user ID with error handling
export const getUserId = async () => {
  const user = await getAuthenticatedUser();
  return user.id;
}; 