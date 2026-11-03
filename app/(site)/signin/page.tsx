import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { devLoginEnabled } from '@/lib/auth/secret';
import { getSessionUser } from '@/lib/auth/session';
import { signInWithDevLogin, signInWithEmail } from './actions';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  Verification: 'That sign-in link has expired or was already used. Ask for a new one.',
  Configuration: 'Sign-in is not configured on this server.',
  AccessDenied: 'That account cannot sign in.',
};

type Props = { searchParams: Promise<{ error?: string; callbackUrl?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { error, callbackUrl } = await searchParams;
  const user = await getSessionUser();
  const target = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/';
  if (user) redirect(target);
  const message = error ? (ERRORS[error] ?? error) : null;
  const dev = devLoginEnabled();
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Sign in" />
      <main className="flex max-w-[640px] flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader meta="Prophets sign in to write gospels, follow faiths and report." title="Sign in" />
        {message ? (
          <p role="alert" className="m-0 rounded-control border px-4 py-3 text-[15px]" style={{ borderColor: 'var(--heresy-edge)', background: 'var(--heresy-bg)', color: 'var(--heresy-text)' }}>
            {message}
          </p>
        ) : null}
        <form action={signInWithEmail} className="flex flex-col gap-3 rounded-panel border border-edge bg-panel p-5">
          <h2 className="m-0 font-display text-[30px] font-bold leading-tight">Email me a link</h2>
          <p className="m-0 text-[14px] text-muted">We send a one-time sign-in link. No password.</p>
          <input type="hidden" name="callbackUrl" value={target} />
          <label htmlFor="email" className="text-[14px] text-muted">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="min-h-11 rounded-control border px-3 text-[17px]" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
          <button type="submit" className="btn btn-primary self-start">
            Send sign-in link
          </button>
        </form>
        {dev ? (
          <form action={signInWithDevLogin} className="flex flex-col gap-3 rounded-panel border border-dashed border-edge p-5">
            <h2 className="m-0 font-display text-[30px] font-bold leading-tight">Dev login</h2>
            <p className="m-0 text-[14px] text-muted">
              Local and test only. Signs in as any email without a link. Seeded accounts: ledgerwitch@gospelwars.test, slowboil@gospelwars.test, pilgrim@gospelwars.test, admin@gospelwars.test.
            </p>
            <input type="hidden" name="callbackUrl" value={target} />
            <label htmlFor="dev-email" className="text-[14px] text-muted">
              Email
            </label>
            <input id="dev-email" name="email" type="email" required defaultValue="pilgrim@gospelwars.test" className="min-h-11 rounded-control border px-3 text-[17px]" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
            <button type="submit" className="btn btn-secondary self-start">
              Sign in without a link
            </button>
          </form>
        ) : null}
      </main>
    </>
  );
}
