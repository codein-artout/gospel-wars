import type { ApostleStyle, Archetype, RubricKey } from './config';

export type Traits = { openness: number; loyalty: number; pedantry: number; sociability: number; skepticism: number };

export type RubricScores = Record<RubricKey, number>;

/** The slice of agent state the rules engine works on. */
export type AgentState = {
  id: string;
  name: string;
  archetype: Archetype;
  traits: Traits;
  isBoss: boolean;
  /** Left the population to found a faith. */
  isFounder: boolean;
  faithId: string | null;
  conviction: number;
  /** faithId -> 0..100 */
  leanings: Record<string, number>;
  convertedAtTick: number | null;
  wins: number;
};

export type PreacherKind = 'apostle' | 'agent';

export type Outcome = 'converted' | 'doubted' | 'held' | 'heresy' | 'boss_held' | 'backlash';

export type { ApostleStyle };
