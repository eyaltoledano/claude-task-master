/**
 * Unit Tests for TaskMaster Integration Tools
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
	listTasksInputSchema,
	getTaskInputSchema,
	getNextTaskInputSchema,
	getCurrentContextInputSchema,
	listTasksTool,
	getTaskTool,
	getNextTaskTool,
	getCurrentContextTool
} from '../../../src/tools/taskmaster.js';

describe('TaskMaster Integration Tools', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('Input Schemas', () => {
		describe('listTasksInputSchema', () => {
			it('should use default values', () => {
				const result = listTasksInputSchema.parse({});
				expect(result.status).toBe('all');
				expect(result.tag).toBeUndefined();
				expect(result.withSubtasks).toBe(false);
			});

			it('should accept valid status values', () => {
				const validStatuses = ['all', 'pending', 'in-progress', 'done', 'blocked', 'cancelled'];
				for (const status of validStatuses) {
					expect(() => listTasksInputSchema.parse({ status })).not.toThrow();
				}
			});

			it('should reject invalid status values', () => {
				expect(() => listTasksInputSchema.parse({ status: 'invalid' })).toThrow();
			});

			it('should accept custom values', () => {
				const result = listTasksInputSchema.parse({
					status: 'pending',
					tag: 'feature-x',
					withSubtasks: true
				});
				expect(result.status).toBe('pending');
				expect(result.tag).toBe('feature-x');
				expect(result.withSubtasks).toBe(true);
			});
		});

		describe('getTaskInputSchema', () => {
			it('should require id', () => {
				expect(() => getTaskInputSchema.parse({})).toThrow();
				expect(() => getTaskInputSchema.parse({ id: '5' })).not.toThrow();
			});

			it('should accept task IDs', () => {
				expect(getTaskInputSchema.parse({ id: '1' }).id).toBe('1');
				expect(getTaskInputSchema.parse({ id: '15' }).id).toBe('15');
			});

			it('should accept subtask IDs', () => {
				expect(getTaskInputSchema.parse({ id: '1.2' }).id).toBe('1.2');
				expect(getTaskInputSchema.parse({ id: '15.3' }).id).toBe('15.3');
			});
		});

		describe('getNextTaskInputSchema', () => {
			it('should accept empty input', () => {
				expect(() => getNextTaskInputSchema.parse({})).not.toThrow();
			});

			it('should accept optional tag', () => {
				const result = getNextTaskInputSchema.parse({ tag: 'feature-x' });
				expect(result.tag).toBe('feature-x');
			});
		});

		describe('getCurrentContextInputSchema', () => {
			it('should accept empty input', () => {
				expect(() => getCurrentContextInputSchema.parse({})).not.toThrow();
			});

			it('should be an empty object schema', () => {
				const result = getCurrentContextInputSchema.parse({});
				expect(result).toEqual({});
			});
		});
	});

	describe('Tool Definitions', () => {
		describe('listTasksTool', () => {
			it('should have correct description', () => {
				expect(listTasksTool.description).toContain('task');
				expect(listTasksTool.description).toContain('status');
			});

			it('should have execute function', () => {
				expect(typeof listTasksTool.execute).toBe('function');
			});
		});

		describe('getTaskTool', () => {
			it('should have correct description', () => {
				expect(getTaskTool.description).toContain('task');
				expect(getTaskTool.description).toContain('ID');
			});

			it('should have execute function', () => {
				expect(typeof getTaskTool.execute).toBe('function');
			});
		});

		describe('getNextTaskTool', () => {
			it('should have correct description', () => {
				expect(getNextTaskTool.description).toContain('next');
				expect(getNextTaskTool.description).toContain('dependencies');
			});

			it('should have execute function', () => {
				expect(typeof getNextTaskTool.execute).toBe('function');
			});
		});

		describe('getCurrentContextTool', () => {
			it('should have correct description', () => {
				expect(getCurrentContextTool.description).toContain('context');
				expect(getCurrentContextTool.description).toContain('in-progress');
			});

			it('should have execute function', () => {
				expect(typeof getCurrentContextTool.execute).toBe('function');
			});
		});
	});
});

