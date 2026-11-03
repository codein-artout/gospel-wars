import { OG, shade } from '@/lib/ui/tokens';

export type CardData = {
  variant: 'conversion' | 'schism' | 'boss';
  kicker: string;
  headline: string;
  quote: string;
  scoreLine: string;
  fromColor: string;
  toColor: string;
  glyph: string;
};

/**
 * The 1200×630 share card (Card.html). Rendered by next/og (Satori), which needs inline
 * styles, flex layout and literal colors, so it uses the OG hex mirrors of the tokens.
 */
export function ConversionCardImage({ card }: { card: CardData }) {
  const headlineSize = card.headline.length > 40 ? 64 : card.headline.length > 28 ? 76 : 84;
  const pane = (background: string, opacity = 1) => <div style={{ display: 'flex', flex: 1, background, opacity }} />;
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', background: OG.nave, color: OG.text, fontFamily: 'Instrument Sans', padding: '48px 64px 44px 56px', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', width: 380, height: 534, display: 'flex', borderRadius: '999px 999px 8px 8px', border: `8px solid ${OG.lead}`, overflow: 'hidden', background: OG.lead }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 8 }}>
          {pane(card.fromColor, 0.55)}
          <div style={{ height: 8 }} />
          {pane(card.fromColor, 0.4)}
          <div style={{ height: 8 }} />
          {pane(card.fromColor, 0.25)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {pane(card.toColor)}
          <div style={{ height: 8 }} />
          {pane(shade(card.toColor, 0.15))}
          <div style={{ height: 8 }} />
          {pane(card.toColor)}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 122,
            top: 199,
            width: 120,
            height: 120,
            borderRadius: 999,
            border: `8px solid ${OG.lead}`,
            background: OG.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Grenze Gotisch',
            fontWeight: 700,
            fontSize: 44,
            color: OG.onGold,
          }}
        >
          {card.glyph}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 56, minWidth: 0 }}>
        <div style={{ display: 'flex', fontSize: 22, color: OG.muted }}>{card.kicker}</div>
        <div style={{ display: 'flex', marginTop: 14, fontFamily: 'Grenze Gotisch', fontWeight: 800, fontSize: headlineSize, lineHeight: 0.92, color: OG.goldBright }}>{card.headline}</div>
        {card.quote ? (
          <div style={{ display: 'flex', marginTop: 24, fontFamily: 'Spectral', fontStyle: 'italic', fontSize: 28, lineHeight: 1.4, color: OG.text, maxWidth: 560 }}>{card.quote}</div>
        ) : null}
        <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `2px solid ${OG.edge}`, paddingTop: 18 }}>
          <div style={{ display: 'flex', fontFamily: 'Grenze Gotisch', fontWeight: 700, fontSize: 40, lineHeight: 1 }}>Gospel Wars</div>
          <div style={{ display: 'flex', fontSize: 20, color: OG.text2 }}>{card.scoreLine}</div>
        </div>
      </div>
    </div>
  );
}
