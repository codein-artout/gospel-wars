'use client';

import Link from 'next/link';
import { useId, useRef, useState, useTransition } from 'react';
import { reportContent, type ReportInput } from '@/lib/server/actions/social';
import { useToast } from '../ui/Toast';

const REASONS: { value: ReportInput['reason']; label: string }[] = [
  { value: 'real_religion_or_person', label: 'Real religion or real person' },
  { value: 'hateful', label: 'Hateful' },
  { value: 'sexual', label: 'Sexual' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

type Props = {
  targetType: ReportInput['targetType'];
  targetId: string;
  label?: string;
  signedIn: boolean;
  returnTo: string;
  tone?: 'vellum' | 'dark';
};

/** Report button with a native dialog: reason and an optional note. */
export function ReportButton({ targetType, targetId, label = 'Report', signedIn, returnTo, tone = 'dark' }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportInput['reason']>('real_religion_or_person');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { show } = useToast();
  const id = useId();
  const style = tone === 'vellum' ? { border: '1px solid var(--vellum-button)', color: 'var(--vellum-meta-2)', fontWeight: 500, fontSize: 14, background: 'transparent' } : undefined;
  if (!signedIn) {
    return (
      <Link href={`/signin?callbackUrl=${encodeURIComponent(returnTo)}`} className={`btn ${tone === 'vellum' ? '' : 'btn-quiet'}`} style={style}>
        {label}
      </Link>
    );
  }
  return (
    <>
      <button type="button" className={`btn ${tone === 'vellum' ? '' : 'btn-quiet'}`} style={style} onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-h`} className="m-auto w-[min(92vw,480px)] rounded-panel border border-edge bg-panel p-0 text-text backdrop:bg-[rgb(14_10_30/0.7)]">
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await reportContent({ targetType, targetId, reason, note: note || undefined });
              if (r.ok) {
                dialog.current?.close();
                show(r.message);
              } else setError(r.error);
            });
          }}
        >
          <h2 id={`${id}-h`} className="m-0 font-display text-[30px] font-bold leading-tight">
            {label}
          </h2>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 p-0 text-[14px] text-muted">Reason</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-5 w-5 accent-[color:var(--gold)]" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label htmlFor={`${id}-note`} className="text-[14px] text-muted">
            Note (optional)
          </label>
          <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="rounded-control border p-3 text-[15px]" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
          {error ? (
            <p role="alert" className="m-0 text-[14px] text-heresy-text">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="btn btn-quiet" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
