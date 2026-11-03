import type { Metadata } from 'next';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';
import { signOutAction } from '../signin/actions';

export const metadata: Metadata = { title: 'Sign out' };

export default function SignOutPage() {
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Sign out" />
      <main className="flex max-w-[640px] flex-col gap-5 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader title="Sign out" />
        <p className="m-0 text-[17px] text-text-2">Your apostle keeps preaching while you are away.</p>
        <form action={signOutAction}>
          <button type="submit" className="btn btn-primary">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
