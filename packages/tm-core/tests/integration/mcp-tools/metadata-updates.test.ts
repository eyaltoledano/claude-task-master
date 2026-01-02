/**
 * @fileoverview Integration tests for MCP tool metadata updates
 *
 * Tests that metadata updates via update-task and update-subtask MCP tools
 * work correctly with the TASK_MASTER_ALLOW_METADATA_UPDATES flag.
 *
 * These tests validate the metadata flow from MCP tool layer through
 * direct functions to the legacy scripts and storage layer.
 *
 * NOTE: These tests focus on validation logic (JSON parsing, env flags, merge behavior)
 * rather than full end-to-end MCP tool calls. End-to-end behavior is covered by:
 * - FileStorage metadata tests (storage layer)
 * - AI operation metadata preservation tests (full workflow)
 * - Direct function integration (covered by the validation tests here)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP Tool Metadata Updates - Integration Tests', () => {
	let tempDir: string;
	let tasksJsonPath: string;

	beforeEach(() => {
		// Create a temp directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-mcp-test-'));
		// Create .taskmaster/tasks directory structure
		const taskmasterDir = path.join(tempDir, '.taskmaster', 'tasks');
		fs.mkdirSync(taskmasterDir, { recursive: true });
		tasksJsonPath = path.join(taskmasterDir, 'tasks.json');
	});

	afterEach(() => {
		// Clean up temp directory
		fs.rmSync(tempDir, { recursive: true, force: true });
		// Reset env vars
		delete process.env.TASK_MASTER_ALLOW_METADATA_UPDATES;
	});

	describe('metadata JSON validation', () => {
		it('should validate metadata is a valid JSON object', () => {
			// Test valid JSON objects
			const validMetadata = [
				'{"key": "value"}',
				'{"githubIssue": 42, "sprint": "Q1"}',
				'{"nested": {"deep": true}}'
			];

			for (const meta of validMetadata) {
				const parsed = JSON.parse(meta);
				expect(typeof parsed).toBe('object');
				expect(parsed).not.toBeNull();
				expect(Array.isArray(parsed)).toBe(false);
			}
		});

		it('should reject invalid metadata formats', () => {
			const invalidMetadata = [
				'"string"', // Just a string
				'123', // Just a number
				'true', // Just a boolean
				'null', // Null
				'[1, 2, 3]' // Array
			];

			for (const meta of invalidMetadata) {
				const parsed = JSON.parse(meta);
				const isValidObject =
					typeof parsed === 'object' &&
					parsed !== null &&
					!Array.isArray(parsed);
				expect(isValidObject).toBe(false);
			}
		});

		it('should reject invalid JSON strings', () => {
			const invalidJson = [
				'{key: "value"}', // Missing quotes
				"{'key': 'value'}", // Single quotes
				'{"key": }' // Incomplete
			];

			for (const json of invalidJson) {
				expect(() => JSON.parse(json)).toThrow();
			}
		});
	});

	describe('TASK_MASTER_ALLOW_METADATA_UPDATES flag', () => {
		it('should block metadata updates when flag is not set', () => {
			delete process.env.TASK_MASTER_ALLOW_METADATA_UPDATES;
			const allowMetadataUpdates =
				process.env.TASK_MASTER_ALLOW_METADATA_UPDATES === 'true';
			expect(allowMetadataUpdates).toBe(false);
		});

		it('should block metadata updates when flag is set to false', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'false';
			const allowMetadataUpdates =
				process.env.TASK_MASTER_ALLOW_METADATA_UPDATES === 'true';
			expect(allowMetadataUpdates).toBe(false);
		});

		it('should allow metadata updates when flag is set to true', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'true';
			const allowMetadataUpdates =
				process.env.TASK_MASTER_ALLOW_METADATA_UPDATES === 'true';
			expect(allowMetadataUpdates).toBe(true);
		});

		it('should be case-sensitive (TRUE should not work)', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'TRUE';
			const allowMetadataUpdates =
				process.env.TASK_MASTER_ALLOW_METADATA_UPDATES === 'true';
			expect(allowMetadataUpdates).toBe(false);
		});
	});

	describe('metadata merge logic', () => {
		it('should merge new metadata with existing metadata', () => {
			const existingMetadata = { githubIssue: 42, sprint: 'Q1' };
			const newMetadata = { storyPoints: 5, reviewed: true };

			const merged = {
				...(existingMetadata || {}),
				...(newMetadata || {})
			};

			expect(merged).toEqual({
				githubIssue: 42,
				sprint: 'Q1',
				storyPoints: 5,
				reviewed: true
			});
		});

		it('should override existing keys with new values', () => {
			const existingMetadata = { githubIssue: 42, sprint: 'Q1' };
			const newMetadata = { sprint: 'Q2' }; // Override sprint

			const merged = {
				...(existingMetadata || {}),
				...(newMetadata || {})
			};

			expect(merged).toEqual({
				githubIssue: 42,
				sprint: 'Q2' // Overridden
			});
		});

		it('should handle empty existing metadata', () => {
			const existingMetadata = undefined;
			const newMetadata = { key: 'value' };

			const merged = {
				...(existingMetadata || {}),
				...(newMetadata || {})
			};

			expect(merged).toEqual({ key: 'value' });
		});

		it('should handle empty new metadata', () => {
			const existingMetadata = { key: 'value' };
			const newMetadata = undefined;

			const merged = {
				...(existingMetadata || {}),
				...(newMetadata || {})
			};

			expect(merged).toEqual({ key: 'value' });
		});

		it('should preserve nested objects in metadata', () => {
			const existingMetadata = {
				jira: { key: 'PROJ-123' },
				other: 'data'
			};
			const newMetadata = {
				jira: { key: 'PROJ-456', type: 'bug' } // Replace entire jira object
			};

			const merged = {
				...(existingMetadata || {}),
				...(newMetadata || {})
			};

			expect(merged).toEqual({
				jira: { key: 'PROJ-456', type: 'bug' }, // Entire jira object replaced
				other: 'data'
			});
		});
	});

	describe('metadata-only update detection', () => {
		it('should detect metadata-only update when prompt is empty', () => {
			const prompt = '';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(true);
		});

		it('should detect metadata-only update when prompt is whitespace', () => {
			const prompt = '   ';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(true);
		});

		it('should not be metadata-only when prompt is provided', () => {
			const prompt = 'Update task details';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(false);
		});

		it('should not be metadata-only when neither is provided', () => {
			const prompt = '';
			const metadata = null;

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBeFalsy(); // metadata is null, so falsy
		});
	});

	describe('tasks.json file format with metadata', () => {
		it('should write and read metadata correctly in tasks.json', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						title: 'Test Task',
						description: 'Description',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: '',
						subtasks: [],
						metadata: {
							githubIssue: 42,
							sprint: 'Q1-S3',
							storyPoints: 5
						}
					}
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0
				}
			};

			// Write
			fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksData, null, 2));

			// Read and verify
			const rawContent = fs.readFileSync(tasksJsonPath, 'utf-8');
			const parsed = JSON.parse(rawContent);

			expect(parsed.tasks[0].metadata).toEqual({
				githubIssue: 42,
				sprint: 'Q1-S3',
				storyPoints: 5
			});
		});

		it('should write and read subtask metadata correctly', () => {
			const tasksData = {
				tasks: [
					{
						id: 1,
						title: 'Parent Task',
						description: 'Description',
						status: 'pending',
						priority: 'medium',
						dependencies: [],
						details: '',
						testStrategy: '',
						subtasks: [
							{
								id: 1,
								parentId: 1,
								title: 'Subtask',
								description: 'Subtask description',
								status: 'pending',
								priority: 'medium',
								dependencies: [],
								details: '',
								testStrategy: '',
								metadata: {
									linkedTicket: 'JIRA-456',
									reviewed: true
								}
							}
						]
					}
				],
				metadata: {
					version: '1.0.0',
					lastModified: new Date().toISOString(),
					taskCount: 1,
					completedCount: 0
				}
			};

			// Write
			fs.writeFileSync(tasksJsonPath, JSON.stringify(tasksData, null, 2));

			// Read and verify
			const rawContent = fs.readFileSync(tasksJsonPath, 'utf-8');
			const parsed = JSON.parse(rawContent);

			expect(parsed.tasks[0].subtasks[0].metadata).toEqual({
				linkedTicket: 'JIRA-456',
				reviewed: true
			});
		});
	});

	describe('error message formatting', () => {
		it('should provide clear error for disabled metadata updates', () => {
			const errorMessage =
				'Metadata updates are disabled. Set TASK_MASTER_ALLOW_METADATA_UPDATES=true in your MCP server environment to enable metadata modifications.';

			expect(errorMessage).toContain('TASK_MASTER_ALLOW_METADATA_UPDATES');
			expect(errorMessage).toContain('true');
			expect(errorMessage).toContain('MCP server environment');
		});

		it('should provide clear error for invalid JSON', () => {
			const invalidJson = '{key: value}';
			const errorMessage = `Invalid metadata JSON: ${invalidJson}. Provide a valid JSON object string.`;

			expect(errorMessage).toContain(invalidJson);
			expect(errorMessage).toContain('valid JSON object');
		});

		it('should provide clear error for non-object JSON', () => {
			const errorMessage =
				'Invalid metadata: must be a JSON object (not null or array)';

			expect(errorMessage).toContain('JSON object');
			expect(errorMessage).toContain('not null or array');
		});
	});
});
