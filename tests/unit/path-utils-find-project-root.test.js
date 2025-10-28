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

		test('should prioritize .taskmaster in parent over other markers in current directory', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// .git exists at /project/subdir, .taskmaster exists at /project
				if (normalized.includes('/project/subdir/.git')) return true;
				if (normalized.includes('/project/.taskmaster')) return true;
				return false;
			});

			const result = findProjectRoot('/project/subdir');

			// Should find /project (with .taskmaster) even though .git exists in /project/subdir
			// This is the two-pass priority behavior: Task Master markers in parent > other markers in current
			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should find parent .taskmaster even when subdirectory has git and go.mod (monorepo use case)', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// Simulate monorepo structure:
				// /monorepo/.taskmaster - parent Task Master tracking all work
				// /monorepo/service-a/.git - Git repository for service A
				// /monorepo/service-a/go.mod - Go project marker
				if (normalized.includes('/monorepo/.taskmaster')) return true;
				if (normalized.includes('/monorepo/service-a/.git')) return true;
				if (normalized.includes('/monorepo/service-a/go.mod')) return true;
				return false;
			});

			const result = findProjectRoot('/monorepo/service-a');

			// Should find /monorepo (with .taskmaster) NOT /monorepo/service-a (with .git and go.mod)
			// This is the core fix: .taskmaster in parent > other markers in subdirectory
			// OLD BEHAVIOR: Would return /monorepo/service-a (stopped at first marker found)
			// NEW BEHAVIOR: Returns /monorepo (prioritizes .taskmaster in parent)
			expect(result).toBe('/monorepo');

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

		test('should not treat generic tasks.json as Task Master marker (Cursor bugfix)', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// Parent has .taskmaster, subdirectory has generic tasks.json
				if (normalized.includes('/project/.taskmaster')) return true;
				if (normalized.includes('/project/subdir/tasks.json')) return true;
				return false;
			});

			const result = findProjectRoot('/project/subdir');

			// Should find parent .taskmaster, NOT stop at subdir's tasks.json
			// This proves tasks.json is correctly in second pass, not first pass
			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
		});

		test('should not treat generic tasks/tasks.json as Task Master marker', () => {
			const mockExistsSync = jest.spyOn(fs, 'existsSync');

			mockExistsSync.mockImplementation((checkPath) => {
				const normalized = path.normalize(checkPath);
				// Parent has .taskmaster, subdirectory has generic tasks/tasks.json
				if (normalized.includes('/project/.taskmaster')) return true;
				if (normalized.includes('/project/subdir/tasks/tasks.json')) return true;
				return false;
			});

			const result = findProjectRoot('/project/subdir');

			// Should find parent .taskmaster, NOT stop at subdir's tasks/tasks.json
			// This proves LEGACY_TASKS_FILE is correctly in second pass, not first pass
			expect(result).toBe('/project');

			mockExistsSync.mockRestore();
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
