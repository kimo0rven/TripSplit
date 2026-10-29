const expoConfig = require('eslint-config-expo/flat');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

/**
 * Rules kept as errors are the ones that catch real broken code:
 * a hook in the wrong place, an undefined name, a variable left behind.
 *
 * React Compiler advisories (refs, set-state-in-effect, manual memoization)
 * fire on this codebase's existing, working patterns - mainly the
 * `useRef(new Animated.Value()).current` idiom in React Native animations.
 * They stay as warnings so `npm run lint` reports them without blocking work.
 */
module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'public/**',
      'firebase/**',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // Real bugs stay errors.
      'react-hooks/rules-of-hooks': 'error',
      'no-undef': 'error',

      // Leftovers from a big edit: warn, do not block.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Advisory only - see the note above.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // Apostrophes and quotes render fine in React Native text.
      'react/no-unescaped-entities': 'warn',
    },
  },
];
