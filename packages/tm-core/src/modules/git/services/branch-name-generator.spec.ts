import { describe, it, expect } from 'vitest';
import {
	generateBranchName,
	sanitizeBranchName
} from './branch-name-generator.js';

describe('Branch Name Generator', () => {
	describe('sanitizeBranchName', () => {
		it('should remove invalid characters', () => {
			const result = sanitizeBranchName('feature/my feature!');
			expect(result).toBe('feature-my-feature');
		});

		it('should replace spaces with hyphens', () => {
			const result = sanitizeBranchName('my feature branch');
			expect(result).toBe('my-feature-branch');
		});

		it('should convert to lowercase', () => {
			const result = sanitizeBranchName('MyFeature');
			expect(result).toBe('myfeature');
		});

		it('should remove consecutive hyphens', () => {
			const result = sanitizeBranchName('my---feature');
			expect(result).toBe('my-feature');
		});

		it('should handle empty string', () => {
			const result = sanitizeBranchName('');
			expect(result).toBe('branch');
		});
	});

	describe('generateBranchName', () => {
		it('should generate branch name from task ID', () => {
			const result = generateBranchName({ taskId: '2.7' });
			expect(result).toMatch(/^task-2-7-/);
		});

		it('should include description in branch name', () => {
			const result = generateBranchName({
				taskId: '2.7',
				description: 'Add Feature'
			});
			expect(result).toContain('task-2-7');
			expect(result).toContain('add-feature');
		});

		it('should handle custom pattern', () => {
			const result = generateBranchName({
				taskId: '2.7',
				pattern: 'feature/{taskId}'
			});
			expect(result).toBe('feature-2-7');
		});

		it('should truncate long descriptions', () => {
			const longDesc = 'a'.repeat(100);
			const result = generateBranchName({
				taskId: '2.7',
				description: longDesc
			});
			expect(result.length).toBeLessThan(80);
		});
	});
});
