/**
 * @fileoverview Tests for configuration schema validation
 */

import { describe, it, expect } from 'vitest';
import {
	configurationSchema,
	partialConfigurationSchema,
	workflowSettingsSchema,
	validateConfiguration,
	validatePartialConfiguration
} from './config-schema.js';

describe('Configuration Schema Validation', () => {
	describe('workflowSettingsSchema', () => {
		it('should validate valid workflow settings', () => {
			const validWorkflow = {
				enableAutopilot: true,
				maxPhaseAttempts: 3,
				branchPattern: 'task-{taskId}',
				requireCleanWorkingTree: true,
				autoStageChanges: true,
				includeCoAuthor: true,
				coAuthorName: 'TaskMaster AI',
				coAuthorEmail: 'taskmaster@example.com',
				testThresholds: {
					minTests: 1,
					maxFailuresInGreen: 0
				},
				commitMessageTemplate:
					'{type}({scope}): {description} (Task {taskId}.{subtaskIndex})',
				allowedCommitTypes: ['feat', 'fix', 'refactor', 'test', 'docs'],
				defaultCommitType: 'feat',
				operationTimeout: 60000,
				enableActivityLogging: true,
				activityLogPath: '.taskmaster/logs/workflow-activity.log',
				enableStateBackup: true,
				maxStateBackups: 5,
				abortOnMaxAttempts: false
			};

			const result = workflowSettingsSchema.safeParse(validWorkflow);
			expect(result.success).toBe(true);
		});

		it('should reject invalid email format', () => {
			const invalidWorkflow = {
				coAuthorEmail: 'not-an-email'
			};

			const result = workflowSettingsSchema.safeParse(invalidWorkflow);
			expect(result.success).toBe(false);
		});

		it('should apply default values', () => {
			const minimalWorkflow = {};

			const result = workflowSettingsSchema.safeParse(minimalWorkflow);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.enableAutopilot).toBe(true);
				expect(result.data.maxPhaseAttempts).toBe(3);
				expect(result.data.branchPattern).toBe('task-{taskId}');
			}
		});

		it('should validate maxPhaseAttempts range', () => {
			const invalidAttempts = {
				maxPhaseAttempts: 0
			};

			const result = workflowSettingsSchema.safeParse(invalidAttempts);
			expect(result.success).toBe(false);
		});

		it('should validate operation timeout range', () => {
			const invalidTimeout = {
				operationTimeout: 500
			};

			const result = workflowSettingsSchema.safeParse(invalidTimeout);
			expect(result.success).toBe(false);
		});

		it('should validate maxStateBackups range', () => {
			const tooManyBackups = {
				maxStateBackups: 25
			};

			const result = workflowSettingsSchema.safeParse(tooManyBackups);
			expect(result.success).toBe(false);
		});
	});

	describe('validateConfiguration', () => {
		it('should validate complete valid configuration', () => {
			const validConfig = getMinimalValidConfig();

			const result = validateConfiguration(validConfig);
			if (!result.isValid) {
				console.error('Validation errors:', result.errors);
			}
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject configuration with missing required fields', () => {
			const invalidConfig = {
				projectPath: '',
				aiProvider: 'anthropic'
			};

			const result = validateConfiguration(invalidConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject configuration with invalid workflow settings', () => {
			const invalidConfig = {
				projectPath: '/project',
				aiProvider: 'anthropic',
				apiKeys: {},
				models: {
					main: 'claude-sonnet-4-20250514',
					fallback: 'claude-3-7-sonnet-20250219'
				},
				providers: {},
				tasks: {} as any,
				tags: {} as any,
				workflow: {
					coAuthorEmail: 'invalid-email',
					maxPhaseAttempts: 0
				},
				storage: {} as any,
				retry: {} as any,
				logging: {} as any,
				security: {} as any,
				version: '1.0.0',
				lastUpdated: new Date().toISOString()
			};

			const result = validateConfiguration(invalidConfig);
			expect(result.isValid).toBe(false);
			expect(result.errors.some((e) => e.includes('email'))).toBe(true);
		});
	});

	describe('validatePartialConfiguration', () => {
		it('should validate partial configuration with workflow only', () => {
			const partialConfig = {
				workflow: {
					enableAutopilot: false,
					maxPhaseAttempts: 5
				}
			};

			const result = validatePartialConfiguration(partialConfig);
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject invalid partial configuration', () => {
			const invalidPartial = {
				workflow: {
					coAuthorEmail: 'not-valid',
					maxPhaseAttempts: 100
				}
			};

			const result = validatePartialConfiguration(invalidPartial);
			expect(result.isValid).toBe(false);
		});

		it('should allow empty partial configuration', () => {
			const emptyPartial = {};

			const result = validatePartialConfiguration(emptyPartial);
			expect(result.isValid).toBe(true);
		});
	});

	describe('configurationSchema', () => {
		it('should enforce email format for coAuthorEmail', () => {
			const invalidEmail = {
				workflow: {
					coAuthorEmail: 'invalid'
				}
			};

			const result = configurationSchema.safeParse({
				...getMinimalValidConfig(),
				...invalidEmail
			});
			expect(result.success).toBe(false);
		});

		it('should enforce numeric ranges', () => {
			const outOfRange = {
				workflow: {
					maxPhaseAttempts: 15,
					operationTimeout: 500000
				}
			};

			const result = configurationSchema.safeParse({
				...getMinimalValidConfig(),
				...outOfRange
			});
			expect(result.success).toBe(false);
		});
	});
});

/**
 * Helper to get minimal valid config for testing
 */
function getMinimalValidConfig() {
	return {
		projectPath: '/test',
		aiProvider: 'test',
		apiKeys: {},
		models: {
			main: 'test-model',
			fallback: 'test-fallback'
		},
		providers: {},
		tasks: {
			defaultPriority: 'medium' as const,
			defaultComplexity: 'moderate' as const,
			maxSubtasks: 20,
			maxConcurrentTasks: 5,
			autoGenerateIds: true,
			validateDependencies: true,
			enableTimestamps: true,
			enableEffortTracking: true
		},
		tags: {
			enableTags: true,
			defaultTag: 'master',
			maxTagsPerTask: 10,
			autoCreateFromBranch: false,
			tagNamingConvention: 'kebab-case' as const
		},
		workflow: {
			enableAutopilot: true,
			maxPhaseAttempts: 3,
			branchPattern: 'task-{taskId}',
			requireCleanWorkingTree: true,
			autoStageChanges: true,
			includeCoAuthor: true,
			coAuthorName: 'TaskMaster AI',
			coAuthorEmail: 'taskmaster@example.com',
			testThresholds: {
				minTests: 1,
				maxFailuresInGreen: 0
			},
			commitMessageTemplate: '{type}: {description}',
			allowedCommitTypes: ['feat'],
			defaultCommitType: 'feat',
			operationTimeout: 60000,
			enableActivityLogging: true,
			activityLogPath: '.taskmaster/logs/workflow-activity.log',
			enableStateBackup: true,
			maxStateBackups: 5,
			abortOnMaxAttempts: false
		},
		storage: {
			type: 'auto' as const,
			enableBackup: true,
			maxBackups: 5,
			enableCompression: false,
			encoding: 'utf8' as BufferEncoding,
			atomicOperations: true
		},
		retry: {
			retryAttempts: 3,
			retryDelay: 1000,
			maxRetryDelay: 30000,
			backoffMultiplier: 2,
			requestTimeout: 30000,
			retryOnNetworkError: true,
			retryOnRateLimit: true
		},
		logging: {
			enabled: true,
			level: 'info' as const,
			logRequests: false,
			logPerformance: false,
			logStackTraces: true,
			maxFileSize: 10,
			maxFiles: 5
		},
		security: {
			validateApiKeys: true,
			enableRateLimit: true,
			maxRequestsPerMinute: 60,
			sanitizeInputs: true,
			maxPromptLength: 100000,
			allowedFileExtensions: ['.txt'],
			enableCors: false
		},
		version: '1.0.0',
		lastUpdated: new Date().toISOString()
	};
}
