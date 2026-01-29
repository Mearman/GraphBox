import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import nodePlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';
import regexpPlugin from 'eslint-plugin-regexp';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import noOnlyTests from 'eslint-plugin-no-only-tests';
import jsdoc from 'eslint-plugin-jsdoc';
import unicornPlugin from 'eslint-plugin-unicorn';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import vitestPlugin from '@vitest/eslint-plugin';
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import stylisticPlugin from '@stylistic/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

/**
 * Custom rule to ban emoji characters in source code.
 *
 * Unicode emoji matching approaches compared:
 *
 * - `\p{Emoji}` - Too broad: matches #, *, digits 0-9, which appear in normal code
 * - `\p{Emoji_Presentation}` - Too narrow: misses ❤, ⚠, ☀, ✉ and other common symbols
 * - `\p{Extended_Pictographic}` - Best balance: catches visual emoji without false positives
 *
 * Extended_Pictographic matches: 😀 🎉 🔥 ❤ ⬆ ⬇ ✔ ⚠ ℹ ☀ ❄ ✉ ⭐ © ® ™
 * Extended_Pictographic avoids:  # * 0 1 2 (no false positives on code characters)
 *
 * Note: © ® ™ are matched, which may appear in license headers. If needed,
 * add file-level eslint-disable comments for license files.
 *
 * @see https://www.stefanjudis.com/snippets/how-to-detect-emojis-in-javascript-strings/
 * @see https://unicode.org/reports/tr51/#Extended_Pictographic
 */
const noEmoji = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow emoji characters in source code',
    },
    messages: {
      noEmoji: 'Emoji characters are not allowed in source code. Found: "{{emoji}}"',
    },
    schema: [],
  },
  create(context) {
    // Unicode Extended_Pictographic property - catches emoji without false positives on #, *, digits
    const emojiPattern = /\p{Extended_Pictographic}/gu;

    const checkForEmoji = (node, value) => {
      const matches = value.match(emojiPattern);
      if (matches) {
        context.report({
          node,
          messageId: 'noEmoji',
          data: { emoji: matches.join(', ') },
        });
      }
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          checkForEmoji(node, node.value);
        }
      },
      TemplateElement(node) {
        checkForEmoji(node, node.value.raw);
      },
    };
  },
};

// Custom rule to enforce test file naming pattern
const enforceTestFileTypeNaming = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce test files to use type suffix (unit/integration/component)',
    },
    messages: {
      invalidTestFileName:
        'Test files must be named with a type suffix: {{name}}.unit.test.ts, {{name}}.integration.test.ts, or {{name}}.component.test.ts. Found: {{fileName}}',
    },
    schema: [],
  },
  create(context) {
    const fileName = context.filename;
    const testNameRegex = /^(.+)\.(unit|integration|component)\.test\.ts$/;

    if (fileName.endsWith('.test.ts') && !testNameRegex.test(fileName)) {
      const name = fileName.replace(/\.test\.ts$/, '');
      context.report({
        messageId: 'invalidTestFileName',
        data: {
          fileName: fileName,
          name: name,
        },
        loc: { line: 0, column: 0 },
      });
    }

    return {};
  },
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.config.ts',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['scripts/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
      n: nodePlugin,
      promise: promisePlugin,
      regexp: regexpPlugin,
      'simple-import-sort': simpleImportSort,
      'prefer-arrow-functions': preferArrowFunctions,
      jsdoc: jsdoc,
      unicorn: unicornPlugin,
      sonarjs: sonarjsPlugin,
      'custom-rules': {
        rules: {
          'no-emoji': noEmoji,
        },
      },
      '@eslint-community/eslint-comments': eslintCommentsPlugin,
      '@stylistic': stylisticPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // Custom rules
      'custom-rules/no-emoji': 'error',

      // Stylistic rules - tabs and double quotes
      '@stylistic/indent': ['error', 'tab'],
      '@stylistic/quotes': ['error', 'double', { avoidEscape: true }],
      '@stylistic/no-tabs': 'off', // Allow tabs since we're using them for indentation

      /**
       * Ban eslint-disable and similar comments in production code.
       * These rules are disabled for test files where they may be needed.
       *
       * Banned comments:
       * - eslint-disable, eslint-disable-line, eslint-disable-next-line
       * - @ts-ignore, @ts-expect-error, @ts-nocheck
       *
       * If you need to disable a rule, fix the underlying issue instead.
       */
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@eslint-community/eslint-comments/no-use': [
        'error',
        {
          allow: [], // disallow all eslint-disable comments in production code
        },
      ],

      // TypeScript rules - use unused-imports plugin for auto-fixing
      '@typescript-eslint/no-unused-vars': 'off', // Replaced by unused-imports/no-unused-vars
      'unused-imports/no-unused-imports': 'error', // Auto-fix unused imports
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // Ban @ts-ignore, @ts-expect-error, @ts-nocheck (part of disable comment ban above)
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false, // allow @ts-check
        },
      ],
      // Type-aware rules (require projectService)
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'warn', // Async without await is often intentional for interface compliance
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn', // Sometimes false positives with complex types
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Style preference, can introduce subtle bugs with 0/''
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn', // Type safety, but often false positives
      '@typescript-eslint/no-unsafe-return': 'warn', // Type safety, but often false positives
      '@typescript-eslint/no-unsafe-argument': 'warn', // Type safety, but often false positives

      // Forbid type coercion - enforce === and !==
      eqeqeq: ['error', 'always', { null: 'ignore' }], // Enforce === and !==, allow == null for convenience

      'prefer-const': 'warn', // Style preference

      // Import rules
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
      'import/no-relative-packages': 'error',
      'import/no-cycle': 'error',
      'import/no-default-export': 'error',
      'import/order': 'off', // Using simple-import-sort instead

      // Promise rules
      ...promisePlugin.configs['flat/recommended'].rules,

      // Regexp rules
      ...regexpPlugin.configs['flat/recommended'].rules,

      // Simple import sort
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Prefer arrow functions
      'prefer-arrow-functions/prefer-arrow-functions': [
        'error',
        {
          classPropertiesAllowed: false,
          disallowPrototype: false,
          returnStyle: 'unchanged',
          singleReturnOnly: false,
        },
      ],

      // JSDoc rules
      ...jsdoc.configs['flat/recommended-typescript'].rules,
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-yields': 'off',
      'jsdoc/require-yields-type': 'off',
      'jsdoc/require-throws-type': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/escape-inline-tags': 'off',
      'jsdoc/tag-lines': 'off',
      'jsdoc/check-tag-names': 'warn',

      // Unicorn rules (spread recommended, then override noisy ones to warn)
      ...unicornPlugin.configs['flat/recommended'].rules,
      'unicorn/prevent-abbreviations': 'warn',
      'unicorn/no-null': 'warn',
      'unicorn/no-array-sort': 'warn',
      'unicorn/prefer-export-from': 'warn',
      'unicorn/prefer-single-call': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prefer-number-properties': 'warn',
      'unicorn/no-new-array': 'warn',
      'unicorn/prefer-top-level-await': 'off', // CLI files need different patterns
      'unicorn/no-process-exit': 'off', // CLI files need process.exit
      'unicorn/no-array-reduce': 'warn',
      'unicorn/import-style': 'warn',
      'unicorn/no-immediate-mutation': 'warn',
      'unicorn/no-array-reverse': 'warn',
      'unicorn/consistent-function-scoping': 'warn',
      'unicorn/text-encoding-identifier-case': 'warn',
      'unicorn/no-useless-switch-case': 'warn',
      'unicorn/no-nested-ternary': 'warn',
      'unicorn/no-empty-file': 'warn',
      'unicorn/no-array-for-each': 'warn',

      // SonarJS rules (spread recommended, then override noisy ones to warn)
      ...sonarjsPlugin.configs.recommended.rules,
      'sonarjs/cognitive-complexity': 'warn',
      'sonarjs/no-alphabetical-sort': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/redundant-type-aliases': 'warn',
      'sonarjs/todo-tag': 'warn',
      'sonarjs/updated-loop-counter': 'warn',
      'sonarjs/pseudo-random': 'warn',
      'sonarjs/unused-import': 'off', // Duplicates @typescript-eslint/no-unused-vars
      'sonarjs/no-unused-vars': 'off', // Duplicates @typescript-eslint/no-unused-vars
      'sonarjs/different-types-comparison': 'warn',
      'sonarjs/prefer-regexp-exec': 'warn',
      'sonarjs/no-dead-store': 'warn',
      'sonarjs/use-type-alias': 'warn',
      'sonarjs/class-name': 'warn',
      'sonarjs/slow-regex': 'warn',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/regex-complexity': 'warn',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-clear-text-protocols': 'warn',
      'sonarjs/function-return-type': 'warn',
      'sonarjs/arguments-order': 'warn',

      // Regexp rules - downgrade some noisy ones
      'regexp/no-unused-capturing-group': 'warn',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  // Test files configuration
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      vitest: vitestPlugin,
      'no-only-tests': noOnlyTests,
      'enforce-test-file-type': {
        rules: {
          'enforce-test-file-type': enforceTestFileTypeNaming,
        },
      },
    },
    rules: {
      // Enforce test file naming
      'enforce-test-file-type/enforce-test-file-type': 'error',
      // Relax rules for tests
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@eslint-community/eslint-comments/no-use': 'off',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'off',
      'jsdoc/require-jsdoc': 'off',
      'vitest/no-conditional-expect': 'off',
      'vitest/no-disabled-tests': 'off',
      'no-only-tests/no-only-tests': 'error',
    },
  }
);

