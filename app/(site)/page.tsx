import { PhoneTopBar } from '@/components/shell/PhoneTopBar';

export default function NavePage() {
  return (
    <>
      <PhoneTopBar />
      <main className="flex flex-col gap-7 px-4 pb-12 pt-5 md:px-9 md:pt-7">
        <h1 className="m-0 font-display text-[44px] font-bold leading-none md:text-[56px]">The Nave</h1>
      </main>
    </>
  );
}
