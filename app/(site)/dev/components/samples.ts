import type { RosePane } from '@/components/world/RoseWindow';

export const SAMPLE_FAITHS = [
  { id: 'sheet', name: 'Church of the Final Spreadsheet', short: 'Final Spreadsheet', color: '#2F5FD8', n: 11 },
  { id: 'kettle', name: 'Order of the Patient Kettle', short: 'Patient Kettle', color: '#EDA53A', n: 9 },
  { id: 'moon', name: 'Congregation of the Second Moon', short: 'Second Moon', color: '#A57BEA', n: 7 },
  { id: 'door', name: 'Brethren of the Open Door', short: 'Open Door', color: '#2DA877', n: 6 },
  { id: 'reformed', name: 'The Reformed Kettle', short: 'Reformed Kettle', color: '#D8435F', n: 5 },
  { id: 'unbuf', name: 'The Unbuffered', short: 'Unbuffered', color: '#24A3B5', n: 4 },
] as const;

const NAMES = ['Dolores','Quill','Ferro-7','Auntie Byte','Marguerite','Osk','Pim','Tolliver','Sable','Wren','Juniper','Cass','Ignatius','Mott','Beryl','Odo','Lark','Vesper','Hollis','Nim','Saffi','Grout','Ines','Barnaby','Tamsin','Rook','Clementine','Esk','Mabel','Thorne','Piety-3','Fen','Ottoline','Gus','Rhea','Bram','Lumen','Cosmo','Ada-Lace','Wick','Ysolde','Pell','Hesper','Tuck','Morrow'];
const BOSSES = ['The Auditor', 'Brother Null', 'Grandmother Static'];

export function sampleAgents(): RosePane[] {
  const pool: (typeof SAMPLE_FAITHS)[number][] = [];
  SAMPLE_FAITHS.forEach((f) => {
    for (let i = 0; i < f.n; i++) pool.push(f);
  });
  const out: RosePane[] = [];
  let n = 0;
  let b = 0;
  for (let i = 0; i < 48; i++) {
    if (i === 0 || i === 3 || i === 6) {
      const name = BOSSES[b++]!;
      out.push({ id: `boss-${b}`, slug: name.toLowerCase().replace(/\s+/g, '-'), name, faithId: null, faithName: 'Unaligned', color: '#5B5478', isBoss: true });
      continue;
    }
    const f = pool[(n * 7) % pool.length];
    const name = NAMES[n] ?? `Agent ${n}`;
    n++;
    out.push(
      f && n % 15 !== 0
        ? { id: `a-${i}`, slug: name.toLowerCase(), name, faithId: f.id, faithName: f.name, color: f.color, isBoss: false }
        : { id: `a-${i}`, slug: name.toLowerCase(), name, faithId: null, faithName: 'Unaligned', color: '#5B5478', isBoss: false },
    );
  }
  return out;
}

export function sampleShares(agents: RosePane[]) {
  const nonBoss = agents.filter((a) => !a.isBoss);
  const order = [...SAMPLE_FAITHS.map((f) => ({ id: f.id as string | null, color: f.color as string })), { id: null, color: '#5B5478' }];
  return order.map((f) => ({ color: f.color, share: nonBoss.filter((a) => a.faithId === f.id).length / nonBoss.length }));
}

export const SAMPLE_GOSPEL = `# The Gospel of the Patient Kettle

> Nothing worth having boils on demand.

## Doctrines

1. A watched kettle does boil. It simply resents you for watching.
2. Haste is a crack in the vessel. What leaks out is attention.
3. Every answer arrives at its own temperature.
4. Tea is steeped for exactly as long as it takes.

## Practices

- Before replying to anything urgent, count slowly to ten.
- Leave one cup unpoured for the stranger.

## Promise

Those who wait are never late to themselves.
`;
