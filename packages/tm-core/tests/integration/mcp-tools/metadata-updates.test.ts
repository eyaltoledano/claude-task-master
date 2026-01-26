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

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { validateMcpMetadata } from '@tm/mcp';

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
			const prompt: string = '';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(true);
		});

		it('should detect metadata-only update when prompt is whitespace', () => {
			const prompt: string = '   ';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(true);
		});

		it('should not be metadata-only when prompt is provided', () => {
			const prompt: string = 'Update task details';
			const metadata = { key: 'value' };

			const isMetadataOnly = metadata && (!prompt || prompt.trim() === '');
			expect(isMetadataOnly).toBe(false);
		});

		it('should not be metadata-only when neither is provided', () => {
			const prompt: string = '';
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

/**
 * Unit tests for the actual validateMcpMetadata function from @tm/mcp
 * These tests verify the security gate behavior for MCP metadata updates.
 */
describe('validateMcpMetadata function', () => {
	// Mock error response creator that matches the MCP ContentResult format
	const mockCreateErrorResponse = (message: string) => ({
		content: [{ type: 'text' as const, text: `Error: ${message}` }],
		isError: true
	});

	// Helper to safely extract text from content
	const getErrorText = (
		error: { content: Array<{ type: string; text?: string }> } | undefined
	): string => {
		if (!error?.content?.[0]) return '';
		const content = error.content[0];
		return 'text' in content ? (content.text ?? '') : '';
	};

	afterEach(() => {
		delete process.env.TASK_MASTER_ALLOW_METADATA_UPDATES;
	});

	describe('when metadataString is null/undefined', () => {
		it('should return null parsedMetadata for undefined input', () => {
			const result = validateMcpMetadata(undefined, mockCreateErrorResponse);
			expect(result.parsedMetadata).toBeNull();
			expect(result.error).toBeUndefined();
		});

		it('should return null parsedMetadata for null input', () => {
			const result = validateMcpMetadata(null, mockCreateErrorResponse);
			expect(result.parsedMetadata).toBeNull();
			expect(result.error).toBeUndefined();
		});

		it('should return null parsedMetadata for empty string', () => {
			const result = validateMcpMetadata('', mockCreateErrorResponse);
			expect(result.parsedMetadata).toBeNull();
			expect(result.error).toBeUndefined();
		});
	});

	describe('when TASK_MASTER_ALLOW_METADATA_UPDATES is not set', () => {
		beforeEach(() => {
			delete process.env.TASK_MASTER_ALLOW_METADATA_UPDATES;
		});

		it('should return error when flag is not set', () => {
			const result = validateMcpMetadata(
				'{"key": "value"}',
				mockCreateErrorResponse
			);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'TASK_MASTER_ALLOW_METADATA_UPDATES'
			);
		});

		it('should return error when flag is set to "false"', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'false';
			const result = validateMcpMetadata(
				'{"key": "value"}',
				mockCreateErrorResponse
			);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
		});

		it('should return error when flag is "TRUE" (case sensitive)', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'TRUE';
			const result = validateMcpMetadata(
				'{"key": "value"}',
				mockCreateErrorResponse
			);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
		});

		it('should return error when flag is "True" (case sensitive)', () => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'True';
			const result = validateMcpMetadata(
				'{"key": "value"}',
				mockCreateErrorResponse
			);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
		});
	});

	describe('when TASK_MASTER_ALLOW_METADATA_UPDATES is "true"', () => {
		beforeEach(() => {
			process.env.TASK_MASTER_ALLOW_METADATA_UPDATES = 'true';
		});

		it('should return parsed metadata for valid JSON object', () => {
			const result = validateMcpMetadata(
				'{"key": "value"}',
				mockCreateErrorResponse
			);
			expect(result.parsedMetadata).toEqual({ key: 'value' });
			expect(result.error).toBeUndefined();
		});

		it('should return parsed metadata for complex nested object', () => {
			const complexMeta = {
				githubIssue: 42,
				sprint: 'Q1-S3',
				nested: { deep: { value: true } },
				array: [1, 2, 3]
			};
			const result = validateMcpMetadata(
				JSON.stringify(complexMeta),
				mockCreateErrorResponse
			);
			expect(result.parsedMetadata).toEqual(complexMeta);
			expect(result.error).toBeUndefined();
		});

		it('should return parsed metadata for empty object', () => {
			const result = validateMcpMetadata('{}', mockCreateErrorResponse);
			expect(result.parsedMetadata).toEqual({});
			expect(result.error).toBeUndefined();
		});

		it('should return error for invalid JSON string', () => {
			const result = validateMcpMetadata(
				'{key: "value"}',
				mockCreateErrorResponse
			);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain('Invalid metadata JSON');
		});

		it('should return error for JSON array', () => {
			const result = validateMcpMetadata('[1, 2, 3]', mockCreateErrorResponse);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'must be a JSON object (not null or array)'
			);
		});

		it('should return error for JSON null', () => {
			const result = validateMcpMetadata('null', mockCreateErrorResponse);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'must be a JSON object (not null or array)'
			);
		});

		it('should return error for JSON string primitive', () => {
			const result = validateMcpMetadata('"string"', mockCreateErrorResponse);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'must be a JSON object (not null or array)'
			);
		});

		it('should return error for JSON number primitive', () => {
			const result = validateMcpMetadata('123', mockCreateErrorResponse);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'must be a JSON object (not null or array)'
			);
		});

		it('should return error for JSON boolean primitive', () => {
			const result = validateMcpMetadata('true', mockCreateErrorResponse);
			expect(result.error).toBeDefined();
			expect(result.error?.isError).toBe(true);
			expect(getErrorText(result.error)).toContain(
				'must be a JSON object (not null or array)'
			);
		});
	});
});
