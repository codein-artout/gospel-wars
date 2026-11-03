'use client';

/** Last-resort boundary when the root layout itself fails. Inline styles: globals may not have loaded. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#191430', color: '#F3EFFA', fontFamily: 'system-ui, sans-serif', padding: 32 }}>
        <h1 style={{ fontSize: 40, margin: '0 0 12px' }}>Gospel Wars could not load.</h1>
        <p style={{ maxWidth: '60ch', lineHeight: 1.5 }}>Something failed before the page could render. Reload, or try again in a minute.</p>
        <button type="button" onClick={reset} style={{ minHeight: 44, padding: '0 18px', borderRadius: 4, border: 0, background: '#E7BE57', color: '#1C1430', fontWeight: 700 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
