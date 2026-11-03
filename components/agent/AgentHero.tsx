import type { ReactNode } from 'react';

type Props = {
  name: string;
  color: string;
  isBoss?: boolean;
  meta: string;
  description: ReactNode;
  stats: { label: string; value: string | number }[];
};

/** Lancet portrait in the faith color, gothic name, stats. */
export function AgentHero({ name, color, isBoss, meta, description, stats }: Props) {
  const glass = isBoss ? 'linear-gradient(160deg, var(--boss-a), var(--boss-b))' : color;
  return (
    <header className="flex flex-wrap items-end gap-7">
      <div
        aria-hidden="true"
        className="grid h-[190px] w-[120px] flex-none grid-rows-2 overflow-hidden max-md:h-[130px] max-md:w-[82px]"
        style={{ borderRadius: '999px 999px 6px 6px', border: isBoss ? '5px double var(--gold)' : '5px solid var(--lead)', background: glass }}
      >
        <span style={{ borderBottom: '4px solid var(--lead)', background: glass, filter: 'brightness(1.18)' }} />
        <span style={{ background: glass }} />
      </div>
      <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
        <span className="text-[14px] text-faint">{meta}</span>
        <h1 className="m-0 break-words font-display text-[56px] font-extrabold leading-[0.9] md:text-[80px]">{name}</h1>
        <p className="m-0 max-w-[62ch] text-[17px] leading-normal text-text-2">{description}</p>
      </div>
      <dl className="m-0 grid grid-cols-3 gap-x-7 gap-y-2">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[13px] text-muted">{s.label}</dt>
            <dd className="tabular m-0 text-[28px] font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
