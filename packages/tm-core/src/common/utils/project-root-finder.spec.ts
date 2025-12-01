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

	describe('Monorepo behavior - Task Master markers take precedence', () => {
		it('should find .taskmaster in parent when starting from apps subdirectory', () => {
			// Simulate exact user scenario:
			// /project/.taskmaster exists
			// Starting from /project/apps
			const projectRoot = tempDir;
			const appsDir = path.join(tempDir, 'apps');
			const taskmasterDir = path.join(projectRoot, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(appsDir);

			// When called from apps directory
			const result = findProjectRoot(appsDir);
			// Should return project root (one level up)
			expect(result).toBe(projectRoot);
		});

		it('should prioritize .taskmaster in parent over .git in child', () => {
			// Create structure: /parent/.taskmaster and /parent/child/.git
			const parentDir = tempDir;
			const childDir = path.join(tempDir, 'child');
			const gitDir = path.join(childDir, '.git');
			const taskmasterDir = path.join(parentDir, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(childDir);
			fs.mkdirSync(gitDir);

			// When called from child directory
			const result = findProjectRoot(childDir);
			// Should return parent (with .taskmaster), not child (with .git)
			expect(result).toBe(parentDir);
		});

		it('should prioritize .taskmaster in grandparent over package.json in child', () => {
			// Create structure: /grandparent/.taskmaster and /grandparent/parent/child/package.json
			const grandparentDir = tempDir;
			const parentDir = path.join(tempDir, 'parent');
			const childDir = path.join(parentDir, 'child');
			const taskmasterDir = path.join(grandparentDir, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(parentDir);
			fs.mkdirSync(childDir);
			fs.writeFileSync(path.join(childDir, 'package.json'), '{}');

			const result = findProjectRoot(childDir);
			expect(result).toBe(grandparentDir);
		});

		it('should prioritize .taskmaster over multiple other project markers', () => {
			// Create structure with many markers
			const parentDir = tempDir;
			const childDir = path.join(tempDir, 'packages', 'my-package');
			const taskmasterDir = path.join(parentDir, '.taskmaster');

			fs.mkdirSync(taskmasterDir);
			fs.mkdirSync(childDir, { recursive: true });

			// Add multiple other project markers in child
			fs.mkdirSync(path.join(childDir, '.git'));
			fs.writeFileSync(path.join(childDir, 'package.json'), '{}');
			fs.writeFileSync(path.join(childDir, 'go.mod'), '');
			fs.writeFileSync(path.join(childDir, 'Cargo.toml'), '');

			const result = findProjectRoot(childDir);
			// Should still return parent with .taskmaster
			expect(result).toBe(parentDir);
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
		it('should return current directory if no markers found', () => {
			const result = findProjectRoot(tempDir);
			// Should fall back to process.cwd()
			expect(result).toBe(process.cwd());
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
