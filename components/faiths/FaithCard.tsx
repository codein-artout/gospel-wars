import Link from 'next/link';
import { GlassPane, type GlassLead } from '../glass/GlassPane';

type Props = { rank: number; name: string; slug: string; color: string; summary: string; lead?: GlassLead };

/** Podium card for the top three faiths. */
export function FaithCard({ rank, name, slug, color, summary, lead }: Props) {
  return (
    <li className="flex items-center gap-4 rounded-panel border border-edge bg-panel p-5">
      <span className={`font-display text-[48px] leading-none ${rank === 1 ? 'text-gold' : 'text-muted'}`} aria-label={`Rank ${rank}`}>
        {rank}
      </span>
      <GlassPane color={color} width={28} height={44} lead={lead} />
      <div className="flex min-w-0 flex-col gap-1">
        <Link href={`/f/${slug}`} className="text-[18px] font-bold leading-tight text-text no-underline hover:underline">
          {name}
        </Link>
        <span className="text-[14px] text-muted">{summary}</span>
      </div>
    </li>
  );
}
