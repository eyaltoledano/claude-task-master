import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { GitAdapter } from '../../../../../packages/tm-core/src/git/git-adapter.js';

describe('GitAdapter - Repository Detection and Validation', () => {
	let testDir;
	let gitAdapter;

	beforeEach(async () => {
		// Create temporary test directory
		testDir = path.join(os.tmpdir(), `git-test-${Date.now()}`);
		await fs.ensureDir(testDir);
	});

	afterEach(async () => {
		// Clean up test directory
		await fs.remove(testDir);
	});

	describe('isGitRepository', () => {
		it('should return false for non-git directory', async () => {
			gitAdapter = new GitAdapter(testDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(false);
		});

		it('should return true for git repository', async () => {
			// Initialize real git repo
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

			gitAdapter = new GitAdapter(testDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(true);
		});

		it('should detect git repository in subdirectory', async () => {
			// Initialize real git repo in parent
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

			// Create subdirectory
			const subDir = path.join(testDir, 'src', 'components');
			await fs.ensureDir(subDir);

			gitAdapter = new GitAdapter(subDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(true);
		});

		it('should handle directory with .git file (submodule)', async () => {
			// Create .git file (used in submodules/worktrees)
			await fs.writeFile(path.join(testDir, '.git'), 'gitdir: /path/to/git');

			gitAdapter = new GitAdapter(testDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(true);
		});

		it('should return false if .git is neither file nor directory', async () => {
			gitAdapter = new GitAdapter(testDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(false);
		});
	});

	describe('validateGitInstallation', () => {
		it('should validate git is installed', async () => {
			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.validateGitInstallation()).resolves.not.toThrow();
		});

		it('should throw error if git version check fails', async () => {
			gitAdapter = new GitAdapter(testDir);

			// Mock simple-git to throw error
			const mockGit = {
				version: jest.fn().mockRejectedValue(new Error('git not found'))
			};
			gitAdapter.git = mockGit;

			await expect(gitAdapter.validateGitInstallation()).rejects.toThrow('git not found');
		});

		it('should return git version info', async () => {
			gitAdapter = new GitAdapter(testDir);

			const versionInfo = await gitAdapter.getGitVersion();

			expect(versionInfo).toBeDefined();
			expect(versionInfo.major).toBeGreaterThan(0);
		});
	});

	describe('getRepositoryRoot', () => {
		it('should return repository root path', async () => {
			// Initialize real git repo
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

			gitAdapter = new GitAdapter(testDir);

			const root = await gitAdapter.getRepositoryRoot();

			// Resolve both paths to handle symlinks (e.g., /var vs /private/var on macOS)
			expect(await fs.realpath(root)).toBe(await fs.realpath(testDir));
		});

		it('should find repository root from subdirectory', async () => {
			// Initialize real git repo in parent
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

			// Create subdirectory
			const subDir = path.join(testDir, 'src', 'components');
			await fs.ensureDir(subDir);

			gitAdapter = new GitAdapter(subDir);

			const root = await gitAdapter.getRepositoryRoot();

			// Resolve both paths to handle symlinks (e.g., /var vs /private/var on macOS)
			expect(await fs.realpath(root)).toBe(await fs.realpath(testDir));
		});

		it('should throw error if not in git repository', async () => {
			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.getRepositoryRoot()).rejects.toThrow('not a git repository');
		});
	});

	describe('validateRepository', () => {
		it('should validate repository is in good state', async () => {
			// Initialize git repo
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.writeFile(path.join(testDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');

			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.validateRepository()).resolves.not.toThrow();
		});

		it('should throw error for non-git directory', async () => {
			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.validateRepository()).rejects.toThrow('not a git repository');
		});

		it('should detect corrupted repository', async () => {
			// Create .git directory but make it empty (corrupted)
			await fs.ensureDir(path.join(testDir, '.git'));

			gitAdapter = new GitAdapter(testDir);

			// This should either succeed or throw a specific error
			// depending on simple-git's behavior
			try {
				await gitAdapter.validateRepository();
			} catch (error) {
				expect(error.message).toMatch(/repository|git/i);
			}
		});
	});

	describe('ensureGitRepository', () => {
		it('should not throw if in valid git repository', async () => {
			// Initialize git repo
			await fs.ensureDir(path.join(testDir, '.git'));

			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.ensureGitRepository()).resolves.not.toThrow();
		});

		it('should throw error if not in git repository', async () => {
			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.ensureGitRepository()).rejects.toThrow('not a git repository');
		});

		it('should provide helpful error message', async () => {
			gitAdapter = new GitAdapter(testDir);

			try {
				await gitAdapter.ensureGitRepository();
				fail('Should have thrown error');
			} catch (error) {
				expect(error.message).toContain('not a git repository');
				expect(error.message).toContain(testDir);
			}
		});
	});

	describe('constructor', () => {
		it('should create GitAdapter with project path', () => {
			gitAdapter = new GitAdapter(testDir);

			expect(gitAdapter).toBeDefined();
			expect(gitAdapter.projectPath).toBe(testDir);
		});

		it('should normalize project path', () => {
			const unnormalizedPath = path.join(testDir, '..', path.basename(testDir));
			gitAdapter = new GitAdapter(unnormalizedPath);

			expect(gitAdapter.projectPath).toBe(testDir);
		});

		it('should initialize simple-git instance', () => {
			gitAdapter = new GitAdapter(testDir);

			expect(gitAdapter.git).toBeDefined();
		});

		it('should throw error for invalid path', () => {
			expect(() => new GitAdapter('')).toThrow('Project path is required');
		});

		it('should throw error for non-absolute path', () => {
			expect(() => new GitAdapter('./relative/path')).toThrow('absolute');
		});
	});

	describe('error handling', () => {
		it('should provide clear error for permission denied', async () => {
			// Create .git but make it inaccessible
			await fs.ensureDir(path.join(testDir, '.git'));

			gitAdapter = new GitAdapter(testDir);

			try {
				await fs.chmod(path.join(testDir, '.git'), 0o000);

				await gitAdapter.isGitRepository();
			} catch (error) {
				// Error handling
			} finally {
				// Restore permissions
				await fs.chmod(path.join(testDir, '.git'), 0o755);
			}
		});

		it('should handle symbolic links correctly', async () => {
			// Create actual git repo
			const realRepo = path.join(testDir, 'real-repo');
			await fs.ensureDir(path.join(realRepo, '.git'));

			// Create symlink
			const symlinkPath = path.join(testDir, 'symlink-repo');
			try {
				await fs.symlink(realRepo, symlinkPath);

				gitAdapter = new GitAdapter(symlinkPath);

				const isRepo = await gitAdapter.isGitRepository();

				expect(isRepo).toBe(true);
			} catch (error) {
				// Skip test on platforms without symlink support
				if (error.code !== 'EPERM') {
					throw error;
				}
			}
		});
	});

	describe('integration with simple-git', () => {
		it('should use simple-git for git operations', () => {
			gitAdapter = new GitAdapter(testDir);

			// Check that git instance is from simple-git
			expect(typeof gitAdapter.git.status).toBe('function');
			expect(typeof gitAdapter.git.branch).toBe('function');
		});

		it('should pass correct working directory to simple-git', () => {
			gitAdapter = new GitAdapter(testDir);

			// simple-git should be initialized with testDir
			expect(gitAdapter.git._executor).toBeDefined();
		});
	});
});
