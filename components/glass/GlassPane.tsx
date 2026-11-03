import type { CSSProperties } from 'react';

export type GlassLead = 'solid' | 'boss' | 'agent';

type Props = {
  color: string;
  /** Width and height in px. */
  width: number;
  height: number;
  lead?: GlassLead;
  /** Lead (border) width in px. Default 3. */
  leadWidth?: number;
  faded?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** A decorative lancet of colored glass in lead came. Always paired with a visible name. */
export function GlassPane({ color, width, height, lead = 'solid', leadWidth = 3, faded, className, style }: Props) {
  const border =
    lead === 'boss'
      ? `${leadWidth}px double var(--gold)`
      : lead === 'agent'
        ? `${leadWidth}px dashed var(--gold)`
        : `${leadWidth}px solid var(--lead)`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        flex: 'none',
        width,
        height,
        borderRadius: height >= 30 ? 'var(--lancet)' : 'var(--lancet-sm)',
        border,
        background: color,
        opacity: faded ? 0.55 : undefined,
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
}

export const BOSS_GLASS = 'linear-gradient(160deg, var(--boss-a), var(--boss-b))';
