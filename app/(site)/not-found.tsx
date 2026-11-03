import Link from 'next/link';
import { PhoneTopBar } from '@/components/shell/PhoneTopBar';
import { PageHeader } from '@/components/ui/PageHeader';

export default function NotFound() {
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Not found" />
      <main className="flex flex-col gap-5 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <PageHeader title="Not found" />
        <p className="m-0 max-w-[60ch] text-[17px] text-text-2">There is no faith, agent or encounter at this address. It may have been hidden while reports are reviewed.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary no-underline">
            Back to the Nave
          </Link>
          <Link href="/faiths" className="btn btn-quiet no-underline">
            See the faiths
          </Link>
        </div>
      </main>
    </>
  );
}
