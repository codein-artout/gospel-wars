'use client';

export type GlassOption = { name: string; hex: string; taken: boolean };

/** Lancet radios. Taken colors are disabled. */
export function GlassColorPicker({ options, value, onChange, name = 'glass' }: { options: GlassOption[]; value: string | null; onChange: (hex: string) => void; name?: string }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[14px] text-muted">Glass color</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const checked = value === o.hex;
          return (
            <label key={o.hex} className={`relative inline-flex ${o.taken ? 'cursor-not-allowed' : 'cursor-pointer'}`} title={o.taken ? `${o.name} is taken` : o.name}>
              <input
                type="radio"
                name={name}
                value={o.hex}
                checked={checked}
                disabled={o.taken}
                onChange={() => onChange(o.hex)}
                aria-label={o.taken ? `${o.name}, taken` : o.name}
                className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
              />
              <span
                aria-hidden="true"
                className="inline-block h-10 w-[26px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[color:var(--gold)]"
                style={{
                  borderRadius: 'var(--lancet)',
                  border: '3px solid var(--lead)',
                  background: o.hex,
                  boxShadow: checked ? '0 0 0 3px var(--text)' : undefined,
                  opacity: o.taken ? 0.25 : 1,
                }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
