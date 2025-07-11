/**
 * Comprehensive E2E tests for migrate command
 * Tests migration from legacy structure to new .taskmaster directory structure
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	statSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const path = require('path');

describe('migrate command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-migrate-'));

		// Initialize test helpers
		const context = global.createTestContext('migrate');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic migration', () => {
		it('should migrate legacy structure to new .taskmaster structure', async () => {
			// Create legacy structure
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			// Create legacy tasks files
			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({
					master: {
						tasks: [
							{
								id: 1,
								title: 'Legacy task',
								description: 'Task from legacy structure',
								status: 'pending',
								priority: 'medium',
								dependencies: []
							}
						]
					}
				})
			);

			// Create legacy scripts files
			writeFileSync(
				join(testDir, 'scripts', 'example_prd.txt'),
				'Example PRD content'
			);
			writeFileSync(
				join(testDir, 'scripts', 'complexity_report.json'),
				JSON.stringify({ complexity: 'high' })
			);
			writeFileSync(
				join(testDir, 'scripts', 'project_docs.md'),
				'# Project Documentation'
			);

			// Create legacy config
			writeFileSync(
				join(testDir, '.taskmasterconfig'),
				JSON.stringify({ openai: { apiKey: 'test-key' } })
			);

			// Run migration
			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Starting migration');
			expect(result.stdout).toContain('Migration completed successfully');

			// Verify new structure exists
			expect(existsSync(join(testDir, '.taskmaster'))).toBe(true);
			expect(existsSync(join(testDir, '.taskmaster', 'tasks'))).toBe(true);
			expect(existsSync(join(testDir, '.taskmaster', 'templates'))).toBe(true);
			expect(existsSync(join(testDir, '.taskmaster', 'reports'))).toBe(true);
			expect(existsSync(join(testDir, '.taskmaster', 'docs'))).toBe(true);

			// Verify files were migrated to correct locations
			expect(
				existsSync(join(testDir, '.taskmaster', 'tasks', 'tasks.json'))
			).toBe(true);
			expect(
				existsSync(join(testDir, '.taskmaster', 'templates', 'example_prd.txt'))
			).toBe(true);
			expect(
				existsSync(
					join(testDir, '.taskmaster', 'reports', 'complexity_report.json')
				)
			).toBe(true);
			expect(
				existsSync(join(testDir, '.taskmaster', 'docs', 'project_docs.md'))
			).toBe(true);
			expect(existsSync(join(testDir, '.taskmaster', 'config.json'))).toBe(
				true
			);

			// Verify content integrity
			const migratedTasks = JSON.parse(
				readFileSync(
					join(testDir, '.taskmaster', 'tasks', 'tasks.json'),
					'utf8'
				)
			);
			expect(migratedTasks.master.tasks[0].title).toBe('Legacy task');
		});

		it('should handle already migrated projects', async () => {
			// Create new structure
			mkdirSync(join(testDir, '.taskmaster', 'tasks'), { recursive: true });
			writeFileSync(
				join(testDir, '.taskmaster', 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			// Try to migrate
			const result = await helpers.taskMaster('migrate', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				'.taskmaster directory already exists. Use --force to overwrite'
			);
		});

		it('should force migration with --force flag', async () => {
			// Create existing .taskmaster structure
			mkdirSync(join(testDir, '.taskmaster', 'tasks'), { recursive: true });
			writeFileSync(
				join(testDir, '.taskmaster', 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			// Create legacy structure
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			writeFileSync(
				join(testDir, 'tasks', 'new_tasks.json'),
				JSON.stringify({
					master: { tasks: [{ id: 1, title: 'New task' }] }
				})
			);

			// Force migration
			const result = await helpers.taskMaster('migrate', ['--force', '-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Migration completed successfully');
		});
	});

	describe('Migration options', () => {
		beforeEach(async () => {
			// Set up legacy structure for option tests
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);
			writeFileSync(
				join(testDir, 'scripts', 'example.txt'),
				'Example content'
			);
		});

		it('should create backup with --backup flag', async () => {
			const result = await helpers.taskMaster('migrate', ['--backup', '-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(existsSync(join(testDir, '.taskmaster-migration-backup'))).toBe(
				true
			);
			expect(
				existsSync(
					join(testDir, '.taskmaster-migration-backup', 'tasks', 'tasks.json')
				)
			).toBe(true);
		});

		it('should preserve old files with --cleanup=false', async () => {
			const result = await helpers.taskMaster(
				'migrate',
				['--cleanup=false', '-y'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				'Old files were preserved. Use --cleanup to remove them'
			);

			// Verify old files still exist
			expect(existsSync(join(testDir, 'tasks', 'tasks.json'))).toBe(true);
			expect(existsSync(join(testDir, 'scripts', 'example.txt'))).toBe(true);
		});

		it('should show dry run without making changes', async () => {
			const result = await helpers.taskMaster('migrate', ['--dry-run'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Would move');
			expect(result.stdout).toContain('Dry run complete');

			// Verify no changes were made
			expect(existsSync(join(testDir, '.taskmaster'))).toBe(false);
			expect(existsSync(join(testDir, 'tasks', 'tasks.json'))).toBe(true);
		});
	});

	describe('File categorization', () => {
		it('should correctly categorize different file types', async () => {
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			// Create various file types
			const testFiles = {
				'example_template.js': 'templates',
				'sample_code.py': 'templates',
				'boilerplate.html': 'templates',
				'template_readme.md': 'templates',
				'complexity_report_2024.json': 'reports',
				'task_complexity_report.json': 'reports',
				'prd_document.md': 'docs',
				'requirements.txt': 'docs',
				'project_overview.md': 'docs'
			};

			for (const [filename, expectedDir] of Object.entries(testFiles)) {
				writeFileSync(join(testDir, 'scripts', filename), 'Test content');
			}

			// Run migration
			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			// Verify files were categorized correctly
			for (const [filename, expectedDir] of Object.entries(testFiles)) {
				const migratedPath = join(testDir, '.taskmaster', expectedDir, filename);
				expect(existsSync(migratedPath)).toBe(true);
			}
		});

		it('should skip uncertain files', async () => {
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			// Create a file that doesn't fit any category clearly
			writeFileSync(join(testDir, 'scripts', 'random_script.sh'), '#!/bin/bash');

			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				"Skipping migration of 'random_script.sh' - uncertain categorization"
			);
		});
	});

	describe('Tag preservation', () => {
		it('should preserve all tags during migration', async () => {
			mkdirSync(join(testDir, 'tasks'), { recursive: true });

			// Create tasks file with multiple tags
			const tasksData = {
				master: {
					tasks: [{ id: 1, title: 'Master task' }]
				},
				'feature-branch': {
					tasks: [{ id: 1, title: 'Feature task' }]
				},
				'hotfix-branch': {
					tasks: [{ id: 1, title: 'Hotfix task' }]
				}
			};

			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify(tasksData)
			);

			// Run migration
			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			// Verify all tags were preserved
			const migratedTasks = JSON.parse(
				readFileSync(
					join(testDir, '.taskmaster', 'tasks', 'tasks.json'),
					'utf8'
				)
			);

			expect(migratedTasks.master).toBeDefined();
			expect(migratedTasks['feature-branch']).toBeDefined();
			expect(migratedTasks['hotfix-branch']).toBeDefined();
			expect(migratedTasks.master.tasks[0].title).toBe('Master task');
			expect(migratedTasks['feature-branch'].tasks[0].title).toBe(
				'Feature task'
			);
		});
	});

	describe('Error handling', () => {
		it('should handle missing source files gracefully', async () => {
			// Create a migration plan with non-existent files
			mkdirSync(join(testDir, '.taskmasterconfig'), { recursive: true });
			writeFileSync(
				join(testDir, '.taskmasterconfig'),
				JSON.stringify({ test: true })
			);

			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Migration completed successfully');
		});

		it('should handle corrupted JSON files', async () => {
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			writeFileSync(join(testDir, 'tasks', 'tasks.json'), '{ invalid json }');

			// Migration should still succeed, copying the file as-is
			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(
				existsSync(join(testDir, '.taskmaster', 'tasks', 'tasks.json'))
			).toBe(true);
		});

		it('should handle permission errors', async () => {
			// This test is platform-specific and may need adjustment
			// Skip on Windows where permissions work differently
			if (process.platform === 'win32') {
				return;
			}

			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			// Make directory read-only
			const tasksDir = join(testDir, 'tasks');
			try {
				// Note: This may not work on all systems
				process.chmod(tasksDir, 0o444);

				const result = await helpers.taskMaster('migrate', ['-y'], {
					cwd: testDir,
					allowFailure: true
				});

				// Migration might succeed or fail depending on system
				// The important thing is it doesn't crash
				expect(result).toBeDefined();
			} finally {
				// Restore permissions for cleanup
				process.chmod(tasksDir, 0o755);
			}
		});
	});

	describe('Directory cleanup', () => {
		it('should remove empty directories after migration', async () => {
			// Create legacy structure with empty directories
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			const result = await helpers.taskMaster('migrate', ['-y', '--cleanup'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			// Verify empty directories were removed
			expect(existsSync(join(testDir, 'tasks'))).toBe(false);
			expect(existsSync(join(testDir, 'scripts'))).toBe(false);
		});

		it('should not remove non-empty directories', async () => {
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			// Add an extra file that won't be migrated
			writeFileSync(join(testDir, 'tasks', 'keep-me.txt'), 'Do not delete');

			const result = await helpers.taskMaster('migrate', ['-y', '--cleanup'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			// Directory should still exist because it's not empty
			expect(existsSync(join(testDir, 'tasks'))).toBe(true);
			expect(existsSync(join(testDir, 'tasks', 'keep-me.txt'))).toBe(true);
		});
	});

	describe('Config file migration', () => {
		it('should migrate .taskmasterconfig to .taskmaster/config.json', async () => {
			const configData = {
				openai: {
					apiKey: 'test-api-key',
					model: 'gpt-4'
				},
				github: {
					token: 'test-token'
				}
			};

			writeFileSync(
				join(testDir, '.taskmasterconfig'),
				JSON.stringify(configData)
			);

			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);

			// Verify config was migrated
			expect(existsSync(join(testDir, '.taskmaster', 'config.json'))).toBe(
				true
			);

			const migratedConfig = JSON.parse(
				readFileSync(join(testDir, '.taskmaster', 'config.json'), 'utf8')
			);
			expect(migratedConfig.openai.apiKey).toBe('test-api-key');
			expect(migratedConfig.github.token).toBe('test-token');
		});
	});

	describe('Project without legacy structure', () => {
		it('should handle projects with no files to migrate', async () => {
			// Run migration in empty directory
			const result = await helpers.taskMaster('migrate', [], { cwd: testDir });

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('No files to migrate');
			expect(result.stdout).toContain(
				'Project may already be using the new structure'
			);
		});
	});

	describe('Migration confirmation', () => {
		it('should skip migration when user declines', async () => {
			mkdirSync(join(testDir, 'tasks'), { recursive: true });
			writeFileSync(
				join(testDir, 'tasks', 'tasks.json'),
				JSON.stringify({ master: { tasks: [] } })
			);

			// Simulate 'n' response
			const child = helpers.taskMaster('migrate', [], {
				cwd: testDir,
				returnChild: true
			});

			// Wait a bit for the prompt to appear
			await helpers.wait(500);

			// Send 'n' to decline
			child.stdin.write('n\n');

			const result = await child;

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Migration cancelled');

			// Verify nothing was migrated
			expect(existsSync(join(testDir, '.taskmaster'))).toBe(false);
		});
	});

	describe('Complex migration scenarios', () => {
		it('should handle nested directory structures', async () => {
			// Create nested structure
			mkdirSync(join(testDir, 'tasks', 'archive'), { recursive: true });
			mkdirSync(join(testDir, 'scripts', 'utils'), { recursive: true });

			writeFileSync(
				join(testDir, 'tasks', 'archive', 'old_tasks.json'),
				JSON.stringify({ archived: { tasks: [] } })
			);

			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(
				existsSync(
					join(testDir, '.taskmaster', 'tasks', 'archive', 'old_tasks.json')
				)
			).toBe(true);
		});

		it('should handle large number of files', async () => {
			mkdirSync(join(testDir, 'scripts'), { recursive: true });

			// Create many files
			for (let i = 0; i < 50; i++) {
				writeFileSync(
					join(testDir, 'scripts', `template_${i}.txt`),
					`Template ${i}`
				);
			}

			const startTime = Date.now();
			const result = await helpers.taskMaster('migrate', ['-y'], {
				cwd: testDir
			});
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

			// Verify all files were migrated
			const migratedFiles = readdirSync(
				join(testDir, '.taskmaster', 'templates')
			);
			expect(migratedFiles.length).toBe(50);
		});
	});
});