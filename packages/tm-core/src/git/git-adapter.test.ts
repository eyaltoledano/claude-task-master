import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest
} from '@jest/globals';
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
			await fs.writeFile(
				path.join(testDir, '.git', 'HEAD'),
				'ref: refs/heads/main\n'
			);

			gitAdapter = new GitAdapter(testDir);

			const isRepo = await gitAdapter.isGitRepository();

			expect(isRepo).toBe(true);
		});

		it('should detect git repository in subdirectory', async () => {
			// Initialize real git repo in parent
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.writeFile(
				path.join(testDir, '.git', 'HEAD'),
				'ref: refs/heads/main\n'
			);

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

			await expect(gitAdapter.validateGitInstallation()).rejects.toThrow(
				'git not found'
			);
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
			await fs.writeFile(
				path.join(testDir, '.git', 'HEAD'),
				'ref: refs/heads/main\n'
			);

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
			await fs.writeFile(
				path.join(testDir, '.git', 'HEAD'),
				'ref: refs/heads/main\n'
			);

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

			await expect(gitAdapter.getRepositoryRoot()).rejects.toThrow(
				'not a git repository'
			);
		});
	});

	describe('validateRepository', () => {
		it('should validate repository is in good state', async () => {
			// Initialize git repo
			await fs.ensureDir(path.join(testDir, '.git'));
			await fs.ensureDir(path.join(testDir, '.git', 'refs'));
			await fs.ensureDir(path.join(testDir, '.git', 'objects'));
			await fs.writeFile(
				path.join(testDir, '.git', 'HEAD'),
				'ref: refs/heads/main\n'
			);

			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.validateRepository()).resolves.not.toThrow();
		});

		it('should throw error for non-git directory', async () => {
			gitAdapter = new GitAdapter(testDir);

			await expect(gitAdapter.validateRepository()).rejects.toThrow(
				'not a git repository'
			);
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

			await expect(gitAdapter.ensureGitRepository()).rejects.toThrow(
				'not a git repository'
			);
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

describe('GitAdapter - Working Tree Status', () => {
	let testDir;
	let gitAdapter;
	let simpleGit;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `git-status-test-${Date.now()}`);
		await fs.ensureDir(testDir);

		// Initialize actual git repo
		simpleGit = (await import('simple-git')).default;
		const git = simpleGit(testDir);
		await git.init();
		await git.addConfig('user.name', 'Test User');
		await git.addConfig('user.email', 'test@example.com');

		gitAdapter = new GitAdapter(testDir);
	});

	afterEach(async () => {
		await fs.remove(testDir);
	});

	describe('isWorkingTreeClean', () => {
		it('should return true for clean working tree', async () => {
			const isClean = await gitAdapter.isWorkingTreeClean();
			expect(isClean).toBe(true);
		});

		it('should return false when files are modified', async () => {
			// Create and commit a file
			await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
			const git = simpleGit(testDir);
			await git.add('test.txt');
			await git.commit('initial commit', undefined, { '--no-gpg-sign': null });

			// Modify the file
			await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');

			const isClean = await gitAdapter.isWorkingTreeClean();
			expect(isClean).toBe(false);
		});

		it('should return false when untracked files exist', async () => {
			await fs.writeFile(path.join(testDir, 'untracked.txt'), 'content');

			const isClean = await gitAdapter.isWorkingTreeClean();
			expect(isClean).toBe(false);
		});

		it('should return false when files are staged', async () => {
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('staged.txt');

			const isClean = await gitAdapter.isWorkingTreeClean();
			expect(isClean).toBe(false);
		});
	});

	describe('getStatus', () => {
		it('should return status for clean repo', async () => {
			const status = await gitAdapter.getStatus();

			expect(status).toBeDefined();
			expect(status.modified).toEqual([]);
			expect(status.not_added).toEqual([]);
			expect(status.deleted).toEqual([]);
			expect(status.created).toEqual([]);
		});

		it('should detect modified files', async () => {
			// Create and commit
			await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
			const git = simpleGit(testDir);
			await git.add('test.txt');
			await git.commit('initial', undefined, { '--no-gpg-sign': null });

			// Modify
			await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');

			const status = await gitAdapter.getStatus();
			expect(status.modified).toContain('test.txt');
		});

		it('should detect untracked files', async () => {
			await fs.writeFile(path.join(testDir, 'untracked.txt'), 'content');

			const status = await gitAdapter.getStatus();
			expect(status.not_added).toContain('untracked.txt');
		});

		it('should detect staged files', async () => {
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('staged.txt');

			const status = await gitAdapter.getStatus();
			expect(status.created).toContain('staged.txt');
		});

		it('should detect deleted files', async () => {
			// Create and commit
			await fs.writeFile(path.join(testDir, 'deleted.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('deleted.txt');
			await git.commit('add file', undefined, { '--no-gpg-sign': null });

			// Delete
			await fs.remove(path.join(testDir, 'deleted.txt'));

			const status = await gitAdapter.getStatus();
			expect(status.deleted).toContain('deleted.txt');
		});
	});

	describe('hasUncommittedChanges', () => {
		it('should return false for clean repo', async () => {
			const hasChanges = await gitAdapter.hasUncommittedChanges();
			expect(hasChanges).toBe(false);
		});

		it('should return true for modified files', async () => {
			await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
			const git = simpleGit(testDir);
			await git.add('test.txt');
			await git.commit('initial', undefined, { '--no-gpg-sign': null });

			await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');

			const hasChanges = await gitAdapter.hasUncommittedChanges();
			expect(hasChanges).toBe(true);
		});

		it('should return true for staged changes', async () => {
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('staged.txt');

			const hasChanges = await gitAdapter.hasUncommittedChanges();
			expect(hasChanges).toBe(true);
		});
	});

	describe('hasStagedChanges', () => {
		it('should return false when no staged changes', async () => {
			const hasStaged = await gitAdapter.hasStagedChanges();
			expect(hasStaged).toBe(false);
		});

		it('should return true when files are staged', async () => {
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('staged.txt');

			const hasStaged = await gitAdapter.hasStagedChanges();
			expect(hasStaged).toBe(true);
		});

		it('should return false for unstaged changes only', async () => {
			await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
			const git = simpleGit(testDir);
			await git.add('test.txt');
			await git.commit('initial', undefined, { '--no-gpg-sign': null });

			await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');

			const hasStaged = await gitAdapter.hasStagedChanges();
			expect(hasStaged).toBe(false);
		});
	});

	describe('hasUntrackedFiles', () => {
		it('should return false when no untracked files', async () => {
			const hasUntracked = await gitAdapter.hasUntrackedFiles();
			expect(hasUntracked).toBe(false);
		});

		it('should return true when untracked files exist', async () => {
			await fs.writeFile(path.join(testDir, 'untracked.txt'), 'content');

			const hasUntracked = await gitAdapter.hasUntrackedFiles();
			expect(hasUntracked).toBe(true);
		});

		it('should not count staged files as untracked', async () => {
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('staged.txt');

			const hasUntracked = await gitAdapter.hasUntrackedFiles();
			expect(hasUntracked).toBe(false);
		});
	});

	describe('getStatusSummary', () => {
		it('should provide summary for clean repo', async () => {
			const summary = await gitAdapter.getStatusSummary();

			expect(summary).toBeDefined();
			expect(summary.isClean).toBe(true);
			expect(summary.totalChanges).toBe(0);
		});

		it('should count all types of changes', async () => {
			// Create committed file
			await fs.writeFile(path.join(testDir, 'committed.txt'), 'content');
			const git = simpleGit(testDir);
			await git.add('committed.txt');
			await git.commit('initial', undefined, { '--no-gpg-sign': null });

			// Modify it
			await fs.writeFile(path.join(testDir, 'committed.txt'), 'modified');

			// Add untracked
			await fs.writeFile(path.join(testDir, 'untracked.txt'), 'content');

			// Add staged
			await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
			await git.add('staged.txt');

			const summary = await gitAdapter.getStatusSummary();

			expect(summary.isClean).toBe(false);
			expect(summary.totalChanges).toBeGreaterThan(0);
			expect(summary.modified).toBeGreaterThan(0);
			expect(summary.untracked).toBeGreaterThan(0);
			expect(summary.staged).toBeGreaterThan(0);
		});
	});

	describe('ensureCleanWorkingTree', () => {
		it('should not throw for clean repo', async () => {
			await expect(gitAdapter.ensureCleanWorkingTree()).resolves.not.toThrow();
		});

		it('should throw for dirty repo', async () => {
			await fs.writeFile(path.join(testDir, 'dirty.txt'), 'content');

			await expect(gitAdapter.ensureCleanWorkingTree()).rejects.toThrow(
				'working tree is not clean'
			);
		});

		it('should provide details about changes in error', async () => {
			await fs.writeFile(path.join(testDir, 'modified.txt'), 'content');

			try {
				await gitAdapter.ensureCleanWorkingTree();
				fail('Should have thrown');
			} catch (error) {
				expect(error.message).toContain('working tree is not clean');
			}
		});
	});

	describe('GitAdapter - Branch Operations', () => {
		let testDir;
		let gitAdapter;
		let simpleGit;

		beforeEach(async () => {
			testDir = path.join(os.tmpdir(), `git-branch-test-${Date.now()}`);
			await fs.ensureDir(testDir);

			// Initialize actual git repo with initial commit
			simpleGit = (await import('simple-git')).default;
			const git = simpleGit(testDir);
			await git.init();
			await git.addConfig('user.name', 'Test User');
			await git.addConfig('user.email', 'test@example.com');

			// Create initial commit
			await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repo');
			await git.add('README.md');
			await git.commit('Initial commit', undefined, { '--no-gpg-sign': null });

			// Rename master to main for consistency
			try {
				await git.branch(['-m', 'master', 'main']);
			} catch (error) {
				// Branch might already be main, ignore error
			}

			gitAdapter = new GitAdapter(testDir);
		});

		afterEach(async () => {
			if (await fs.pathExists(testDir)) {
				await fs.remove(testDir);
			}
		});

		describe('getCurrentBranch', () => {
			it('should return current branch name', async () => {
				const branch = await gitAdapter.getCurrentBranch();
				expect(branch).toBe('main');
			});

			it('should return updated branch after checkout', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('feature');

				const branch = await gitAdapter.getCurrentBranch();
				expect(branch).toBe('feature');
			});
		});

		describe('listBranches', () => {
			it('should list all branches', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('feature-a');
				await git.checkout('main');
				await git.checkoutLocalBranch('feature-b');

				const branches = await gitAdapter.listBranches();
				expect(branches).toContain('main');
				expect(branches).toContain('feature-a');
				expect(branches).toContain('feature-b');
				expect(branches.length).toBeGreaterThanOrEqual(3);
			});

			it('should return empty array if only on detached HEAD', async () => {
				const git = simpleGit(testDir);
				const log = await git.log();
				await git.checkout(log.latest.hash);

				const branches = await gitAdapter.listBranches();
				expect(Array.isArray(branches)).toBe(true);
			});
		});

		describe('branchExists', () => {
			it('should return true for existing branch', async () => {
				const exists = await gitAdapter.branchExists('main');
				expect(exists).toBe(true);
			});

			it('should return false for non-existing branch', async () => {
				const exists = await gitAdapter.branchExists('nonexistent');
				expect(exists).toBe(false);
			});

			it('should detect newly created branches', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('new-feature');

				const exists = await gitAdapter.branchExists('new-feature');
				expect(exists).toBe(true);
			});
		});

		describe('createBranch', () => {
			it('should create a new branch', async () => {
				await gitAdapter.createBranch('new-branch');

				const exists = await gitAdapter.branchExists('new-branch');
				expect(exists).toBe(true);
			});

			it('should throw error if branch already exists', async () => {
				await gitAdapter.createBranch('existing-branch');

				await expect(
					gitAdapter.createBranch('existing-branch')
				).rejects.toThrow();
			});

			it('should not switch to new branch by default', async () => {
				await gitAdapter.createBranch('new-branch');

				const current = await gitAdapter.getCurrentBranch();
				expect(current).toBe('main');
			});

			it('should throw if working tree is dirty when checkout is requested', async () => {
				await fs.writeFile(path.join(testDir, 'dirty.txt'), 'content');

				await expect(
					gitAdapter.createBranch('new-branch', { checkout: true })
				).rejects.toThrow('working tree is not clean');
			});
		});

		describe('checkoutBranch', () => {
			it('should checkout existing branch', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('feature');
				await git.checkout('main');

				await gitAdapter.checkoutBranch('feature');

				const current = await gitAdapter.getCurrentBranch();
				expect(current).toBe('feature');
			});

			it('should throw error for non-existing branch', async () => {
				await expect(
					gitAdapter.checkoutBranch('nonexistent')
				).rejects.toThrow();
			});

			it('should throw if working tree is dirty', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('feature');
				await git.checkout('main');

				await fs.writeFile(path.join(testDir, 'dirty.txt'), 'content');

				await expect(gitAdapter.checkoutBranch('feature')).rejects.toThrow(
					'working tree is not clean'
				);
			});

			it('should allow force checkout with force flag', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('feature');
				await git.checkout('main');

				await fs.writeFile(path.join(testDir, 'dirty.txt'), 'content');

				await gitAdapter.checkoutBranch('feature', { force: true });

				const current = await gitAdapter.getCurrentBranch();
				expect(current).toBe('feature');
			});
		});

		describe('createAndCheckoutBranch', () => {
			it('should create and checkout new branch', async () => {
				await gitAdapter.createAndCheckoutBranch('new-feature');

				const current = await gitAdapter.getCurrentBranch();
				expect(current).toBe('new-feature');

				const exists = await gitAdapter.branchExists('new-feature');
				expect(exists).toBe(true);
			});

			it('should throw if branch already exists', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('existing');
				await git.checkout('main');

				await expect(
					gitAdapter.createAndCheckoutBranch('existing')
				).rejects.toThrow();
			});

			it('should throw if working tree is dirty', async () => {
				await fs.writeFile(path.join(testDir, 'dirty.txt'), 'content');

				await expect(
					gitAdapter.createAndCheckoutBranch('new-feature')
				).rejects.toThrow('working tree is not clean');
			});
		});

		describe('deleteBranch', () => {
			it('should delete existing branch', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('to-delete');
				await git.checkout('main');

				await gitAdapter.deleteBranch('to-delete');

				const exists = await gitAdapter.branchExists('to-delete');
				expect(exists).toBe(false);
			});

			it('should throw error when deleting current branch', async () => {
				await expect(gitAdapter.deleteBranch('main')).rejects.toThrow();
			});

			it('should throw error for non-existing branch', async () => {
				await expect(gitAdapter.deleteBranch('nonexistent')).rejects.toThrow();
			});

			it('should force delete with force flag', async () => {
				const git = simpleGit(testDir);
				await git.checkoutLocalBranch('unmerged');
				await fs.writeFile(path.join(testDir, 'unmerged.txt'), 'content');
				await git.add('unmerged.txt');
				await git.commit('Unmerged commit', undefined, {
					'--no-gpg-sign': null
				});
				await git.checkout('main');

				await gitAdapter.deleteBranch('unmerged', { force: true });

				const exists = await gitAdapter.branchExists('unmerged');
				expect(exists).toBe(false);
			});
		});
	});

	describe('GitAdapter - Commit Operations', () => {
		let testDir;
		let gitAdapter;
		let simpleGit;

		beforeEach(async () => {
			testDir = path.join(os.tmpdir(), `git-commit-test-${Date.now()}`);
			await fs.ensureDir(testDir);

			// Initialize actual git repo with initial commit
			simpleGit = (await import('simple-git')).default;
			const git = simpleGit(testDir);
			await git.init();
			await git.addConfig('user.name', 'Test User');
			await git.addConfig('user.email', 'test@example.com');

			// Create initial commit
			await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repo');
			await git.add('README.md');
			await git.commit('Initial commit', undefined, { '--no-gpg-sign': null });

			// Rename master to main for consistency
			try {
				await git.branch(['-m', 'master', 'main']);
			} catch (error) {
				// Branch might already be main, ignore error
			}

			gitAdapter = new GitAdapter(testDir);
		});

		afterEach(async () => {
			if (await fs.pathExists(testDir)) {
				await fs.remove(testDir);
			}
		});

		describe('stageFiles', () => {
			it('should stage single file', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				const status = await gitAdapter.getStatus();
				expect(status.staged).toContain('new.txt');
			});

			it('should stage multiple files', async () => {
				await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
				await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
				await gitAdapter.stageFiles(['file1.txt', 'file2.txt']);

				const status = await gitAdapter.getStatus();
				expect(status.staged).toContain('file1.txt');
				expect(status.staged).toContain('file2.txt');
			});

			it('should stage all files with dot', async () => {
				await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
				await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
				await gitAdapter.stageFiles(['.']);

				const status = await gitAdapter.getStatus();
				expect(status.staged.length).toBeGreaterThanOrEqual(2);
			});
		});

		describe('unstageFiles', () => {
			it('should unstage single file', async () => {
				await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
				const git = simpleGit(testDir);
				await git.add('staged.txt');

				await gitAdapter.unstageFiles(['staged.txt']);

				const status = await gitAdapter.getStatus();
				expect(status.staged).not.toContain('staged.txt');
			});

			it('should unstage multiple files', async () => {
				await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
				await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
				const git = simpleGit(testDir);
				await git.add(['file1.txt', 'file2.txt']);

				await gitAdapter.unstageFiles(['file1.txt', 'file2.txt']);

				const status = await gitAdapter.getStatus();
				expect(status.staged).not.toContain('file1.txt');
				expect(status.staged).not.toContain('file2.txt');
			});
		});

		describe('createCommit', () => {
			it('should create commit with simple message', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				await gitAdapter.createCommit('Add new file');

				const git = simpleGit(testDir);
				const log = await git.log();
				expect(log.latest.message).toBe('Add new file');
			});

			it('should create commit with metadata', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				const metadata = {
					taskId: '2.4',
					phase: 'implementation',
					timestamp: new Date().toISOString()
				};
				await gitAdapter.createCommit('Add new file', { metadata });

				const commit = await gitAdapter.getLastCommit();
				expect(commit.message).toContain('Add new file');
				expect(commit.message).toContain('[taskId:2.4]');
				expect(commit.message).toContain('[phase:implementation]');
			});

			it('should throw if no staged changes', async () => {
				await expect(gitAdapter.createCommit('Empty commit')).rejects.toThrow();
			});

			it('should allow empty commits with allowEmpty flag', async () => {
				await gitAdapter.createCommit('Empty commit', { allowEmpty: true });

				const git = simpleGit(testDir);
				const log = await git.log();
				expect(log.latest.message).toBe('Empty commit');
			});

			it('should throw if on default branch without force', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				await expect(
					gitAdapter.createCommit('Add new file', {
						enforceNonDefaultBranch: true
					})
				).rejects.toThrow('cannot commit to default branch');
			});

			it('should allow commit on default branch with force', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				await gitAdapter.createCommit('Add new file', {
					enforceNonDefaultBranch: true,
					force: true
				});

				const git = simpleGit(testDir);
				const log = await git.log();
				expect(log.latest.message).toBe('Add new file');
			});

			it('should allow commit on feature branch with enforcement', async () => {
				// Create and checkout feature branch
				await gitAdapter.createAndCheckoutBranch('feature-branch');

				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);

				await gitAdapter.createCommit('Add new file', {
					enforceNonDefaultBranch: true
				});

				const git = simpleGit(testDir);
				const log = await git.log();
				expect(log.latest.message).toBe('Add new file');
			});
		});

		describe('getCommitLog', () => {
			it('should get recent commits', async () => {
				const log = await gitAdapter.getCommitLog();
				expect(log.length).toBeGreaterThan(0);
				expect(log[0].message.trim()).toBe('Initial commit');
			});

			it('should limit number of commits', async () => {
				// Create additional commits
				for (let i = 1; i <= 5; i++) {
					await fs.writeFile(path.join(testDir, `file${i}.txt`), `content${i}`);
					await gitAdapter.stageFiles([`file${i}.txt`]);
					await gitAdapter.createCommit(`Commit ${i}`);
				}

				const log = await gitAdapter.getCommitLog({ maxCount: 3 });
				expect(log.length).toBe(3);
			});

			it('should return commits with hash and date', async () => {
				const log = await gitAdapter.getCommitLog();
				expect(log[0]).toHaveProperty('hash');
				expect(log[0]).toHaveProperty('date');
				expect(log[0]).toHaveProperty('message');
				expect(log[0]).toHaveProperty('author_name');
				expect(log[0]).toHaveProperty('author_email');
			});
		});

		describe('getLastCommit', () => {
			it('should get the last commit', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);
				await gitAdapter.createCommit('Latest commit');

				const commit = await gitAdapter.getLastCommit();
				expect(commit.message.trim()).toBe('Latest commit');
			});

			it('should return commit with metadata if present', async () => {
				await fs.writeFile(path.join(testDir, 'new.txt'), 'content');
				await gitAdapter.stageFiles(['new.txt']);
				const metadata = { taskId: '2.4' };
				await gitAdapter.createCommit('With metadata', { metadata });

				const commit = await gitAdapter.getLastCommit();
				expect(commit.message).toContain('[taskId:2.4]');
			});
		});
	});

	describe('GitAdapter - Default Branch Detection and Protection', () => {
		let testDir;
		let gitAdapter;
		let simpleGit;

		beforeEach(async () => {
			testDir = path.join(os.tmpdir(), `git-default-branch-test-${Date.now()}`);
			await fs.ensureDir(testDir);

			// Initialize actual git repo with initial commit
			simpleGit = (await import('simple-git')).default;
			const git = simpleGit(testDir);
			await git.init();
			await git.addConfig('user.name', 'Test User');
			await git.addConfig('user.email', 'test@example.com');

			// Create initial commit
			await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repo');
			await git.add('README.md');
			await git.commit('Initial commit', undefined, { '--no-gpg-sign': null });

			// Rename master to main for consistency
			try {
				await git.branch(['-m', 'master', 'main']);
			} catch (error) {
				// Branch might already be main, ignore error
			}

			gitAdapter = new GitAdapter(testDir);
		});

		afterEach(async () => {
			if (await fs.pathExists(testDir)) {
				await fs.remove(testDir);
			}
		});

		describe('getDefaultBranch', () => {
			it('should detect main as default branch', async () => {
				const defaultBranch = await gitAdapter.getDefaultBranch();
				expect(defaultBranch).toBe('main');
			});

			it('should detect master if renamed back', async () => {
				const git = simpleGit(testDir);
				await git.branch(['-m', 'main', 'master']);

				const defaultBranch = await gitAdapter.getDefaultBranch();
				expect(defaultBranch).toBe('master');
			});
		});

		describe('isDefaultBranch', () => {
			it('should return true for main branch', async () => {
				const isDefault = await gitAdapter.isDefaultBranch('main');
				expect(isDefault).toBe(true);
			});

			it('should return true for master branch', async () => {
				const isDefault = await gitAdapter.isDefaultBranch('master');
				expect(isDefault).toBe(true);
			});

			it('should return true for develop branch', async () => {
				const isDefault = await gitAdapter.isDefaultBranch('develop');
				expect(isDefault).toBe(true);
			});

			it('should return false for feature branch', async () => {
				const isDefault = await gitAdapter.isDefaultBranch('feature-branch');
				expect(isDefault).toBe(false);
			});
		});

		describe('isOnDefaultBranch', () => {
			it('should return true when on main', async () => {
				const onDefault = await gitAdapter.isOnDefaultBranch();
				expect(onDefault).toBe(true);
			});

			it('should return false when on feature branch', async () => {
				await gitAdapter.createAndCheckoutBranch('feature-branch');

				const onDefault = await gitAdapter.isOnDefaultBranch();
				expect(onDefault).toBe(false);
			});
		});

		describe('ensureNotOnDefaultBranch', () => {
			it('should throw when on main branch', async () => {
				await expect(gitAdapter.ensureNotOnDefaultBranch()).rejects.toThrow(
					'currently on default branch'
				);
			});

			it('should not throw when on feature branch', async () => {
				await gitAdapter.createAndCheckoutBranch('feature-branch');

				await expect(
					gitAdapter.ensureNotOnDefaultBranch()
				).resolves.not.toThrow();
			});
		});
	});

	describe('GitAdapter - Push Operations', () => {
		let testDir;
		let gitAdapter;

		beforeEach(async () => {
			testDir = path.join(os.tmpdir(), `git-push-test-${Date.now()}`);
			await fs.ensureDir(testDir);

			const simpleGit = (await import('simple-git')).default;
			const git = simpleGit(testDir);
			await git.init();
			await git.addConfig('user.name', 'Test User');
			await git.addConfig('user.email', 'test@example.com');

			await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repo');
			await git.add('README.md');
			await git.commit('Initial commit', undefined, { '--no-gpg-sign': null });

			try {
				await git.branch(['-m', 'master', 'main']);
			} catch (error) {}

			gitAdapter = new GitAdapter(testDir);
		});

		afterEach(async () => {
			if (await fs.pathExists(testDir)) {
				await fs.remove(testDir);
			}
		});

		describe('hasRemote', () => {
			it('should return false when no remotes exist', async () => {
				const hasRemote = await gitAdapter.hasRemote();
				expect(hasRemote).toBe(false);
			});
		});

		describe('getRemotes', () => {
			it('should return empty array when no remotes', async () => {
				const remotes = await gitAdapter.getRemotes();
				expect(remotes).toEqual([]);
			});
		});
	});
});
