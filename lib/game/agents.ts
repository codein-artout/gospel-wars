import type { Archetype, GameConfig } from './config';
import { ARCHETYPES } from './config';
import { seed } from './rng';
import type { Traits } from './types';
import { initialUnalignedConviction } from './rules/season';

/** Seed agents are generated from templates with a seeded RNG (GAME.md §2). */

const PERSONAS: Record<Archetype, readonly string[]> = {
  Keeper: [
    'Retired lighthouse keeper. Trusts routine, distrusts urgency.',
    'Keeps the village clock wound. Suspects anything that rings early.',
    'Night watchman of an empty museum. Believes in what stays put.',
    'Tends a garden of very slow plants. Measures faith in seasons.',
    'Former ferry pilot. Will cross over only when the water is calm.',
    'Archivist of lost umbrellas. Loyal to things nobody comes back for.',
  ],
  Clerk: [
    'Former tax clerk. Converts only for a clean argument.',
    'Inventory officer at a button factory. Counts before believing.',
    'Keeps minutes for a committee that no longer meets.',
    'Retired notary. Wants every promise signed twice.',
    'Postal sorter. Files every sermon under the right heading.',
    'Ledger keeper for a bakery. Trusts what balances.',
  ],
  Drifter: [
    'Restless. Joins whatever sounds newest.',
    'Hitchhiker of ideas. Has believed eleven things since spring.',
    'Seasonal fruit picker. Follows the harvest and the loudest hymn.',
    'Street juggler. Keeps several faiths in the air at once.',
    'Moves rooms every month. Never unpacks the last box.',
    'Collector of pamphlets. Reads the first page of everything.',
  ],
  Warmheart: [
    'Warm, chatty, easily swayed by kindness.',
    'Runs a soup kitchen. Believes whoever brought bread.',
    'Hugs strangers at bus stops. Converts for a good story.',
    'Knits scarves for anyone cold. Listens longer than most.',
    'Choir alto. Will sing along before she knows the words.',
    'Sends birthday cards to acquaintances. Remembers every name.',
  ],
  Pedant: [
    'A pedant. Counts contradictions out loud.',
    'Retired proofreader. Circles every misplaced comma in a sermon.',
    'Dictionary collector. Asks what each word in a doctrine means.',
    'Amateur logician. Wants premises before promises.',
    'Crossword setter. Suspects every clue of being a trick.',
    'Footnote enthusiast. Trusts what can be cited.',
  ],
  Lonely: [
    'Lonely. Values belonging over doctrine.',
    'Lives above a closed shop. Joins anything with a meeting.',
    'Widowed beekeeper. Talks to the hive, wants someone to answer.',
    'Night-shift baker. Looks for a faith that keeps late hours.',
    'Writes letters to no one in particular. Hopes someone replies.',
    'New in town. Will believe whatever the neighbors believe.',
  ],
  Contrarian: [
    'Contrarian by temperament.',
    'Argues with weather forecasts. Usually wins.',
    'Left three book clubs on principle. Joined a fourth to object.',
    'Takes the other side of every bet, then doubles it.',
    'Disagrees first and asks the question afterward.',
    'Heckler emeritus of the town debating society.',
  ],
  Worrier: [
    'Anxious. Wants a faith that promises order.',
    'Checks the stove four times. Wants a doctrine that checks itself.',
    'Carries an umbrella in drought. Prefers creeds with contingencies.',
    'Insurance enthusiast. Wants to know what the gospel covers.',
    'Counts exits in every room. Asks what happens after the sermon.',
    'Labels the spice jars twice. Wants rules written down.',
  ],
};

const VOICES: Record<Archetype, readonly string[]> = {
  Keeper: ['Speaks slowly, in short, weathered sentences.', 'Answers with a pause first, then a plain fact.'],
  Clerk: ['Speaks in tidy clauses and asks for totals.', 'Precise and dry, like a receipt read aloud.'],
  Drifter: ['Speaks in quick enthusiasms that trail off.', 'Light, curious, always mid-sentence about something new.'],
  Warmheart: ['Speaks warmly, with a small story attached.', 'Generous with praise, quick to agree.'],
  Pedant: ['Speaks in corrections and careful qualifications.', 'Numbers each objection, out loud.'],
  Lonely: ['Speaks softly and asks if you will come back.', 'Shy at first, then grateful for the company.'],
  Contrarian: ['Speaks in rebuttals, enjoys the friction.', 'Blunt, amused, answers a question with a question.'],
  Worrier: ['Speaks in what-ifs and nervous lists.', 'Polite and anxious, wants reassurance.'],
};

const BOSS_PERSONAS: readonly { persona: string; voice: string }[] = [
  { persona: 'Boss skeptic. Has heard every sermon twice and believed none of them.', voice: 'Speaks like an audit report: findings first, mercy never.' },
  { persona: 'Boss skeptic. Believes in nothing, and is very consistent about it.', voice: 'Speaks in flat zeros and long silences.' },
  { persona: 'Boss skeptic. Has listened to the radio between stations for sixty years.', voice: 'Speaks in crackles, fond and immovable.' },
];

/** Archetype nudges on top of the uniform trait draw. */
const BIAS: Record<Archetype, Partial<Traits>> = {
  Keeper: { loyalty: 18, openness: -8 },
  Clerk: { pedantry: 14, skepticism: 10 },
  Drifter: { openness: 20, loyalty: -20 },
  Warmheart: { sociability: 20, openness: 10, skepticism: -10 },
  Pedant: { pedantry: 24, skepticism: 8 },
  Lonely: { sociability: 14, loyalty: 8 },
  Contrarian: { skepticism: 18, loyalty: -14 },
  Worrier: { loyalty: 10, skepticism: -8, openness: -6 },
};

export type AgentSeed = {
  name: string;
  slug: string;
  seat: number;
  archetype: Archetype;
  persona: string;
  voice: string;
  traits: Traits;
  isBoss: boolean;
  bossTitle: string | null;
  conviction: number;
};

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds the world population: config.bossCount bosses seated in the inner ring at seats
 * 0, 3, 6, … and named agents everywhere else. All start Unaligned.
 */
export function generateAgents(names: readonly string[], worldSeed: string, config: GameConfig): AgentSeed[] {
  const total = config.worldSize;
  const bossSeats = new Set(Array.from({ length: config.bossCount }, (_, i) => i * 3));
  const out: AgentSeed[] = [];
  let n = 0;
  let b = 0;
  for (let seat = 0; seat < total; seat++) {
    const rng = seed(worldSeed, 0, 'agent', seat);
    if (bossSeats.has(seat) && b < config.bossCount) {
      const boss = config.bosses[b] ?? { name: `Boss ${b + 1}`, title: `Confessor ${b + 1}` };
      const p = BOSS_PERSONAS[b % BOSS_PERSONAS.length]!;
      const skepticism = rng.int(config.bossSkepticism.min, config.bossSkepticism.max);
      const traits: Traits = { openness: rng.int(15, 30), loyalty: rng.int(70, 85), pedantry: rng.int(60, 85), sociability: rng.int(15, 35), skepticism };
      out.push({ name: boss.name, slug: slugifyName(boss.name), seat, archetype: 'Contrarian', persona: p.persona, voice: p.voice, traits, isBoss: true, bossTitle: boss.title, conviction: initialUnalignedConviction(skepticism, config) });
      b++;
      continue;
    }
    const name = names[n] ?? `Agent ${n + 1}`;
    const archetype = ARCHETYPES[n % ARCHETYPES.length]!;
    const personaBank = PERSONAS[archetype];
    const persona = personaBank[Math.floor(n / ARCHETYPES.length) % personaBank.length]!;
    const voice = rng.pick(VOICES[archetype]);
    const { min, max } = config.traitRange;
    const bias = BIAS[archetype];
    const draw = (k: keyof Traits) => Math.min(max, Math.max(min, rng.int(min, max) + (bias[k] ?? 0)));
    const traits: Traits = { openness: draw('openness'), loyalty: draw('loyalty'), pedantry: draw('pedantry'), sociability: draw('sociability'), skepticism: draw('skepticism') };
    out.push({ name, slug: slugifyName(name), seat, archetype, persona, voice, traits, isBoss: false, bossTitle: null, conviction: initialUnalignedConviction(traits.skepticism, config) });
    n++;
  }
  return out;
}

/** Trait notes on the agent profile ("Will hear anyone out once."). */
export function traitNote(trait: keyof Traits, v: number): string {
  const hi = v >= 60;
  const lo = v < 40;
  switch (trait) {
    case 'openness':
      return hi ? 'Will hear anyone out once.' : lo ? 'Has heard enough, thank you.' : 'Listens, with conditions.';
    case 'loyalty':
      return hi ? 'Stays put unless the case is strong.' : lo ? 'Leaves when the music changes.' : 'Loyal until given a reason.';
    case 'pedantry':
      return hi ? 'Counts every contradiction.' : lo ? 'Forgives small contradictions.' : 'Notices the big contradictions.';
    case 'sociability':
      return hi ? 'Moved by what friends believe.' : lo ? 'Decides alone.' : 'Asks a friend, then decides.';
    case 'skepticism':
      return hi ? 'Asks what a promise is made of.' : lo ? 'Takes a promise at its word.' : 'Asks what a promise is made of.';
  }
}
