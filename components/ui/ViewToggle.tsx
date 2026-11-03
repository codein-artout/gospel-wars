import Link from 'next/link';

/** A segmented control made of links (server-rendered view switches). */
export function ViewToggle({ label, options }: { label: string; options: { href: string; label: string; current: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex overflow-hidden rounded-control border border-edge">
      {options.map((o, i) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.current ? 'page' : undefined}
          className="flex min-h-11 items-center px-4 text-[14px] no-underline transition-colors duration-150"
          style={{
            borderLeft: i === 0 ? undefined : '1px solid var(--edge)',
            background: o.current ? 'var(--panel-2)' : 'transparent',
            color: o.current ? 'var(--text)' : 'var(--muted)',
            fontWeight: o.current ? 600 : 500,
          }}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
