/**
 * Kebab case validation tests
 */

import { jest } from '@jest/globals';
import { toKebabCase } from '../../scripts/modules/utils.js';

// Create a test implementation of detectCamelCaseFlags
function testDetectCamelCaseFlags(args) {
	const camelCaseFlags = [];
	for (const arg of args) {
		if (arg.startsWith('--')) {
			const flagName = arg.split('=')[0].slice(2); // Remove -- and anything after =

			// Skip single-word flags - they can't be camelCase
			if (!flagName.includes('-') && !/[A-Z]/.test(flagName)) {
				continue;
			}

			// Check for camelCase pattern (lowercase followed by uppercase)
			if (/[a-z][A-Z]/.test(flagName)) {
				const kebabVersion = toKebabCase(flagName);
				if (kebabVersion !== flagName) {
					camelCaseFlags.push({
						original: flagName,
						kebabCase: kebabVersion
					});
				}
			}
		}
	}
	return camelCaseFlags;
}

describe('Kebab Case Validation', () => {
	describe('toKebabCase', () => {
		test('should convert camelCase to kebab-case', () => {
			expect(toKebabCase('promptText')).toBe('prompt-text');
			expect(toKebabCase('userID')).toBe('user-id');
			expect(toKebabCase('numTasks')).toBe('num-tasks');
		});

		test('should handle already kebab-case strings', () => {
			expect(toKebabCase('already-kebab-case')).toBe('already-kebab-case');
			expect(toKebabCase('kebab-case')).toBe('kebab-case');
		});

		test('should handle single words', () => {
			expect(toKebabCase('single')).toBe('single');
			expect(toKebabCase('file')).toBe('file');
		});
	});

	describe('detectCamelCaseFlags', () => {
		test('should properly detect camelCase flags', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--promptText=test',
				'--userID=123'
			];
			const flags = testDetectCamelCaseFlags(args);

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

		test('should not flag kebab-case or lowercase flags', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--prompt=test',
				'--user-id=123'
			];
			const flags = testDetectCamelCaseFlags(args);

			expect(flags).toHaveLength(0);
		});

		test('should not flag any single-word flags regardless of case', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--prompt=test', // lowercase
				'--PROMPT=test', // uppercase
				'--Prompt=test', // mixed case
				'--file=test', // lowercase
				'--FILE=test', // uppercase
				'--File=test' // mixed case
			];
			const flags = testDetectCamelCaseFlags(args);

			expect(flags).toHaveLength(0);
		});

		test('should handle mixed case flags correctly', () => {
			const args = [
				'node',
				'task-master',
				'add-task',
				'--prompt=test', // single word, should pass
				'--promptText=test', // camelCase, should flag
				'--prompt-text=test', // kebab-case, should pass
				'--ID=123', // single word, should pass
				'--userId=123', // camelCase, should flag
				'--user-id=123' // kebab-case, should pass
			];

			const flags = testDetectCamelCaseFlags(args);

			expect(flags).toHaveLength(2);
			expect(flags).toContainEqual({
				original: 'promptText',
				kebabCase: 'prompt-text'
			});
			expect(flags).toContainEqual({
				original: 'userId',
				kebabCase: 'user-id'
			});
		});
	});
});
