'use client';

import { useRef, type KeyboardEvent } from 'react';

type Option<T extends string> = { value: T; label: string; disabled?: boolean };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'radio' for form choices (apostle style), 'pressed' for view toggles (season/all time). */
  mode?: 'radio' | 'pressed';
  className?: string;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange, mode = 'radio', className }: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (mode !== 'radio') return;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let step = 1; step <= options.length; step++) {
      const j = (i + dir * step + options.length) % options.length;
      const o = options[j];
      if (o && !o.disabled) {
        onChange(o.value);
        refs.current[j]?.focus();
        return;
      }
    }
  }

  return (
    <div
      role={mode === 'radio' ? 'radiogroup' : 'group'}
      aria-label={label}
      className={`flex flex-wrap overflow-hidden rounded-control border ${className ?? ''}`}
      style={{ borderColor: mode === 'radio' ? 'var(--edge-strong)' : 'var(--edge)' }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role={mode === 'radio' ? 'radio' : undefined}
            aria-checked={mode === 'radio' ? selected : undefined}
            aria-pressed={mode === 'pressed' ? selected : undefined}
            tabIndex={mode === 'radio' ? (selected || (idx < 0 && i === 0) ? 0 : -1) : 0}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className="min-h-11 flex-1 whitespace-nowrap px-4 text-[14px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderLeft: i === 0 ? undefined : `1px solid ${mode === 'radio' ? 'var(--edge-strong)' : 'var(--edge)'}`,
              background: selected ? 'var(--panel-2)' : 'transparent',
              color: selected ? 'var(--text)' : 'var(--muted)',
              fontWeight: selected ? 700 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
