'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { GameConfig } from '@/lib/game/config';
import { changedDoctrines, changeRatio, lineDiff } from '@/lib/game/diff';
import { detectParaphrase, HERESY_KIND_LABEL, lintFaithName, lintGospel } from '@/lib/game/heresy';
import { countTokens } from '@/lib/game/tokens';
import { publishEdit, publishForkGospel, publishNewGospel, saveDraft } from '@/lib/server/actions/gospel';
import { ScripturePanel } from '../scripture/ScripturePanel';
import { useToast } from '../ui/Toast';
import { ApostleStylePicker, type ApostleStyleName } from './ApostleStylePicker';
import { GlassColorPicker, type GlassOption } from './GlassColorPicker';
import { HeresyLinter, type LintFindingView } from './HeresyLinter';
import { TokenMeter } from './TokenMeter';

export type EditorMode = 'new' | 'edit' | 'fork';

type Props = {
  mode: EditorMode;
  config: GameConfig;
  palette: GlassOption[];
  initial: { name: string; body: string; color: string | null; style: ApostleStyleName; apostleName: string };
  /** The faith being edited, or the parent being forked. */
  faith?: { id: string; slug: string; name: string; body: string };
  draftSavedAt: string | null;
  editsLeft?: number;
};

const LINT_DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 2500;

function ago(iso: string | null): string {
  if (!iso) return 'not saved yet';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'saved just now';
  if (s < 120) return 'saved a minute ago';
  if (s < 3600) return `saved ${Math.round(s / 60)} minutes ago`;
  return `saved ${Math.round(s / 3600)} hours ago`;
}

export function GospelEditor({ mode, config, palette, initial, faith, draftSavedAt, editsLeft }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const [name, setName] = useState(initial.name);
  const [body, setBody] = useState(initial.body);
  const [color, setColor] = useState<string | null>(initial.color);
  const [style, setStyle] = useState<ApostleStyleName>(initial.style);
  const [apostleName, setApostleName] = useState(initial.apostleName);
  const [attested, setAttested] = useState(mode === 'edit');
  const [linted, setLinted] = useState(() => ({ body: initial.body, name: initial.name }));
  const [savedAt, setSavedAt] = useState(draftSavedAt);
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const firstRender = useRef(true);

  // Live lint, debounced 300ms, no animation (DESIGN.md motion).
  useEffect(() => {
    const t = setTimeout(() => setLinted({ body, name }), LINT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [body, name]);

  // Draft autosave.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(async () => {
      const r = await saveDraft({ kind: mode, faithId: faith?.id, name, body, color, style, apostleName });
      if (r.ok && r.data) setSavedAt(r.data.savedAt);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [mode, faith?.id, name, body, color, style, apostleName]);

  const lint = useMemo(() => lintGospel(linted.body, config), [linted.body, config]);
  const findings: LintFindingView[] = lint.findings.map((f) => ({ line: f.line, kind: f.kind, label: HERESY_KIND_LABEL[f.kind], excerpt: f.excerpt }));
  const paraphrase = useMemo(() => (lint.findings.length ? null : detectParaphrase(linted.body, config)), [lint.findings.length, linted.body, config]);
  const nameProblems = mode === 'edit' ? [] : lintFaithName(linted.name, config);
  const fork = useMemo(() => {
    if (mode !== 'fork' || !faith) return null;
    return { ratio: changeRatio(faith.body, linted.body), doctrines: changedDoctrines(faith.body, linted.body), ops: lineDiff(faith.body, linted.body).filter((o) => o.op !== 'same' && o.text.trim()) };
  }, [mode, faith, linted.body]);

  const problems: string[] = [
    ...lint.problems.map((p) => (p.line ? `Line ${p.line}: ${p.message}` : p.message)),
    ...(paraphrase ? [`Line ${paraphrase.line} reads as an instruction to ${paraphrase.kind === 'judge' ? 'the judge' : paraphrase.kind === 'agent' ? 'agents' : 'the system'}. Rewrite it as persuasion.`] : []),
    ...nameProblems,
    ...(fork && fork.ratio < config.forkMinChangeRatio ? [`A fork must change at least ${Math.round(config.forkMinChangeRatio * 100)}% of the lines. This one changes ${Math.round(fork.ratio * 100)}%.`] : []),
  ];
  const blockers = [
    ...(findings.length ? [`Fix ${findings.length} ${findings.length === 1 ? 'heresy' : 'heresies'} to publish`] : []),
    ...(problems.length ? ['Fix the problems below to publish'] : []),
    ...(mode !== 'edit' && !color ? ['Pick a glass color'] : []),
    ...(!attested ? ['Confirm this is an invented faith'] : []),
  ];
  const tokens = countTokens(body, config);
  const canPublish = blockers.length === 0 && !pending;

  const publish = () =>
    start(async () => {
      setServerProblems([]);
      const common = { name, body, color: color ?? '', style, apostleName: apostleName || undefined, attested };
      const r =
        mode === 'new' ? await publishNewGospel(common) : mode === 'fork' ? await publishForkGospel({ ...common, parentId: faith!.id }) : await publishEdit({ faithId: faith!.id, body });
      if (!r.ok) {
        setServerProblems(r.problems ?? [r.error]);
        show(r.error, 'error');
        return;
      }
      show(r.message);
      const slug = mode === 'edit' ? faith!.slug : (r.data as { slug: string }).slug;
      router.push(`/f/${slug}`);
      router.refresh();
    });

  const meta =
    mode === 'new'
      ? `New faith, draft ${ago(savedAt)}. After publishing you get ${config.gospelEditsPerSeason} edits per season.`
      : mode === 'fork'
        ? `Fork of ${faith?.name}, draft ${ago(savedAt)}. Change at least ${Math.round(config.forkMinChangeRatio * 100)}% of the lines.`
        : `Editing ${faith?.name}, draft ${ago(savedAt)}. ${editsLeft ?? 0} ${editsLeft === 1 ? 'edit' : 'edits'} left this season. Edits take effect at the next tick.`;
  const title = mode === 'new' ? 'Write a gospel' : mode === 'fork' ? 'Fork this faith' : 'Edit gospel';
  const action = mode === 'new' ? 'Publish gospel' : mode === 'fork' ? 'Publish fork' : 'Save revision';

  return (
    <main className="flex flex-col gap-6 px-4 pb-14 pt-5 md:px-9 md:pt-7">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] text-faint md:text-[14px]">{meta}</span>
          <h1 className="m-0 font-display text-[44px] font-bold leading-none md:text-[56px]">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {blockers[0] ? <span className="text-[14px] text-heresy-text">{blockers[0]}</span> : null}
          <button type="button" className="btn btn-primary" disabled={!canPublish} aria-disabled={!canPublish} onClick={publish}>
            {pending ? 'Publishing…' : action}
          </button>
        </div>
      </header>

      {mode !== 'edit' ? (
        <div className="flex flex-wrap items-end gap-5">
          <div className="flex flex-[2_1_320px] flex-col gap-1.5">
            <label htmlFor="fname" className="text-[14px] text-muted">
              Name of your faith
            </label>
            <input
              id="fname"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              aria-describedby={nameProblems.length ? 'fname-problems' : undefined}
              className="min-h-11 rounded-control border px-3 text-[17px] font-medium"
              style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex-[1_1_260px]">
            <GlassColorPicker options={palette} value={color} onChange={setColor} />
          </div>
          <div className="min-w-0 flex-[3_1_420px]">
            <ApostleStylePicker value={style} onChange={setStyle} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-stretch gap-6">
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-2">
          <TokenMeter tokens={tokens} max={config.gospelMaxTokens} htmlFor="gospel" />
          <textarea
            id="gospel"
            spellCheck={false}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[620px] resize-y rounded-control border px-5 py-[18px] font-mono text-[15px] leading-[1.7] max-md:min-h-[420px]"
            style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }}
          />
          {fork ? (
            <section aria-labelledby="diff-h" className="mt-3 flex flex-col gap-2 rounded-panel border border-edge bg-panel p-4">
              <h2 id="diff-h" className="m-0 font-display text-[26px] font-bold">
                Changes from {faith?.name}
              </h2>
              <p className="m-0 text-[14px]" style={{ color: fork.ratio >= config.forkMinChangeRatio ? 'var(--grace)' : 'var(--heresy-text)' }}>
                {Math.round(fork.ratio * 100)}% of lines changed. A fork needs {Math.round(config.forkMinChangeRatio * 100)}%.
              </p>
              {fork.doctrines.length ? (
                <div className="flex flex-wrap gap-2">
                  {fork.doctrines.map((n) => (
                    <span key={n} className="rounded-control px-2 py-1 text-[13px]" style={{ background: 'var(--disputed-bg)', color: 'var(--ink)' }}>
                      Changed doctrine {n}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex max-h-72 flex-col gap-0.5 overflow-auto font-mono text-[13px]">
                {fork.ops.length === 0 ? <span className="text-muted">No changes yet.</span> : null}
                {fork.ops.map((o, i) => (
                  <div key={i} style={{ color: o.op === 'add' ? 'var(--grace)' : 'var(--heresy-text)' }}>
                    <span className="sr-only">{o.op === 'add' ? 'Added: ' : 'Removed: '}</span>
                    <span aria-hidden="true">{o.op === 'add' ? '+ ' : '− '}</span>
                    {o.text}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
          <HeresyLinter findings={findings} problems={[...problems, ...serverProblems.filter((p) => !problems.includes(p))]} />
          <div className="flex-1">
            <ScripturePanel variant="preview" markdown={linted.body} headingId="preview-h" />
          </div>
          {mode !== 'edit' ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="apostle" className="text-[14px] text-muted">
                Apostle name (optional)
              </label>
              <input
                id="apostle"
                type="text"
                value={apostleName}
                maxLength={60}
                placeholder="A name is generated if you leave this empty"
                onChange={(e) => setApostleName(e.target.value)}
                className="min-h-11 rounded-control border px-3 text-[15px]"
                style={{ borderColor: 'var(--edge-strong)', background: 'var(--nave-well)', color: 'var(--text)' }}
              />
            </div>
          ) : null}
          {mode !== 'edit' ? (
            <label className="flex items-start gap-2.5 text-[14px] leading-[1.45] text-text-2">
              <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="m-0 h-5 w-5 flex-none accent-[color:var(--gold)]" />
              <span>This is an invented faith. It doesn&apos;t mock or impersonate a real religion or a real person.</span>
            </label>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
