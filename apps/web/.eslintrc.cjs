module.exports = {
  extends: ['../../.eslintrc.cjs'],
  rules: {
    // Enforce monorepo boundaries at lint-time (build also enforces via scripts/validate-boundaries.mjs)
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@trendsinusa/db' }, { name: '@prisma/client' }, { name: 'dotenv' }],
        patterns: ['**/apps/worker/**', '**/scheduler/**'],
      },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Admin UI consumes some flexible JSON payloads (validated at runtime with shared Zod schemas).
    // Keep this as a warning to avoid blocking builds on intentional `any` usage.
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};

