'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ReplayResult } from '@/lib/engine/replay';
import type { ActionResult } from '@/lib/server/actions/result';
import { adminReplay, adminReseed, adminSaveConfig } from '@/lib/server/actions/admin';
import { useToast } from '../ui/Toast';

/** A button that runs one bound admin server action, then refreshes. */
export function AdminActionButton({ action, label, tone = 'quiet', confirm }: { action: () => Promise<ActionResult<unknown>>; label: string; tone?: 'quiet' | 'secondary' | 'primary'; confirm?: string }) {
  const [pending, start] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      className={`btn btn-${tone} min-h-10 px-3 text-[14px]`}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await action();
          show(r.ok ? r.message : r.error, r.ok ? 'info' : 'error');
          router.refresh();
        });
      }}
    >
      {pending ? 'Working…' : label}
    </button>
  );
}

export function ConfigEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const { show } = useToast();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="config" className="text-[14px] text-muted">
        World config overrides (JSON). Keys are GameConfig keys from GAME.md; anything left out uses the default.
      </label>
      <textarea id="config" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} className="rounded-control border p-4 font-mono text-[14px] leading-[1.6]" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
      {problems.length ? (
        <ul role="status" className="m-0 flex flex-col gap-1 pl-5 text-[14px] text-heresy-text">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="btn btn-secondary self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await adminSaveConfig(text);
            setProblems(r.ok ? [] : (r.problems ?? [r.error]));
            show(r.ok ? r.message : r.error, r.ok ? 'info' : 'error');
            router.refresh();
          })
        }
      >
        Save overrides
      </button>
    </div>
  );
}

export function ReplayForm({ recent }: { recent: { id: string; label: string }[] }) {
  const [id, setId] = useState(recent[0]?.id ?? '');
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="replay-id" className="text-[14px] text-muted">
        Encounter id
      </label>
      <div className="flex flex-wrap gap-3">
        <input id="replay-id" value={id} onChange={(e) => setId(e.target.value)} list="recent-encounters" className="min-h-11 min-w-[280px] flex-1 rounded-control border px-3 font-mono text-[14px]" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
        <datalist id="recent-encounters">
          {recent.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </datalist>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || !id}
          onClick={() =>
            start(async () => {
              const r = await adminReplay(id);
              if (r.ok) {
                setResult(r.data ?? null);
                setError(null);
              } else {
                setResult(null);
                setError(r.error);
              }
            })
          }
        >
          Replay encounter
        </button>
      </div>
      <div role="status" className="text-[15px]">
        {error ? <p className="m-0 text-heresy-text">{error}</p> : null}
        {result ? (
          result.identical ? (
            <p className="m-0 text-grace">Identical. Same seed, same inputs, same result.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-heresy-text">{result.differences.length} differences:</p>
              <ul className="m-0 pl-5 font-mono text-[13px]">
                {result.differences.map((d) => (
                  <li key={d.field}>
                    {d.field}: stored {JSON.stringify(d.stored)}, replayed {JSON.stringify(d.replayed)}
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export function ReseedForm() {
  const [confirm, setConfirm] = useState('');
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reseed" className="text-[14px] text-muted">
          Type RESEED to wipe the world and rebuild the demo (about 30 seconds)
        </label>
        <input id="reseed" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-11 rounded-control border px-3" style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }} />
      </div>
      <AdminActionButton action={() => adminReseed(confirm)} label="Reseed world" tone="secondary" />
    </div>
  );
}
