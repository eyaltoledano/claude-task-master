import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import {
	createRunDirectory,
	cleanupRunDirectory,
	validateRunDirectory,
	getRunDirectoryPath
} from '../../../../../packages/tm-core/src/storage/directory-manager.js';

describe('Directory Manager', () => {
	let testDir;
	let storageRoot;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = path.join(os.tmpdir(), `dir-test-${Date.now()}`);
		await fs.ensureDir(testDir);
		storageRoot = path.join(testDir, '.tdd-autopilot');
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.remove(testDir);
	});

	describe('createRunDirectory', () => {
		it('should create run directory with correct structure', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			expect(runDir).toBeDefined();
			expect(await fs.pathExists(runDir)).toBe(true);
		});

		it('should create activity.jsonl file', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const activityPath = path.join(runDir, 'activity.jsonl');

			expect(await fs.pathExists(activityPath)).toBe(true);
		});

		it('should create manifest.json file', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const manifestPath = path.join(runDir, 'manifest.json');

			expect(await fs.pathExists(manifestPath)).toBe(true);
		});

		it('should create state.json file', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const statePath = path.join(runDir, 'state.json');

			expect(await fs.pathExists(statePath)).toBe(true);
		});

		it('should create snapshots directory', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const snapshotsDir = path.join(runDir, 'snapshots');

			expect(await fs.pathExists(snapshotsDir)).toBe(true);
		});

		it('should use normalized project path in directory structure', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Directory should contain normalized project path
			expect(runDir).toContain('Users-test-projects-myapp');
		});

		it('should create nested directory structure', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Should follow pattern: storageRoot/normalizedPath/runId/
			const normalizedPath = 'Users-test-projects-myapp';
			const expectedPath = path.join(storageRoot, normalizedPath, runId);

			expect(runDir).toBe(expectedPath);
		});

		it('should throw error if directory already exists', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			await createRunDirectory(storageRoot, runId, projectPath);

			await expect(
				createRunDirectory(storageRoot, runId, projectPath)
			).rejects.toThrow('Run directory already exists');
		});

		it('should handle Windows project paths', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = 'C:\\Users\\test\\projects\\myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Should normalize Windows path
			expect(runDir).toContain('C-Users-test-projects-myapp');
		});

		it('should initialize manifest with metadata', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const manifestPath = path.join(runDir, 'manifest.json');

			const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

			expect(manifest.runId).toBe(runId);
			expect(manifest.metadata.projectRoot).toBe(projectPath);
		});

		it('should initialize empty activity log', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const activityPath = path.join(runDir, 'activity.jsonl');

			const content = await fs.readFile(activityPath, 'utf-8');

			// Should be empty
			expect(content).toBe('');
		});

		it('should initialize state with empty data', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const statePath = path.join(runDir, 'state.json');

			const state = JSON.parse(await fs.readFile(statePath, 'utf-8'));

			expect(state.data).toEqual({});
			expect(state.lastUpdated).toBeDefined();
		});

		it('should return absolute path to run directory', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			expect(path.isAbsolute(runDir)).toBe(true);
		});
	});

	describe('cleanupRunDirectory', () => {
		it('should delete run directory', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			await cleanupRunDirectory(runDir);

			const exists = await fs.pathExists(runDir);
			expect(exists).toBe(false);
		});

		it('should remove all files in directory', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Add some extra files
			await fs.writeFile(path.join(runDir, 'extra.txt'), 'test');
			await fs.writeFile(path.join(runDir, 'snapshots', 'snap1.json'), '{}');

			await cleanupRunDirectory(runDir);

			const exists = await fs.pathExists(runDir);
			expect(exists).toBe(false);
		});

		it('should not throw if directory does not exist', async () => {
			const nonExistentDir = path.join(storageRoot, 'nonexistent');

			await expect(cleanupRunDirectory(nonExistentDir)).resolves.not.toThrow();
		});

		it('should handle nested directory structures', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Create nested directories
			await fs.ensureDir(path.join(runDir, 'snapshots', 'nested', 'deep'));
			await fs.writeFile(
				path.join(runDir, 'snapshots', 'nested', 'deep', 'file.txt'),
				'test'
			);

			await cleanupRunDirectory(runDir);

			const exists = await fs.pathExists(runDir);
			expect(exists).toBe(false);
		});

		it('should be idempotent', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			await cleanupRunDirectory(runDir);
			await cleanupRunDirectory(runDir); // Second cleanup

			// Should not throw
			expect(await fs.pathExists(runDir)).toBe(false);
		});
	});

	describe('validateRunDirectory', () => {
		it('should validate correct directory structure', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			expect(() => validateRunDirectory(runDir)).not.toThrow();
		});

		it('should throw if directory does not exist', () => {
			const nonExistentDir = path.join(storageRoot, 'nonexistent');

			expect(() => validateRunDirectory(nonExistentDir)).toThrow(
				'does not exist'
			);
		});

		it('should throw if manifest.json is missing', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Remove manifest
			await fs.remove(path.join(runDir, 'manifest.json'));

			expect(() => validateRunDirectory(runDir)).toThrow('manifest.json');
		});

		it('should throw if activity.jsonl is missing', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Remove activity log
			await fs.remove(path.join(runDir, 'activity.jsonl'));

			expect(() => validateRunDirectory(runDir)).toThrow('activity.jsonl');
		});

		it('should throw if state.json is missing', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Remove state
			await fs.remove(path.join(runDir, 'state.json'));

			expect(() => validateRunDirectory(runDir)).toThrow('state.json');
		});

		it('should throw if snapshots directory is missing', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Remove snapshots directory
			await fs.remove(path.join(runDir, 'snapshots'));

			expect(() => validateRunDirectory(runDir)).toThrow('snapshots');
		});

		it('should validate synchronously', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);

			// Should not return a promise
			const result = validateRunDirectory(runDir);
			expect(result).toBeUndefined();
		});
	});

	describe('getRunDirectoryPath', () => {
		it('should generate correct path from runId and projectPath', () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = getRunDirectoryPath(storageRoot, runId, projectPath);

			const normalizedPath = 'Users-test-projects-myapp';
			const expectedPath = path.join(storageRoot, normalizedPath, runId);

			expect(runDir).toBe(expectedPath);
		});

		it('should handle Windows paths', () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = 'C:\\Users\\test\\projects\\myapp';

			const runDir = getRunDirectoryPath(storageRoot, runId, projectPath);

			expect(runDir).toContain('C-Users-test-projects-myapp');
		});

		it('should return absolute path', () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = getRunDirectoryPath(storageRoot, runId, projectPath);

			expect(path.isAbsolute(runDir)).toBe(true);
		});

		it('should be consistent with createRunDirectory', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const expectedPath = getRunDirectoryPath(storageRoot, runId, projectPath);
			const actualPath = await createRunDirectory(
				storageRoot,
				runId,
				projectPath
			);

			expect(actualPath).toBe(expectedPath);
		});
	});

	describe('Integration scenarios', () => {
		it('should support full workflow lifecycle', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			// Create
			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			expect(await fs.pathExists(runDir)).toBe(true);

			// Validate
			expect(() => validateRunDirectory(runDir)).not.toThrow();

			// Cleanup
			await cleanupRunDirectory(runDir);
			expect(await fs.pathExists(runDir)).toBe(false);
		});

		it('should handle multiple runs for same project', async () => {
			const runId1 = '2024-01-15T10:30:45.123Z';
			const runId2 = '2024-01-15T10:31:00.456Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir1 = await createRunDirectory(
				storageRoot,
				runId1,
				projectPath
			);
			const runDir2 = await createRunDirectory(
				storageRoot,
				runId2,
				projectPath
			);

			expect(await fs.pathExists(runDir1)).toBe(true);
			expect(await fs.pathExists(runDir2)).toBe(true);
			expect(runDir1).not.toBe(runDir2);
		});

		it('should handle multiple projects', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath1 = '/Users/test/projects/app1';
			const projectPath2 = '/Users/test/projects/app2';

			const runDir1 = await createRunDirectory(
				storageRoot,
				runId,
				projectPath1
			);
			const runDir2 = await createRunDirectory(
				storageRoot,
				runId,
				projectPath2
			);

			expect(await fs.pathExists(runDir1)).toBe(true);
			expect(await fs.pathExists(runDir2)).toBe(true);
			expect(runDir1).not.toBe(runDir2);
		});

		it('should preserve parent directories after cleanup', async () => {
			const runId = '2024-01-15T10:30:45.123Z';
			const projectPath = '/Users/test/projects/myapp';

			const runDir = await createRunDirectory(storageRoot, runId, projectPath);
			const projectDir = path.dirname(runDir);

			await cleanupRunDirectory(runDir);

			// Run directory should be gone
			expect(await fs.pathExists(runDir)).toBe(false);

			// Parent directories should still exist
			expect(await fs.pathExists(projectDir)).toBe(true);
			expect(await fs.pathExists(storageRoot)).toBe(true);
		});
	});
});
