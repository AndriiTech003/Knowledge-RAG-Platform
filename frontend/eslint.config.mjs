import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

const noComments = {
  meta: { type: 'suggestion', docs: { description: 'disallow comments in source code' }, schema: [] },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({
            loc: comment.loc,
            message: 'Comments are not allowed in source code (project convention).',
          });
        }
      },
    };
  },
};

const local = { rules: { 'no-comments': noComments } };

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.angular/**', 'playwright-report/**', 'test-results/**', 'storybook-static/**', 'lighthouse/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: { globals: { ...globals.browser } },
    plugins: { local },
    rules: {
      'local/no-comments': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'kb', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'kb', style: 'kebab-case' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
    },
  },
  {
    files: ['src/app/core/api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-var': 'off',
      '@angular-eslint/prefer-inject': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': 'off',
      'prefer-const': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', 'src/testing/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
  {
    files: ['scripts/**/*.mjs', '*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { local },
    rules: { 'local/no-comments': 'error' },
  },
);
