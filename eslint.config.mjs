import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.next/**', 'app/**', 'components/**', 'lib/**', 'supabase/**', 'next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
