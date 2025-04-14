import { jest, describe, test, expect } from '@jest/globals';
import { toKebabCase, detectCamelCaseFlags } from '../../scripts/modules/utils-cli.js';

describe('CLI Flag Format Validation', () => {
	test('toKebabCase should convert camelCase to kebab-case', () => {
		expect(toKebabCase('promptText')).toBe('prompt-text');
		expect(toKebabCase('userID')).toBe('user-id');
		expect(toKebabCase('numTasks')).toBe('num-tasks');
		expect(toKebabCase('alreadyKebabCase')).toBe('already-kebab-case');
	});

	test('detectCamelCaseFlags should identify camelCase flags', () => {
		const args = [
			'node',
			'task-master',
			'add-task',
			'--promptText=test',
			'--userID=123'
		];
		const flags = detectCamelCaseFlags(args);

		expect(flags).toHaveLength(2);
		expect(flags).toContainEqual({
			original: 'promptText',
			kebabCase: 'prompt-text'
		});
		expect(flags).toContainEqual({
			original: 'userID',
			kebabCase: 'user-id'
		});
	});

	test('detectCamelCaseFlags should not flag kebab-case flags', () => {
		const args = [
			'node',
			'task-master',
			'add-task',
			'--prompt-text=test',
			'--user-id=123'
		];
		const flags = detectCamelCaseFlags(args);

		expect(flags).toHaveLength(0);
	});

	test('detectCamelCaseFlags should respect single-word flags', () => {
		const args = [
			'node',
			'task-master',
			'add-task',
			'--prompt=test',
			'--file=test.json',
			'--priority=high',
			'--promptText=test'
		];
		const flags = detectCamelCaseFlags(args);

		// Should only flag promptText, not the single-word flags
		expect(flags).toHaveLength(1);
		expect(flags).toContainEqual({
			original: 'promptText',
			kebabCase: 'prompt-text'
		});
	});
}); 