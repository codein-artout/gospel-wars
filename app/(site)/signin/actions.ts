'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signIn, signOut } from '@/auth';
import { devLoginEnabled } from '@/lib/auth/secret';

const Input = z.object({
  email: z.email('Enter a valid email address.').max(200),
  callbackUrl: z.string().max(500).optional(),
});

/** Only same-site relative paths are allowed as a post-sign-in destination. */
function safeCallback(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

function fail(message: string, callbackUrl: string): never {
  redirect(`/signin?error=${encodeURIComponent(message)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
}

export async function signInWithEmail(form: FormData): Promise<void> {
  const parsed = Input.safeParse({ email: form.get('email'), callbackUrl: form.get('callbackUrl') ?? undefined });
  const callbackUrl = safeCallback(parsed.success ? parsed.data.callbackUrl : undefined);
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? 'Enter a valid email address.', callbackUrl);
  try {
    await signIn('email', { email: parsed.data.email.toLowerCase(), redirectTo: callbackUrl, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) fail('Could not send the sign-in link. Try again in a minute.', callbackUrl);
    throw e;
  }
  redirect('/signin/check');
}

export async function signInWithDevLogin(form: FormData): Promise<void> {
  const parsed = Input.safeParse({ email: form.get('email'), callbackUrl: form.get('callbackUrl') ?? undefined });
  const callbackUrl = safeCallback(parsed.success ? parsed.data.callbackUrl : undefined);
  if (!devLoginEnabled()) fail('Dev login is off on this server. Use the email link.', callbackUrl);
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? 'Enter a valid email address.', callbackUrl);
  try {
    await signIn('dev', { email: parsed.data.email.toLowerCase(), redirectTo: callbackUrl });
  } catch (e) {
    if (e instanceof AuthError) fail('That account cannot sign in.', callbackUrl);
    throw e;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
