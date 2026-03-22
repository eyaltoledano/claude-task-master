/**
 * Tests for handleApiResult tag field behavior
 *
 * Regression test for https://github.com/eyaltoledano/claude-task-master/issues/1638
 * Bug: handleApiResult returns the active tag from state.json instead of the
 * resolved target tag when a tag is explicitly provided to the operation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApiResult } from './utils.js';

// Mock fs and path to control getCurrentTag behavior
vi.mock('node:fs', () => ({
	default: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(() =>
			JSON.stringify({ currentTag: 'active-tag-from-state' })
		)
	}
}));

// Mock the package.json import
vi.mock('../../../../package.json', () => ({
	default: { version: '0.0.0-test', name: 'task-master-ai' }
}));

describe('handleApiResult tag field', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should use provided tag instead of reading from state.json', async () => {
		const result = await handleApiResult({
			result: {
				success: true,
				data: { taskId: 5, message: 'Success' }
			},
			projectRoot: '/mock/project',
			tag: 'target-tag'
		});

		const responseText = (result.content[0] as { type: 'text'; text: string }).text;
		const parsed = JSON.parse(responseText);

		// The tag field should be the explicitly provided tag, not the active tag
		expect(parsed.tag).toBe('target-tag');
	});

	it('should fall back to state.json tag when no tag is provided', async () => {
		const result = await handleApiResult({
			result: {
				success: true,
				data: { taskId: 5, message: 'Success' }
			},
			projectRoot: '/mock/project'
		});

		const responseText = (result.content[0] as { type: 'text'; text: string }).text;
		const parsed = JSON.parse(responseText);

		// Without explicit tag, it should read from state.json
		expect(parsed.tag).toBe('active-tag-from-state');
	});

	it('should not include tag field when neither tag nor projectRoot is provided', async () => {
		const result = await handleApiResult({
			result: {
				success: true,
				data: { taskId: 5, message: 'Success' }
			}
		});

		const responseText = (result.content[0] as { type: 'text'; text: string }).text;
		const parsed = JSON.parse(responseText);

		expect(parsed.tag).toBeUndefined();
	});

	it('should use provided tag in error responses too', async () => {
		const result = await handleApiResult({
			result: {
				success: false,
				error: { message: 'Something went wrong' }
			},
			projectRoot: '/mock/project',
			tag: 'target-tag'
		});

		// Error responses include tag in text format
		const responseText = (result.content[0] as { type: 'text'; text: string }).text;
		expect(responseText).toContain('Current Tag: target-tag');
		expect(responseText).not.toContain('active-tag-from-state');
	});
});
