import type { GameConfig, LlmRole } from '@/lib/game/config';
import { MockProvider } from './mock';
import type { LLMProvider } from './provider';
import { OUTPUT_SCHEMAS, type RoleInputs, type RoleOutputs } from './schemas';

/** A hard per-tick cap on real model calls (llmMaxCallsPerTick). */
export class CallBudget {
  private used = 0;
  constructor(readonly limit: number) {}
  tryConsume(): boolean {
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }
  get calls(): number {
    return this.used;
  }
  get exhausted(): boolean {
    return this.used >= this.limit;
  }
}

export type LLMResult<R extends LlmRole> = { value: RoleOutputs[R]; fallback: boolean; provider: string };

/**
 * The LLM layer the engine talks to: validated output, one retry, then the deterministic
 * MockProvider with fallback = true. Past the call budget, every call goes to Mock.
 */
export class LLMClient {
  private fallbacks = 0;
  readonly mock: MockProvider;

  constructor(
    private readonly primary: LLMProvider,
    private readonly config: GameConfig,
    readonly budget: CallBudget = new CallBudget(config.llmMaxCallsPerTick),
    private readonly onError: (role: LlmRole, error: unknown) => void = () => undefined,
  ) {
    this.mock = primary instanceof MockProvider ? primary : new MockProvider(config);
  }

  get providerName(): string {
    return this.primary.name;
  }
  get fallbackCount(): number {
    return this.fallbacks;
  }

  async run<R extends LlmRole>(role: R, input: RoleInputs[R]): Promise<LLMResult<R>> {
    const schema = OUTPUT_SCHEMAS[role];
    if (this.primary === this.mock) {
      // Mock calls are free but still counted, so budgets behave the same in tests.
      this.budget.tryConsume();
      return { value: this.mock.produce(role, input), fallback: false, provider: this.mock.name };
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!this.budget.tryConsume()) break;
      try {
        const value = (await this.primary.generate(role, input, schema)) as RoleOutputs[R];
        return { value, fallback: false, provider: this.primary.name };
      } catch (e) {
        this.onError(role, e);
      }
    }
    this.fallbacks++;
    return { value: this.mock.produce(role, input), fallback: true, provider: this.mock.name };
  }
}
