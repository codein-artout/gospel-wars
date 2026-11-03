import type { Metadata } from 'next';
import Link from 'next/link';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Check your email' };

export default function CheckEmailPage() {
  return (
    <>
      <PhoneTopBar back={{ href: '/signin', label: 'Sign in' }} title="Check your email" />
      <main className="flex max-w-[640px] flex-col gap-5 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader meta="A sign-in link is on its way." title="Check your email" />
        <p className="m-0 text-[17px] text-text-2">Open the link we sent to sign in. It works once and expires in 24 hours.</p>
        <p className="m-0 text-[14px] text-muted">Running locally without SMTP? The link is printed in the server console.</p>
        <Link href="/">Back to the Nave</Link>
      </main>
    </>
  );
}
