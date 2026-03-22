import { describe, expect, it } from 'vitest';
import { FormatHandler } from './format-handler.js';

describe('FormatHandler.resolveTag()', () => {
	const handler = new FormatHandler();

	it('should return the requested tag when it exists in legacy format', () => {
		const data = { foo: { tasks: [{ id: '1', title: 'T1' }] } };
		expect(handler.resolveTag(data, 'foo')).toBe('foo');
	});

	it('should fall back to first available tag when master is requested but absent', () => {
		const data = { 'my-feature': { tasks: [{ id: '1', title: 'T1' }] } };
		expect(handler.resolveTag(data, 'master')).toBe('my-feature');
	});

	it('should return master for standard format', () => {
		const data = { tasks: [{ id: '1' }], metadata: { version: '1.0.0' } };
		expect(handler.resolveTag(data, 'master')).toBe('master');
	});

	it('should return the requested tag for null data', () => {
		expect(handler.resolveTag(null, 'master')).toBe('master');
	});

	it('should be consistent with extractTasks tag resolution', () => {
		const data = {
			'feature-a': {
				tasks: [{ id: '1', title: 'T1', description: '', status: 'pending', priority: 'medium', dependencies: [], details: '', testStrategy: '', subtasks: [] }]
			}
		};
		const tasks = handler.extractTasks(data, 'master');
		const resolvedTag = handler.resolveTag(data, 'master');
		expect(tasks).toHaveLength(1);
		expect(resolvedTag).toBe('feature-a');
	});
});
