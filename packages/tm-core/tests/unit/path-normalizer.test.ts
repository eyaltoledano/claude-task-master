import { describe, it, expect } from 'vitest';
import {
	normalizeProjectPath,
	denormalizeProjectPath,
	isValidNormalizedPath
} from '../../src/utils/path-normalizer.js';

describe('Path Normalizer', () => {
	describe('normalizeProjectPath', () => {
		it('should replace forward slashes with hyphens', () => {
			const input = '/Users/test/projects/my-app';
			const expected = 'Users-test-projects-my-app';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should replace backslashes with hyphens (Windows paths)', () => {
			const input = 'C:\\Users\\test\\projects\\my-app';
			const expected = 'C-Users-test-projects-my-app';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should remove leading slashes', () => {
			const input = '/root/project';
			const expected = 'root-project';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should remove leading backslashes', () => {
			const input = '\\root\\project';
			const expected = 'root-project';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle mixed slashes', () => {
			const input = '/Users/test\\mixed/path';
			const expected = 'Users-test-mixed-path';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle paths with special characters', () => {
			const input = '/projects/my app (v2)';
			const expected = 'projects-my app (v2)';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle relative paths', () => {
			const input = './projects/app';
			const expected = '.-projects-app';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle empty string', () => {
			const input = '';
			const expected = '';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle single directory', () => {
			const input = 'project';
			const expected = 'project';
			expect(normalizeProjectPath(input)).toBe(expected);
		});

		it('should handle multiple consecutive slashes', () => {
			const input = '/Users//test///project';
			const expected = 'Users-test-project';
			expect(normalizeProjectPath(input)).toBe(expected);
		});
	});

	describe('denormalizeProjectPath', () => {
		it('should convert hyphens back to forward slashes', () => {
			const input = 'Users-test-projects-my-app';
			const expected = 'Users/test/projects/my-app';
			expect(denormalizeProjectPath(input)).toBe(expected);
		});

		it('should handle single directory', () => {
			const input = 'project';
			const expected = 'project';
			expect(denormalizeProjectPath(input)).toBe(expected);
		});

		it('should handle empty string', () => {
			const input = '';
			const expected = '';
			expect(denormalizeProjectPath(input)).toBe(expected);
		});

		it('should preserve path with special characters', () => {
			const input = 'projects-my app (v2)';
			const expected = 'projects/my app (v2)';
			expect(denormalizeProjectPath(input)).toBe(expected);
		});
	});

	describe('isValidNormalizedPath', () => {
		it('should return true for valid normalized path', () => {
			expect(isValidNormalizedPath('Users-test-projects-my-app')).toBe(true);
		});

		it('should return true for single directory', () => {
			expect(isValidNormalizedPath('project')).toBe(true);
		});

		it('should return false for paths with slashes', () => {
			expect(isValidNormalizedPath('Users/test/project')).toBe(false);
		});

		it('should return false for paths with backslashes', () => {
			expect(isValidNormalizedPath('Users\\test\\project')).toBe(false);
		});

		it('should return true for empty string', () => {
			expect(isValidNormalizedPath('')).toBe(true);
		});

		it('should return true for path with special characters', () => {
			expect(isValidNormalizedPath('my-app (v2)')).toBe(true);
		});
	});

	describe('Round-trip conversion', () => {
		it('should maintain path structure after normalize and denormalize', () => {
			const originalPaths = [
				'/Users/test/projects/my-app',
				'C:\\Users\\test\\project',
				'/root/deep/nested/path',
				'./relative/path'
			];

			for (const original of originalPaths) {
				const normalized = normalizeProjectPath(original);
				const denormalized = denormalizeProjectPath(normalized);

				// Normalize both for comparison (convert backslashes to forward slashes)
				const normalizedOriginal = original.replace(/\\/g, '/').replace(/^\//, '');
				const normalizedResult = denormalized;

				expect(normalizedResult).toBe(normalizedOriginal);
			}
		});
	});

	describe('Cross-platform consistency', () => {
		it('should produce same normalized output for Unix and Windows paths pointing to same location', () => {
			const unixPath = '/Users/test/project';
			const windowsPath = 'C:\\Users\\test\\project';

			const normalizedUnix = normalizeProjectPath(unixPath);
			const normalizedWindows = normalizeProjectPath(windowsPath);

			// Both should have hyphens instead of slashes
			expect(normalizedUnix).not.toContain('/');
			expect(normalizedUnix).not.toContain('\\');
			expect(normalizedWindows).not.toContain('/');
			expect(normalizedWindows).not.toContain('\\');
		});
	});
});
