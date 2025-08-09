/** @type {import('jest').Config} */
export default {
	preset: 'ts-jest/presets/default-esm',
	extensionsToTreatAsEsm: ['.ts'],
	testEnvironment: 'node',
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	testMatch: [
		'**/tests/**/*.test.ts',
		'**/tests/**/*.spec.ts',
		'**/__tests__/**/*.ts',
		'**/?(*.)+(spec|test).ts'
	],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					module: 'ESNext',
					target: 'ES2022'
				}
			}
		]
	},
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@/types/(.*)$': '<rootDir>/src/types/$1',
		'^@/providers/(.*)$': '<rootDir>/src/providers/$1',
		'^@/storage/(.*)$': '<rootDir>/src/storage/$1',
		'^@/parser/(.*)$': '<rootDir>/src/parser/$1',
		'^@/utils/(.*)$': '<rootDir>/src/utils/$1',
		'^@/errors/(.*)$': '<rootDir>/src/errors/$1'
	},
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/index.ts'],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80
		}
	},
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	testTimeout: 10000,
	verbose: true,
	clearMocks: true,
	restoreMocks: true
};
