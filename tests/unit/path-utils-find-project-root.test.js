/**
 * Unit tests for findProjectRoot() function
 * Tests the parent directory traversal functionality
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs';

// Import the function to test
import { findProjectRoot } from '../../src/utils/path-utils.js';

describe('findProjectRoot', () => {
	describe('Parent Directory Traversal', () => {
		test('should find .taskmaster in parent directory', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// .taskmaster exists only at /project
				return normalized === path.normalize('/project/.taskmaster');
			});

			const result = findProjectRoot('/project/subdir');

			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should find .git in parent directory', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				return normalized === path.normalize('/project/.git');
			});

			const result = findProjectRoot('/project/subdir');

			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should find package.json in parent directory', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				return normalized === path.normalize('/project/package.json');
			});

			const result = findProjectRoot('/project/subdir');

			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should traverse multiple levels to find project root', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// Only exists at /project, not in any subdirectories
				return normalized === path.normalize('/project/.taskmaster');
			});

			const result = findProjectRoot('/project/subdir/deep/nested');

			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should return current directory as fallback when no markers found', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			// No project markers exist anywhere
			mockExistsSync.mockReturnValue(false);

			const result = findProjectRoot('/some/random/path');

			// Should fall back to process.cwd()
			expect(result).toBe(process.cwd());

			mockExistsSync.mockRestore();
		});

		test('should find markers at current directory before checking parent', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// .git exists at /project/subdir, .taskmaster exists at /project
				if (normalized.includes('/project/subdir/.git')) return true;
				if (normalized.includes('/project/.taskmaster')) return true;
				return false;
			});

			const result = findProjectRoot('/project/subdir');

			// Should find /project/subdir first because .git exists there,
			// even though .taskmaster is earlier in the marker array
			expect(result).toBe('/project/subdir');

			mockExistsSync.mockRestore();
		});

		test('should handle permission errors gracefully', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// Throw permission error for checks in /project/subdir
				if (normalized.startsWith('/project/subdir/')) {
					throw new Error('EACCES: permission denied');
				}
				// Return true only for .taskmaster at /project
				return normalized.includes('/project/.taskmaster');
			});

			const result = findProjectRoot('/project/subdir');

			// Should handle permission errors in subdirectory and traverse to parent
			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should detect filesystem root correctly', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			// No markers exist
			mockExistsSync.mockReturnValue(false);

			const result = findProjectRoot('/');

			// Should stop at root and fall back to process.cwd()
			expect(result).toBe(process.cwd());

			mockExistsSync.mockRestore();
		});

		test('should recognize various project markers', () => {
			const projectMarkers = [
				'.taskmaster',
				'.git',
				'package.json',
				'Cargo.toml',
				'go.mod',
				'pyproject.toml',
				'requirements.txt',
				'Gemfile',
				'composer.json'
			];

			projectMarkers.forEach((marker) => {
				const mockExistsSync = jest.spyOn(fs, 'existsSync');

				mockExistsSync.mockImplementation((checkPath) => {
					const normalized = path.normalize(checkPath);
					return normalized.includes(`/project/${marker}`);
				});

				const result = findProjectRoot('/project/subdir');

				expect(result).toBe('/project');

				mockExistsSync.mockRestore();
			});
		});
	});

	describe('Edge Cases', () => {
		test('should handle empty string as startDir', () => {
			const result = findProjectRoot('');

			// Should use process.cwd() or fall back appropriately
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		});

		test('should handle relative paths', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				// Simulate .git existing in the resolved path
				return checkPath.includes('.git');
			});

			const result = findProjectRoot('./subdir');

			expect(typeof result).toBe('string');

			mockExistsSync.mockRestore();
		});

		test('should not exceed max depth limit', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			// Track how many times existsSync is called
			let callCount = 0;
			mockExistsSync.mockImplementation(() => {
				callCount++;
				return false; // Never find a marker
			});

			// Create a very deep path
			const deepPath = '/a/'.repeat(100) + 'deep';
			const result = findProjectRoot(deepPath);

			// Should stop after max depth (50) and not check 100 levels
			// Each level checks multiple markers, so callCount will be high but bounded
			expect(callCount).toBeLessThan(1000); // Reasonable upper bound
			// With 18 markers and max depth of 50, expect around 900 calls maximum
			expect(callCount).toBeLessThanOrEqual(50 * 18);

			mockExistsSync.mockRestore();
		});
	});
});
