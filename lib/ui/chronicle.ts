export const CHRONICLE_KINDS = [
  'conversion',
  'schism',
  'heresy',
  'boss_held',
  'boss_converted',
  'agent_preached',
  'silenced',
  'season',
] as const;
export type ChronicleKind = (typeof CHRONICLE_KINDS)[number];

export const KIND_LABEL: Record<ChronicleKind, string> = {
  conversion: 'Conversion',
  schism: 'Schism',
  heresy: 'Heresy flagged',
  boss_held: 'Boss held',
  boss_converted: 'Boss converted',
  agent_preached: 'Agent preached',
  silenced: 'Apostle silenced',
  season: 'Season',
};

export const KIND_COLOR: Record<ChronicleKind, string> = {
  conversion: 'var(--gold)',
  schism: 'var(--text)',
  heresy: 'var(--heresy-kind)',
  boss_held: 'var(--muted)',
  boss_converted: 'var(--gold-bright)',
  agent_preached: 'var(--grace)',
  silenced: 'var(--heresy-text)',
  season: 'var(--gold-bright)',
};
