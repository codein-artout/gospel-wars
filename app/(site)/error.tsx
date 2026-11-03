'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/States';

/** Route-level error boundary: what happened, and how to fix it. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const db = /in use by process|PGlite|ECONNREFUSED|database/i.test(error.message);
  return (
    <main className="flex flex-col gap-6 px-4 pb-12 pt-5 md:px-9 md:pt-7">
      <ErrorState
        title={db ? 'The world did not answer.' : 'This page could not load.'}
        body={
          db
            ? 'The database is busy or unreachable. If you run locally on PGlite, stop other processes using .pglite (pnpm tick, pnpm db:seed), then try again.'
            : `Something went wrong while building this page${error.digest ? ` (reference ${error.digest})` : ''}. Try again; if it keeps happening, the tick may still be running.`
        }
        action={
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        }
      />
    </main>
  );
}
