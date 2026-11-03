import type { ApostleStyle, GameConfig } from './config';
import { hash32, type Rng } from './rng';

const PREFIX = /^(?:the\s+)?(?:church|order|congregation|brethren|fellowship|society|house|temple|circle|assembly|company|guild|chapel|school|sisterhood|brotherhood|followers|keepers|friends)\s+of\s+(?:the\s+)?/i;

/** "Church of the Final Spreadsheet" -> "Final Spreadsheet"; "The Unbuffered" -> "Unbuffered". */
export function shortFaithName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const stripped = trimmed.replace(PREFIX, '').replace(/^the\s+/i, '');
  return stripped.length > 0 ? stripped : trimmed;
}

/** URL slug from a name. */
export function slugify(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'faith';
}

/** "Kettle of the Long Simmer": the parent's last noun plus a seeded qualifier. */
export function agentSchismFaithName(parentShortName: string, rng: Rng, config: GameConfig, taken: ReadonlySet<string>): string {
  const words = parentShortName.trim().split(/\s+/);
  const noun = words[words.length - 1] ?? parentShortName;
  const options = rng.shuffle(config.agentSchismQualifiers);
  for (const q of options) {
    const name = `${noun} of the ${q}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  let n = 2;
  while (taken.has(`${noun} of the ${options[0]} ${n}`.toLowerCase())) n++;
  return `${noun} of the ${options[0]} ${n}`;
}

const TITLES: Record<ApostleStyle, readonly string[]> = {
  Zealot: ['Deacon', 'Brother', 'Sister', 'Herald'],
  Gentle: ['Brother', 'Sister', 'Elder', 'Warden'],
  Scholar: ['Brother', 'Sister', 'Reader', 'Archivist'],
  Mystic: ['Sister', 'Brother', 'Seer', 'Cantor'],
  Troll: ['Saint', 'Brother', 'Sister', 'Uncle'],
};

/** Default apostle name from the faith's own words: "Brother Simmer", "Sister Perigee". */
export function defaultApostleName(faithShortName: string, style: ApostleStyle): string {
  const words = faithShortName.replace(/[^A-Za-z\s-]/g, '').split(/\s+/).filter((w) => w.length > 2);
  const noun = words[words.length - 1] ?? 'Verse';
  const titles = TITLES[style];
  const title = titles[hash32('apostle-title', faithShortName) % titles.length]!;
  return `${title} ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
}

/** Ordinal for ranks: 1st, 2nd, 3rd, 4th, 11th, 22nd. */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
const ORDINAL_WORDS = ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const TENS_ORD = ['', '', 'Twentieth', 'Thirtieth', 'Fortieth', 'Fiftieth', 'Sixtieth', 'Seventieth', 'Eightieth', 'Ninetieth'];

/** Capitalized number word for small counts: "Five agents followed." */
export function numberWord(n: number): string {
  if (n >= 0 && n < NUMBER_WORDS.length) return NUMBER_WORDS[n]!;
  return String(n);
}

/** "Fourteenth attempt." Ordinal words up to 99, digits after. */
export function ordinalWord(n: number): string {
  if (n >= 0 && n < ORDINAL_WORDS.length) return ORDINAL_WORDS[n]!;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS_ORD[t]!;
    return `${TENS[t]}-${ORDINAL_WORDS[u]!.toLowerCase()}`;
  }
  return ordinal(n);
}

/** "Forty" style cardinal words up to 99 (boss cards). */
export function cardinalWord(n: number): string {
  if (n >= 0 && n < 20) return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'][n]!;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t]! : `${TENS[t]}-${['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][u]}`;
  }
  return String(n);
}
