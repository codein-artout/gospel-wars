import Link from 'next/link';
import { PhoneTopBar } from '../shell/PhoneTopBar';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/States';

/** Shown instead of the editor when a rule says no (one faith per season, not your faith, …). */
export function EditorGate({ title, body, action, back }: { title: string; body: string; action?: { href: string; label: string }; back?: { href: string; label: string } }) {
  return (
    <>
      <PhoneTopBar back={back ?? { href: '/', label: 'The Nave' }} title={title} />
      <main className="flex flex-col gap-6 px-4 pb-14 pt-5 md:px-9 md:pt-7">
        <PageHeader title={title} />
        <EmptyState title={body} action={action} />
        {back ? <Link href={back.href}>Back to {back.label}</Link> : null}
      </main>
    </>
  );
}
