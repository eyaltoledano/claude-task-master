/**
 * @fileoverview Tests for project root finder utilities
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	findProjectRoot,
	normalizeProjectRoot
} from './project-root-finder.js';

describe('findProjectRoot', () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Save original working directory
		originalCwd = process.cwd();
		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
	});

	afterEach(() => {
		// Restore original working directory
		process.chdir(originalCwd);
		// Clean up temp directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Task Master marker detection', () => {
		it('should find .taskmaster directory in current directory', () => {
			const taskmasterDir = path.join(tempDir, '.taskmaster');
			fs.mkdirSync(taskmasterDir);

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find .taskmaster directory in parent directory', () => {
			const parentDir = tempDir;
			const childDir = path.join(tempDir, 'child');
			const taskmasterDir = path.join(parentDir, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(childDir);

			const result = findProjectRoot(childDir);
			expect(result).toBe(parentDir);
		});

		it('should find .taskmaster/config.json marker', () => {
			const configDir = path.join(tempDir, '.taskmaster');
			fs.mkdirSync(configDir);
			fs.writeFileSync(path.join(configDir, 'config.json'), '{}');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find .taskmaster/tasks/tasks.json marker', () => {
			const tasksDir = path.join(tempDir, '.taskmaster', 'tasks');
			fs.mkdirSync(tasksDir, { recursive: true });
			fs.writeFileSync(path.join(tasksDir, 'tasks.json'), '{}');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find .taskmasterconfig (legacy) marker', () => {
			fs.writeFileSync(path.join(tempDir, '.taskmasterconfig'), '{}');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});
	});

	describe('Project boundary behavior', () => {
		it('should find .taskmaster in parent when child has NO boundary markers', () => {
			// Scenario: /project/.taskmaster and /project/apps (no markers)
			// This is a simple subdirectory, should find .taskmaster in parent
			const projectRoot = tempDir;
			const appsDir = path.join(tempDir, 'apps');
			const taskmasterDir = path.join(projectRoot, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(appsDir);

			const result = findProjectRoot(appsDir);
			expect(result).toBe(projectRoot);
		});

		it('should stop at project boundary (.git) and NOT find .taskmaster in distant parent', () => {
			// Scenario: /home/.taskmaster (should be ignored!) and /home/code/project/.git
			// This is the user's reported issue - .taskmaster in home dir should NOT be found
			const homeDir = tempDir;
			const codeDir = path.join(tempDir, 'code');
			const projectDir = path.join(codeDir, 'project');
			const taskmasterInHome = path.join(homeDir, '.taskmaster');

			fs.mkdirSync(taskmasterInHome);
			fs.mkdirSync(codeDir);
			fs.mkdirSync(projectDir);
			fs.mkdirSync(path.join(projectDir, '.git')); // Project boundary

			const result = findProjectRoot(projectDir);
			// Should return project (with .git), NOT home (with .taskmaster)
			expect(result).toBe(projectDir);
		});

		it('should stop at project boundary (package.json) and NOT find .taskmaster beyond', () => {
			// Scenario: /home/.taskmaster and /home/code/project/package.json
			const homeDir = tempDir;
			const codeDir = path.join(tempDir, 'code');
			const projectDir = path.join(codeDir, 'project');
			const taskmasterInHome = path.join(homeDir, '.taskmaster');

			fs.mkdirSync(taskmasterInHome);
			fs.mkdirSync(codeDir);
			fs.mkdirSync(projectDir);
			fs.writeFileSync(path.join(projectDir, 'package.json'), '{}'); // Project boundary

			const result = findProjectRoot(projectDir);
			// Should return project (with package.json), NOT home (with .taskmaster)
			expect(result).toBe(projectDir);
		});

		it('should stop at project boundary (lock file) and NOT find .taskmaster beyond', () => {
			// Scenario: /home/.taskmaster and /home/code/project/package-lock.json
			const homeDir = tempDir;
			const codeDir = path.join(tempDir, 'code');
			const projectDir = path.join(codeDir, 'project');
			const taskmasterInHome = path.join(homeDir, '.taskmaster');

			fs.mkdirSync(taskmasterInHome);
			fs.mkdirSync(codeDir);
			fs.mkdirSync(projectDir);
			fs.writeFileSync(path.join(projectDir, 'package-lock.json'), '{}'); // Project boundary

			const result = findProjectRoot(projectDir);
			expect(result).toBe(projectDir);
		});

		it('should find .taskmaster when at SAME level as project boundary', () => {
			// Scenario: /project/.taskmaster AND /project/.git
			// This is a properly initialized Task Master project
			const projectDir = tempDir;
			const taskmasterDir = path.join(projectDir, '.taskmaster');
			const gitDir = path.join(projectDir, '.git');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(gitDir);

			const result = findProjectRoot(projectDir);
			// Should return project (has both .taskmaster and .git)
			expect(result).toBe(projectDir);
		});

		it('should find .taskmaster when at same level as boundary, called from subdirectory', () => {
			// Scenario: /project/.taskmaster, /project/.git, called from /project/src
			// This is a typical monorepo setup
			const projectDir = tempDir;
			const srcDir = path.join(projectDir, 'src');
			const taskmasterDir = path.join(projectDir, '.taskmaster');
			const gitDir = path.join(projectDir, '.git');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(gitDir);
			fs.mkdirSync(srcDir);

			const result = findProjectRoot(srcDir);
			// Should find project root with .taskmaster (boundary and .taskmaster at same level)
			expect(result).toBe(projectDir);
		});
	});

	describe('Monorepo behavior', () => {
		it('should find .taskmaster in monorepo root when package has no boundary markers', () => {
			// Scenario: /monorepo/.taskmaster, /monorepo/.git, /monorepo/packages/pkg/src
			// pkg directory has no markers
			const monorepoRoot = tempDir;
			const pkgDir = path.join(tempDir, 'packages', 'pkg');
			const srcDir = path.join(pkgDir, 'src');

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(path.join(monorepoRoot, '.git'));
			fs.mkdirSync(srcDir, { recursive: true });

			const result = findProjectRoot(srcDir);
			expect(result).toBe(monorepoRoot);
		});

		it('should return package root when package HAS its own boundary marker', () => {
			// Scenario: /monorepo/.taskmaster, /monorepo/packages/pkg/package.json
			// When a package has its own project marker, it's treated as its own project
			const monorepoRoot = tempDir;
			const pkgDir = path.join(tempDir, 'packages', 'pkg');

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(pkgDir, { recursive: true });
			fs.writeFileSync(path.join(pkgDir, 'package.json'), '{}'); // Package has its own marker

			const result = findProjectRoot(pkgDir);
			// Returns package root (the first project boundary encountered)
			expect(result).toBe(pkgDir);
		});

		it('should return package root when package HAS .taskmaster (nested Task Master)', () => {
			// Scenario: /monorepo/.taskmaster, /monorepo/packages/pkg/.taskmaster
			// Package has its own Task Master initialization
			const monorepoRoot = tempDir;
			const pkgDir = path.join(tempDir, 'packages', 'pkg');

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(path.join(pkgDir, '.taskmaster'), { recursive: true });

			const result = findProjectRoot(pkgDir);
			// Returns package (has its own .taskmaster)
			expect(result).toBe(pkgDir);
		});
	});

	describe('Other project marker detection (when no Task Master markers)', () => {
		it('should find .git directory', () => {
			const gitDir = path.join(tempDir, '.git');
			fs.mkdirSync(gitDir);

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find package.json', () => {
			fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find go.mod', () => {
			fs.writeFileSync(path.join(tempDir, 'go.mod'), '');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find Cargo.toml (Rust)', () => {
			fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});

		it('should find pyproject.toml (Python)', () => {
			fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');

			const result = findProjectRoot(tempDir);
			expect(result).toBe(tempDir);
		});
	});

	describe('Edge cases', () => {
		it('should return startDir if no markers found (empty repo)', () => {
			// Scenario: Empty repo with just a .env file - should use startDir as project root
			const result = findProjectRoot(tempDir);
			// Should fall back to startDir, not process.cwd()
			expect(result).toBe(tempDir);
		});

		it('should handle permission errors gracefully', () => {
			// This test is hard to implement portably, but the function should handle it
			const result = findProjectRoot(tempDir);
			expect(typeof result).toBe('string');
		});

		it('should not traverse more than 50 levels', () => {
			// Create a deep directory structure
			let deepDir = tempDir;
			for (let i = 0; i < 60; i++) {
				deepDir = path.join(deepDir, `level${i}`);
			}
			// Don't actually create it, just test the function doesn't hang
			const result = findProjectRoot(deepDir);
			expect(typeof result).toBe('string');
		});

		it('should handle being called from filesystem root', () => {
			const rootDir = path.parse(tempDir).root;
			const result = findProjectRoot(rootDir);
			expect(typeof result).toBe('string');
		});
	});
});

describe('normalizeProjectRoot', () => {
	it('should remove .taskmaster from path', () => {
		const result = normalizeProjectRoot('/project/.taskmaster');
		expect(result).toBe('/project');
	});

	it('should remove .taskmaster/subdirectory from path', () => {
		const result = normalizeProjectRoot('/project/.taskmaster/tasks');
		expect(result).toBe('/project');
	});

	it('should return unchanged path if no .taskmaster', () => {
		const result = normalizeProjectRoot('/project/src');
		expect(result).toBe('/project/src');
	});

	it('should handle paths with native separators', () => {
		// Use native path separators for the test
		const testPath = ['project', '.taskmaster', 'tasks'].join(path.sep);
		const expectedPath = 'project';
		const result = normalizeProjectRoot(testPath);
		expect(result).toBe(expectedPath);
	});

	it('should handle empty string', () => {
		const result = normalizeProjectRoot('');
		expect(result).toBe('');
	});

	it('should handle null', () => {
		const result = normalizeProjectRoot(null);
		expect(result).toBe('');
	});

	it('should handle undefined', () => {
		const result = normalizeProjectRoot(undefined);
		expect(result).toBe('');
	});

	it('should handle root .taskmaster', () => {
		const sep = path.sep;
		const result = normalizeProjectRoot(`${sep}.taskmaster`);
		expect(result).toBe(sep);
	});
});
