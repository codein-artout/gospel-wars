import Link from 'next/link';
import { GlassPane, type GlassLead } from '../glass/GlassPane';
import { KIND_COLOR, KIND_LABEL, type ChronicleKind } from '@/lib/ui/chronicle';

export type ChronicleRow = {
  id: string;
  tick: number;
  kind: ChronicleKind;
  text: string;
  color: string;
  lead?: GlassLead;
  href?: string | null;
};

/** Rows of tick, faith mark, sentence and kind label. Phone layout stacks the kind above the sentence. */
export function ChronicleList({ rows, emptyText = 'Nothing has happened yet. Advance a tick.' }: { rows: ChronicleRow[]; emptyText?: string }) {
  if (rows.length === 0) {
    return <p className="m-0 border-t border-hairline py-4 text-muted">{emptyText}</p>;
  }
  return (
    <ol className="m-0 flex list-none flex-col border-t border-hairline p-0">
      {rows.map((e) => {
        const sentence = e.href ? (
          <Link href={e.href} className="text-text no-underline hover:underline">
            {e.text}
          </Link>
        ) : (
          e.text
        );
        return (
          <li key={e.id} className="border-b border-hairline">
            {/* Desktop row */}
            <div className="hidden flex-wrap items-center gap-x-3.5 gap-y-1.5 px-1 py-3 md:flex">
              <span className="tabular w-[70px] text-[13px] text-faint">Tick {e.tick}</span>
              <GlassPane color={e.color} width={12} height={18} leadWidth={2} lead={e.lead} />
              <span className="min-w-0 flex-[1_1_360px] text-[15px] leading-[1.4]">{sentence}</span>
              <span className="flex-none text-[13px]" style={{ color: KIND_COLOR[e.kind] }}>
                {KIND_LABEL[e.kind]}
              </span>
            </div>
            {/* Phone row */}
            <div className="flex flex-col gap-1 py-3 md:hidden">
              <span className="text-[12px]" style={{ color: KIND_COLOR[e.kind] }}>
                Tick {e.tick}, {KIND_LABEL[e.kind].toLowerCase()}
              </span>
              <span className="text-[15px] leading-[1.4]">{sentence}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
