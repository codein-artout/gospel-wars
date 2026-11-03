import type { ReactNode } from 'react';
import { renderGospel, type Disputed } from '@/lib/markdown/render';

type Props = {
  markdown: string;
  /** Meta line, top left (e.g. "gospel.md, revision 2"). */
  meta?: string;
  /** Meta line, top right (e.g. "612 of 1,500 tokens"). */
  metaRight?: string;
  disputed?: Disputed[];
  footer?: ReactNode;
  headingId?: string;
  /** Narrow preview variant used by the editor. */
  variant?: 'full' | 'preview';
  previewLabel?: string;
};

/** An arch-topped vellum panel rendering sanitized gospel markdown. */
export function ScripturePanel({ markdown, meta, metaRight, disputed, footer, headingId = 'gospel-h', variant = 'full', previewLabel }: Props) {
  const { title, tagline, body } = renderGospel(markdown, { disputed });
  const preview = variant === 'preview';
  return (
    <article
      aria-labelledby={headingId}
      className={`scripture min-w-0 ${preview ? 'scripture-compact' : ''}`}
      style={{
        padding: preview ? '56px 28px 28px' : '72px clamp(20px, 6%, 64px) 48px',
        borderRadius: preview ? 'var(--arch-sm)' : undefined,
      }}
    >
      {preview ? (
        <h2 className="m-0 mb-2.5 font-sans text-[13px] font-semibold" style={{ color: 'var(--vellum-meta)' }}>
          {previewLabel ?? 'Preview'}
        </h2>
      ) : (meta || metaRight) ? (
        <div className="mb-6 flex flex-wrap justify-between gap-2 font-sans text-[13px]" style={{ color: 'var(--vellum-meta)' }}>
          {meta ? <span>{meta}</span> : null}
          {metaRight ? <span>{metaRight}</span> : null}
        </div>
      ) : null}
      {preview ? (
        <span id={headingId} className="gospel-title block">
          {title ?? 'Untitled gospel'}
        </span>
      ) : (
        <h2 id={headingId} className="gospel-title">
          {title ?? 'Untitled gospel'}
        </h2>
      )}
      {tagline ? <p className="gospel-tagline">{tagline}</p> : null}
      {body}
      {footer ? (
        <div
          className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t pt-4 font-sans text-[14px]"
          style={{ borderColor: 'var(--vellum-rule)', color: 'var(--vellum-meta-2)' }}
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}
