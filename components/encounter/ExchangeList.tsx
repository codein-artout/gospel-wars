'use client';

import { useState } from 'react';
import { ReplyBlock, SermonBlock } from './Exchange';

type Turn = { id: string; role: 'sermon' | 'reply'; round: number; speaker: string; text: string; withheld: boolean };

/** The exchange. On phone, turns past the third collapse behind "Show all N turns". */
export function ExchangeList({ turns, color }: { turns: Turn[]; color: string }) {
  const [all, setAll] = useState(false);
  return (
    <>
      {turns.map((t, i) => (
        <div key={t.id} className={!all && i >= 3 ? 'max-md:hidden' : undefined}>
          {t.role === 'sermon' ? (
            <SermonBlock who={`${t.speaker}, round ${t.round}`} color={color}>
              {t.withheld ? '[withheld]' : t.text}
            </SermonBlock>
          ) : (
            <ReplyBlock who={t.speaker}>{t.withheld ? '[withheld]' : t.text}</ReplyBlock>
          )}
        </div>
      ))}
      {!all && turns.length > 3 ? (
        <button type="button" className="btn btn-quiet w-full md:hidden" onClick={() => setAll(true)}>
          Show all {turns.length} turns
        </button>
      ) : null}
    </>
  );
}
