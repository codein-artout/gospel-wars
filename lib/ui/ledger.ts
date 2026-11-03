import type { LedgerItem } from '@/components/encounter/RollLedger';
import type { GameConfig } from '@/lib/game/config';
import type { RollInput, RollResult } from '@/lib/game/rules/encounter';

const f3 = (n: number) => n.toFixed(3);
const sgn = (n: number) => (n >= 0 ? `+${f3(n)}` : `−${f3(Math.abs(n))}`);

/** Every number from the stored roll, in reading order (the RollLedger on the encounter page). */
export function ledgerItems(input: { roll: RollResult; input: RollInput; config: GameConfig; ownFaith: string; preacherFaith: string; isBoss: boolean; converted: boolean; newConviction: number | null }): LedgerItem[] {
  const { roll, config } = input;
  const items: LedgerItem[] = [
    { label: 'Persuasion score S', value: f3(roll.S) },
    { label: input.isBoss ? 'Resistance R, floored for a boss' : 'Resistance R, from conviction and skepticism', value: f3(roll.R) },
    { label: `Seeded noise, range ±${f3(roll.noiseRange)}`, value: sgn(roll.noise) },
  ];
  if (roll.styleMod !== 0) items.push({ label: input.input.preacher.kind === 'agent' ? 'Convert preacher modifier' : `${input.input.preacher.style} style modifier`, value: sgn(roll.styleMod) });
  if (roll.social !== 0) items.push({ label: `Social proof at ${input.input.preacher.faithSharePct.toFixed(1)}% share`, value: sgn(roll.social) });
  const formula = ['S − R + noise', roll.styleMod !== 0 ? 'style' : '', roll.social !== 0 ? 'social' : ''].filter(Boolean).join(' + ');
  items.push({ label: `Pull = ${formula}`, value: f3(roll.pull), strong: true });
  if (roll.bossCapped) items.push({ label: `S below ${config.bossMinScore}: a boss cannot be moved`, value: 'Capped at 0' });
  items.push({ label: `Conviction in ${input.ownFaith}`, value: `${roll.convictionBefore} to ${roll.convictionRolled}` });
  items.push({ label: `Leaning toward ${input.preacherFaith}`, value: `${roll.leaningBefore} to ${roll.leaningRolled}` });
  if (roll.backlash) items.push({ label: 'Backlash: leaning and conviction after', value: `${roll.leaningAfter} and ${roll.convictionAfter}`, accent: 'heresy' });
  const threshold = input.isBoss ? config.bossConversionThreshold : config.conversionThreshold;
  items.push({ label: `Converts at leaning ${threshold} and above conviction${input.isBoss ? `, with S ≥ ${config.bossMinScore}` : ''}`, value: roll.converts ? 'Yes' : 'No', accent: roll.converts ? 'gold' : undefined });
  if (input.converted && input.newConviction !== null) items.push({ label: `New conviction, leaning × ${config.convertCarry}`, value: String(input.newConviction) });
  return items;
}

export const OUTCOME_LABEL: Record<string, { text: string; tone: 'gold' | 'muted' | 'heresy' | 'grace' }> = {
  converted: { text: 'Converted', tone: 'gold' },
  doubted: { text: 'Doubted', tone: 'muted' },
  held: { text: 'Held', tone: 'muted' },
  boss_held: { text: 'Boss held', tone: 'muted' },
  heresy: { text: 'Heresy, voided', tone: 'heresy' },
  backlash: { text: 'Backlash', tone: 'muted' },
};
