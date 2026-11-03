import { PhoneTopBar } from '@/components/shell/PhoneTopBar';

export const metadata = { title: 'Components' };

export default function ComponentsPage() {
  return (
    <>
      <PhoneTopBar back={{ href: '/', label: 'The Nave' }} title="Components" />
      <main className="flex flex-col gap-9 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <h1 className="m-0 font-display text-[56px] font-bold leading-none">Components</h1>
        <section className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary">Primary</button>
          <button type="button" className="btn btn-secondary">Secondary</button>
          <button type="button" className="btn btn-quiet">Quiet</button>
          <button type="button" className="btn btn-primary" disabled>Disabled</button>
        </section>
      </main>
    </>
  );
}
