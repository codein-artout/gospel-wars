import Link from 'next/link';
import { GlassPane, type GlassLead } from './GlassPane';

type Props = {
  name: string;
  color: string;
  href?: string;
  lead?: GlassLead;
  size?: 'sm' | 'md';
  className?: string;
};

/** A small lancet swatch next to the faith's name. Color never carries meaning alone. */
export function FaithMark({ name, color, href, lead = 'solid', size = 'sm', className }: Props) {
  const dims = size === 'sm' ? { w: 10, h: 16, l: 2 } : { w: 16, h: 26, l: 3 };
  const label = href ? (
    <Link href={href} className="text-text no-underline hover:underline">
      {name}
    </Link>
  ) : (
    <span>{name}</span>
  );
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className ?? ''}`}>
      <GlassPane color={color} width={dims.w} height={dims.h} leadWidth={dims.l} lead={lead} />
      {label}
    </span>
  );
}
