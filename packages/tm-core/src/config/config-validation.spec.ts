/**
 * @fileoverview Tests for ConfigManager validation integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './config-manager.js';
import type { PartialConfiguration } from '../interfaces/configuration.interface.js';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('ConfigManager Validation', () => {
	let tempDir: string;
	let manager: ConfigManager;

	beforeEach(async () => {
		// Create temporary directory for tests
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-config-test-'));

		// Create .taskmaster directory
		await fs.ensureDir(path.join(tempDir, '.taskmaster'));

		// Initialize ConfigManager
		manager = await ConfigManager.create(tempDir);
	});

	afterEach(async () => {
		// Cleanup
		if (tempDir) {
			await fs.remove(tempDir);
		}
	});

	describe('validate()', () => {
		it('should return validation result for partial configuration', () => {
			const result = manager.validate();

			// ConfigManager stores merged PartialConfiguration,
			// which may not have all required fields for full IConfiguration
			expect(result).toHaveProperty('isValid');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('warnings');
			expect(typeof result.isValid).toBe('boolean');
			expect(Array.isArray(result.errors)).toBe(true);
			expect(Array.isArray(result.warnings)).toBe(true);
		});

		it('should return validation result object with correct structure', () => {
			const result = manager.validate();

			expect(result).toHaveProperty('isValid');
			expect(result).toHaveProperty('errors');
			expect(result).toHaveProperty('warnings');
			expect(Array.isArray(result.errors)).toBe(true);
			expect(Array.isArray(result.warnings)).toBe(true);
		});
	});

	describe('validateUpdate()', () => {
		it('should validate valid workflow settings update', () => {
			const updates: PartialConfiguration = {
				workflow: {
					enableAutopilot: false,
					maxPhaseAttempts: 5,
					branchPattern: 'feature-{taskId}',
					requireCleanWorkingTree: false,
					autoStageChanges: false,
					includeCoAuthor: true,
					coAuthorName: 'Test Bot',
					coAuthorEmail: 'test@example.com',
					testThresholds: {
						minTests: 2,
						maxFailuresInGreen: 0
					},
					commitMessageTemplate: '{type}: {description}',
					allowedCommitTypes: ['feat', 'fix'],
					defaultCommitType: 'fix',
					operationTimeout: 120000,
					enableActivityLogging: false,
					activityLogPath: '.logs/activity.log',
					enableStateBackup: false,
					maxStateBackups: 3,
					abortOnMaxAttempts: true
				}
			};

			const result = manager.validateUpdate(updates);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject invalid email in workflow settings', () => {
			const invalidUpdates: PartialConfiguration = {
				workflow: {
					coAuthorEmail: 'not-an-email'
				}
			};

			const result = manager.validateUpdate(invalidUpdates);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject out-of-range maxPhaseAttempts', () => {
			const invalidUpdates: PartialConfiguration = {
				workflow: {
					maxPhaseAttempts: 15 // Max is 10
				}
			};

			const result = manager.validateUpdate(invalidUpdates);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject out-of-range operationTimeout', () => {
			const invalidUpdates: PartialConfiguration = {
				workflow: {
					operationTimeout: 500 // Min is 1000
				}
			};

			const result = manager.validateUpdate(invalidUpdates);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject too many state backups', () => {
			const invalidUpdates: PartialConfiguration = {
				workflow: {
					maxStateBackups: 25 // Max is 20
				}
			};

			const result = manager.validateUpdate(invalidUpdates);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should validate empty updates', () => {
			const emptyUpdates: PartialConfiguration = {};

			const result = manager.validateUpdate(emptyUpdates);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should validate model configuration updates', () => {
			const validUpdates: PartialConfiguration = {
				models: {
					main: 'gpt-4',
					fallback: 'gpt-3.5-turbo'
				}
			};

			const result = manager.validateUpdate(validUpdates);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject missing required model fields', () => {
			const invalidUpdates: PartialConfiguration = {
				models: {
					main: '', // Empty string should fail minimum length check
					fallback: 'test'
				}
			};

			const result = manager.validateUpdate(invalidUpdates);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('Real-world validation scenarios', () => {
		it('should validate complete workflow configuration', () => {
			const completeWorkflow: PartialConfiguration = {
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
					commitMessageTemplate:
						'{type}({scope}): {description} (Task {taskId}.{subtaskIndex})',
					allowedCommitTypes: ['feat', 'fix', 'refactor', 'test', 'docs', 'chore'],
					defaultCommitType: 'feat',
					operationTimeout: 60000,
					enableActivityLogging: true,
					activityLogPath: '.taskmaster/logs/workflow-activity.log',
					enableStateBackup: true,
					maxStateBackups: 5,
					abortOnMaxAttempts: false
				}
			};

			const result = manager.validateUpdate(completeWorkflow);

			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should provide helpful error messages for invalid configuration', () => {
			const invalidConfig: PartialConfiguration = {
				workflow: {
					coAuthorEmail: 'invalid-email',
					maxPhaseAttempts: 100,
					operationTimeout: 100
				}
			};

			const result = manager.validateUpdate(invalidConfig);

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);

			// Error messages should be strings
			result.errors.forEach((error) => {
				expect(typeof error).toBe('string');
			});
		});
	});
});
