/** @type {import('eslint').Linter.Config} */
module.exports = {
	root: true,
	env: {
		node: true,
		es2022: true
	},
	extends: ['eslint:recommended'],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: 'module'
	},
	plugins: ['@typescript-eslint'],
	rules: {
		// General code quality
		'no-console': 'warn',
		'prefer-const': 'error',
		'no-var': 'error',
		'object-shorthand': 'error',
		'prefer-template': 'error',
		'no-duplicate-imports': 'error',

		// TypeScript specific rules (basic)
		'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
	},
	ignorePatterns: [
		'dist/',
		'node_modules/',
		'coverage/',
		'*.js',
		'!.eslintrc.cjs'
	],
	overrides: [
		{
			files: ['**/*.test.ts', '**/*.spec.ts'],
			env: {
				jest: true
			},
			rules: {
				'no-console': 'off'
			}
		}
	]
};
