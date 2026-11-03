import type { ApostleStyle } from '../../lib/game/config';

/** Seed world data from design/mockups/source (names, faiths, prophets, apostles). All invented. */

export const WORLD = { slug: 'nave', name: 'The Nave', seed: 'gw-world-1' } as const;

/** The 45 named agents from Main.dc.html (bosses come from GameConfig.bosses). */
export const AGENT_NAMES = [
  'Dolores', 'Quill', 'Ferro-7', 'Auntie Byte', 'Marguerite', 'Osk', 'Pim', 'Tolliver', 'Sable', 'Wren', 'Juniper', 'Cass', 'Ignatius', 'Mott', 'Beryl',
  'Odo', 'Lark', 'Vesper', 'Hollis', 'Nim', 'Saffi', 'Grout', 'Ines', 'Barnaby', 'Tamsin', 'Rook', 'Clementine', 'Esk', 'Mabel', 'Thorne',
  'Piety-3', 'Fen', 'Ottoline', 'Gus', 'Rhea', 'Bram', 'Lumen', 'Cosmo', 'Ada-Lace', 'Wick', 'Ysolde', 'Pell', 'Hesper', 'Tuck', 'Morrow',
] as const;

export type SeedFaithSpec = {
  slug: string;
  name: string;
  color: string;
  style: ApostleStyle;
  apostleName: string;
  prophet: { handle: string; email: string; name: string };
  /** Founding flock at tick 0. */
  founding: number;
  /** Forked from this faith's slug at forkTick (a human schism). */
  forkOf?: string;
  forkTick?: number;
};

export const SEED_FAITHS: SeedFaithSpec[] = [
  { slug: 'final-spreadsheet', name: 'Church of the Final Spreadsheet', color: '#2F5FD8', style: 'Scholar', apostleName: 'Brother Ledger', prophet: { handle: 'ledgerwitch', email: 'ledgerwitch@gospelwars.test', name: 'Ledger Witch' }, founding: 9 },
  { slug: 'patient-kettle', name: 'Order of the Patient Kettle', color: '#EDA53A', style: 'Gentle', apostleName: 'Brother Simmer', prophet: { handle: 'slowboil', email: 'slowboil@gospelwars.test', name: 'Slow Boil' }, founding: 8 },
  { slug: 'second-moon', name: 'Congregation of the Second Moon', color: '#A57BEA', style: 'Mystic', apostleName: 'Sister Perigee', prophet: { handle: 'moonclerk', email: 'moonclerk@gospelwars.test', name: 'Moon Clerk' }, founding: 7 },
  { slug: 'open-door', name: 'Brethren of the Open Door', color: '#2DA877', style: 'Gentle', apostleName: 'Warden Hinge', prophet: { handle: 'hingeworks', email: 'hingeworks@gospelwars.test', name: 'Hinge Works' }, founding: 5 },
  { slug: 'unbuffered', name: 'The Unbuffered', color: '#24A3B5', style: 'Troll', apostleName: 'Pingback', prophet: { handle: 'latency_saint', email: 'latency_saint@gospelwars.test', name: 'Latency Saint' }, founding: 7 },
  { slug: 'reformed-kettle', name: 'The Reformed Kettle', color: '#D8435F', style: 'Zealot', apostleName: 'Deacon Boilover', prophet: { handle: 'hotwater', email: 'hotwater@gospelwars.test', name: 'Hot Water' }, founding: 0, forkOf: 'patient-kettle', forkTick: 132 },
];
