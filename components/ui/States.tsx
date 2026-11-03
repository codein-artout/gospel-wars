import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/** Empty states invite action. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-edge p-6">
      <p className="m-0 font-display text-[26px] font-bold leading-tight">{title}</p>
      {body ? <p className="m-0 max-w-[60ch] text-muted">{body}</p> : null}
      {action ? (
        <Link href={action.href} className="btn btn-primary">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/** Errors state what happened and how to fix it. */
export function ErrorState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-panel border p-6" style={{ borderColor: 'var(--heresy-edge)', background: 'var(--heresy-bg)' }}>
      <p className="m-0 font-display text-[26px] font-bold leading-tight text-heresy-text">{title}</p>
      <p className="m-0 max-w-[60ch]" style={{ color: 'var(--heresy-body)' }}>
        {body}
      </p>
      {action}
    </div>
  );
}

export function Skeleton({ className, style, label }: { className?: string; style?: CSSProperties; label?: string }) {
  return <div className={`skeleton ${className ?? ''}`} style={style} aria-hidden={label ? undefined : true} aria-label={label} />;
}
