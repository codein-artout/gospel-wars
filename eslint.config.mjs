import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      'design/**',
      'node_modules/**',
      '.next/**',
      '.pglite*/**',
      'lib/db/generated/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': 'off',
    },
  },
  {
    // The rules engine is pure: no clocks, no ambient randomness, no I/O.
    files: ['lib/game/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in lib/game/rng.ts.' },
        { object: 'Date', property: 'now', message: 'lib/game is pure: pass the tick in.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'crypto', 'child_process'], message: 'lib/game is pure.' },
            { group: ['@/lib/db/*', '@/lib/llm/*', '@/lib/engine/*', '@prisma/*'], message: 'lib/game is pure.' },
          ],
        },
      ],
      'no-restricted-globals': ['error', { name: 'fetch', message: 'lib/game is pure.' }],
    },
  },
];

export default config;
