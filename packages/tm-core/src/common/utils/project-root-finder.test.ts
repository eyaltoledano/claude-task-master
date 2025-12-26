/**
 * @fileoverview Integration tests for project root detection
 *
 * These tests verify real-world scenarios for project root detection,
 * particularly edge cases around:
 * - Empty directories (tm init scenario)
 * - .taskmaster in home/parent directories that should be ignored
 * - Monorepo detection
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findProjectRoot } from './project-root-finder.js';

describe('findProjectRoot - Integration Tests', () => {
	let tempDir: string;

	beforeEach(() => {
		// Create a temporary directory structure for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-integration-test-'));
	});

	afterEach(() => {
		// Clean up temp directory
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Empty directory scenarios (tm init)', () => {
		it('should find .taskmaster in immediate parent (depth=1) even without boundary marker', () => {
			// Scenario: User is in a subdirectory of a project that only has .taskmaster
			// (no .git or package.json). This is a valid use case for projects where
			// user ran `tm init` but not `git init`.
			//
			// Structure:
			//   /project/.taskmaster
			//   /project/src/ (start here)
			//
			// NOTE: For `tm init` command specifically, the command should use
			// process.cwd() directly instead of findProjectRoot() to avoid
			// finding a stray .taskmaster in a parent directory.

			const projectDir = tempDir;
			const srcDir = path.join(projectDir, 'src');

			fs.mkdirSync(path.join(projectDir, '.taskmaster'));
			fs.mkdirSync(srcDir);

			const result = findProjectRoot(srcDir);

			// Immediate parent (depth=1) is trusted even without boundary marker
			expect(result).toBe(projectDir);
		});

		it('should return startDir when running from completely empty directory', () => {
			// Scenario: User runs `tm init` in a brand new, completely empty directory
			// No markers anywhere in the tree
			//
			// Structure:
			//   /tmp/test/empty-project/ (empty)

			const emptyProjectDir = path.join(tempDir, 'empty-project');
			fs.mkdirSync(emptyProjectDir);

			const result = findProjectRoot(emptyProjectDir);

			// Should return the empty directory itself
			expect(result).toBe(emptyProjectDir);
		});

		it('should return startDir when no boundary markers exist but .taskmaster exists in distant parent', () => {
			// Scenario: Deep directory structure with .taskmaster only at top level
			// No boundary markers (.git, package.json, etc.) anywhere
			//
			// Structure:
			//   /tmp/home/.taskmaster (should be IGNORED - too far up)
			//   /tmp/home/code/projects/my-app/ (empty - no markers)

			const homeDir = tempDir;
			const deepProjectDir = path.join(homeDir, 'code', 'projects', 'my-app');

			fs.mkdirSync(path.join(homeDir, '.taskmaster'));
			fs.mkdirSync(deepProjectDir, { recursive: true });

			const result = findProjectRoot(deepProjectDir);

			// Should return the deep directory, not home
			expect(result).toBe(deepProjectDir);
		});
	});

	describe('Project with boundary markers', () => {
		it('should find .taskmaster when at same level as .git', () => {
			// Scenario: Normal project setup with both .taskmaster and .git
			//
			// Structure:
			//   /tmp/project/.taskmaster
			//   /tmp/project/.git

			const projectDir = tempDir;

			fs.mkdirSync(path.join(projectDir, '.taskmaster'));
			fs.mkdirSync(path.join(projectDir, '.git'));

			const result = findProjectRoot(projectDir);

			expect(result).toBe(projectDir);
		});

		it('should find .taskmaster in parent when subdirectory has no markers', () => {
			// Scenario: Running from a subdirectory of an initialized project
			//
			// Structure:
			//   /tmp/project/.taskmaster
			//   /tmp/project/.git
			//   /tmp/project/src/components/ (no markers)

			const projectDir = tempDir;
			const srcDir = path.join(projectDir, 'src', 'components');

			fs.mkdirSync(path.join(projectDir, '.taskmaster'));
			fs.mkdirSync(path.join(projectDir, '.git'));
			fs.mkdirSync(srcDir, { recursive: true });

			const result = findProjectRoot(srcDir);

			expect(result).toBe(projectDir);
		});

		it('should stop at .git and NOT find .taskmaster beyond it', () => {
			// Scenario: Project has .git but no .taskmaster, parent has .taskmaster
			// Should use project with .git, not parent with .taskmaster
			//
			// Structure:
			//   /tmp/home/.taskmaster (should be IGNORED)
			//   /tmp/home/my-project/.git (boundary marker)

			const homeDir = tempDir;
			const projectDir = path.join(homeDir, 'my-project');

			fs.mkdirSync(path.join(homeDir, '.taskmaster'));
			fs.mkdirSync(path.join(projectDir, '.git'), { recursive: true });

			const result = findProjectRoot(projectDir);

			expect(result).toBe(projectDir);
		});

		it('should stop at package.json and NOT find .taskmaster beyond it', () => {
			// Scenario: JS project with package.json but no .taskmaster
			//
			// Structure:
			//   /tmp/home/.taskmaster (should be IGNORED)
			//   /tmp/home/my-project/package.json (boundary)

			const homeDir = tempDir;
			const projectDir = path.join(homeDir, 'my-project');

			fs.mkdirSync(path.join(homeDir, '.taskmaster'));
			fs.mkdirSync(projectDir);
			fs.writeFileSync(path.join(projectDir, 'package.json'), '{}');

			const result = findProjectRoot(projectDir);

			expect(result).toBe(projectDir);
		});
	});

	describe('Monorepo scenarios', () => {
		it('should find monorepo root .taskmaster from package subdirectory', () => {
			// Scenario: Monorepo with .taskmaster at root, packages without their own markers
			//
			// Structure:
			//   /tmp/monorepo/.taskmaster
			//   /tmp/monorepo/.git
			//   /tmp/monorepo/packages/my-package/src/

			const monorepoRoot = tempDir;
			const packageSrcDir = path.join(
				monorepoRoot,
				'packages',
				'my-package',
				'src'
			);

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(path.join(monorepoRoot, '.git'));
			fs.mkdirSync(packageSrcDir, { recursive: true });

			const result = findProjectRoot(packageSrcDir);

			expect(result).toBe(monorepoRoot);
		});

		it('should return package root when package has its own boundary marker', () => {
			// Scenario: Monorepo where individual package has its own package.json
			// Package should be treated as its own project
			//
			// Structure:
			//   /tmp/monorepo/.taskmaster
			//   /tmp/monorepo/packages/my-package/package.json (boundary)

			const monorepoRoot = tempDir;
			const packageDir = path.join(monorepoRoot, 'packages', 'my-package');

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(packageDir, { recursive: true });
			fs.writeFileSync(path.join(packageDir, 'package.json'), '{}');

			const result = findProjectRoot(packageDir);

			// Package has its own boundary, so it should be returned
			expect(result).toBe(packageDir);
		});

		it('should return package root when package has its own .taskmaster', () => {
			// Scenario: Nested Task Master initialization
			//
			// Structure:
			//   /tmp/monorepo/.taskmaster
			//   /tmp/monorepo/packages/my-package/.taskmaster

			const monorepoRoot = tempDir;
			const packageDir = path.join(monorepoRoot, 'packages', 'my-package');

			fs.mkdirSync(path.join(monorepoRoot, '.taskmaster'));
			fs.mkdirSync(path.join(packageDir, '.taskmaster'), { recursive: true });

			const result = findProjectRoot(packageDir);

			// Package has its own .taskmaster, so it should be returned
			expect(result).toBe(packageDir);
		});
	});

	describe('Environment variable loading context', () => {
		it('should document that .env loading should use process.cwd(), not findProjectRoot()', () => {
			// IMPORTANT: For .env loading (e.g., TM_BASE_DOMAIN for auth),
			// the code should use process.cwd() directly, NOT findProjectRoot().
			//
			// findProjectRoot() is designed to find the .taskmaster directory
			// for task storage. It will traverse up to find .taskmaster in parent
			// directories when appropriate.
			//
			// For environment variables, we want to load from WHERE the user
			// is running the command, not where .taskmaster is located.
			//
			// This test documents this design decision and verifies findProjectRoot
			// behavior when .taskmaster is in immediate parent (depth=1).

			const projectDir = tempDir;
			const subDir = path.join(projectDir, 'subdir');

			fs.mkdirSync(path.join(projectDir, '.taskmaster'));
			fs.mkdirSync(subDir);

			const result = findProjectRoot(subDir);

			// findProjectRoot WILL find parent's .taskmaster (depth=1 is trusted)
			// This is correct for task storage - we want to use the parent's tasks.json
			// For .env loading, callers should use process.cwd() instead
			expect(result).toBe(projectDir);
		});
	});
});
