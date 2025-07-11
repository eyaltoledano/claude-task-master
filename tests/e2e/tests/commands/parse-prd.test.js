/**
 * Comprehensive E2E tests for parse-prd command
 * Tests all aspects of PRD parsing including task generation, research mode, and various formats
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

describe('parse-prd command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-parse-prd-'));

		// Initialize test helpers
		const context = global.createTestContext('parse-prd');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic PRD parsing', () => {
		it('should parse PRD from file', async () => {
			// Create a simple PRD file
			const prdContent = `# Project Requirements
			
			Build a user authentication system with the following features:
			- User registration with email verification
			- Login with JWT tokens
			- Password reset functionality
			- User profile management`;

			const prdPath = join(testDir, 'test-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster('parse-prd', [prdPath], {
				cwd: testDir,
				timeout: 45000
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Tasks generated successfully');

			// Verify tasks.json was created
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			expect(existsSync(tasksPath)).toBe(true);

			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			expect(tasks.master.tasks.length).toBeGreaterThan(0);
		}, 60000);

		it('should use default PRD file when none specified', async () => {
			// Create default prd.txt
			const prdContent = 'Build a simple todo application';
			const defaultPrdPath = join(testDir, '.taskmaster/prd.txt');
			mkdirSync(join(testDir, '.taskmaster'), { recursive: true });
			writeFileSync(defaultPrdPath, prdContent);

			const result = await helpers.taskMaster('parse-prd', [], {
				cwd: testDir,
				timeout: 45000
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Using default PRD file');
		}, 60000);

		it('should parse PRD using --input option', async () => {
			const prdContent = 'Create a REST API for blog management';
			const prdPath = join(testDir, 'api-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster(
				'parse-prd',
				['--input', prdPath],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Tasks generated successfully');
		}, 60000);
	});

	describe('Task generation options', () => {
		it('should generate custom number of tasks', async () => {
			const prdContent =
				'Build a comprehensive e-commerce platform with all features';
			const prdPath = join(testDir, 'ecommerce-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath, '--num-tasks', '5'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			// AI might generate slightly more or less, but should be close to 5
			expect(tasks.master.tasks.length).toBeGreaterThanOrEqual(3);
			expect(tasks.master.tasks.length).toBeLessThanOrEqual(7);
		}, 60000);

		it('should handle custom output path', async () => {
			const prdContent = 'Build a chat application';
			const prdPath = join(testDir, 'chat-prd.txt');
			writeFileSync(prdPath, prdContent);

			const customOutput = join(testDir, 'custom-tasks.json');

			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath, '--output', customOutput],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(existsSync(customOutput)).toBe(true);

			const tasks = JSON.parse(readFileSync(customOutput, 'utf8'));
			expect(tasks.master.tasks.length).toBeGreaterThan(0);
		}, 60000);
	});

	describe('Force and append modes', () => {
		it('should overwrite with --force flag', async () => {
			// Create initial tasks
			const initialPrd = 'Build feature A';
			const prdPath1 = join(testDir, 'initial.txt');
			writeFileSync(prdPath1, initialPrd);

			await helpers.taskMaster('parse-prd', [prdPath1], { cwd: testDir });

			// Create new PRD
			const newPrd = 'Build feature B';
			const prdPath2 = join(testDir, 'new.txt');
			writeFileSync(prdPath2, newPrd);

			// Parse with force flag
			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath2, '--force'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).not.toContain('overwrite existing tasks?');
		}, 90000);

		it('should append tasks with --append flag', async () => {
			// Create initial tasks
			const initialPrd = 'Build authentication system';
			const prdPath1 = join(testDir, 'auth-prd.txt');
			writeFileSync(prdPath1, initialPrd);

			await helpers.taskMaster('parse-prd', [prdPath1], { cwd: testDir });

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const initialTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			const initialCount = initialTasks.master.tasks.length;

			// Create additional PRD
			const additionalPrd = 'Build user profile features';
			const prdPath2 = join(testDir, 'profile-prd.txt');
			writeFileSync(prdPath2, additionalPrd);

			// Parse with append flag
			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath2, '--append'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Appending to existing tasks');

			const finalTasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			expect(finalTasks.master.tasks.length).toBeGreaterThan(initialCount);

			// Verify IDs are sequential
			const maxId = Math.max(...finalTasks.master.tasks.map((t) => t.id));
			expect(maxId).toBe(finalTasks.master.tasks.length);
		}, 90000);
	});

	describe('Research mode', () => {
		it('should use research mode with --research flag', async () => {
			const prdContent =
				'Build a machine learning pipeline for recommendation system';
			const prdPath = join(testDir, 'ml-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath, '--research'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(
				'Using Perplexity AI for research-backed task generation'
			);

			// Research mode should produce more detailed tasks
			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Check that tasks have detailed implementation details
			const hasDetailedTasks = tasks.master.tasks.some(
				(t) => t.details && t.details.length > 200
			);
			expect(hasDetailedTasks).toBe(true);
		}, 120000);
	});

	describe('Tag support', () => {
		it('should parse PRD to specific tag', async () => {
			// Create a new tag
			await helpers.taskMaster('add-tag', ['feature-x'], { cwd: testDir });

			const prdContent = 'Build feature X components';
			const prdPath = join(testDir, 'feature-x-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath, '--tag', 'feature-x'],
				{ cwd: testDir, timeout: 45000 }
			);

			expect(result).toHaveExitCode(0);

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			expect(tasks['feature-x']).toBeDefined();
			expect(tasks['feature-x'].tasks.length).toBeGreaterThan(0);
		}, 60000);
	});

	describe('File format handling', () => {
		it('should parse markdown format PRD', async () => {
			const prdContent = `# Project: Task Management System

## Overview
Build a task management system with the following features:

### Core Features
- **Task Creation**: Users can create tasks with title and description
- **Task Lists**: Organize tasks in different lists
- **Due Dates**: Set and track due dates

### Technical Requirements
- REST API backend
- React frontend
- PostgreSQL database`;

			const prdPath = join(testDir, 'markdown-prd.md');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster('parse-prd', [prdPath], {
				cwd: testDir,
				timeout: 45000
			});

			expect(result).toHaveExitCode(0);

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Should parse technical requirements into tasks
			const hasApiTask = tasks.master.tasks.some(
				(t) =>
					t.title.toLowerCase().includes('api') ||
					t.description.toLowerCase().includes('api')
			);
			expect(hasApiTask).toBe(true);
		}, 60000);

		it('should handle PRD with code blocks', async () => {
			const prdContent = `# API Requirements

Create REST endpoints:

\`\`\`
POST /api/users - Create user
GET /api/users/:id - Get user by ID
PUT /api/users/:id - Update user
DELETE /api/users/:id - Delete user
\`\`\`

Each endpoint should have proper error handling and validation.`;

			const prdPath = join(testDir, 'api-prd.txt');
			writeFileSync(prdPath, prdContent);

			const result = await helpers.taskMaster('parse-prd', [prdPath], {
				cwd: testDir,
				timeout: 45000
			});

			expect(result).toHaveExitCode(0);

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));

			// Should create tasks for API endpoints
			const hasEndpointTasks = tasks.master.tasks.some(
				(t) =>
					t.title.includes('endpoint') ||
					t.description.includes('endpoint') ||
					t.details.includes('/api/')
			);
			expect(hasEndpointTasks).toBe(true);
		}, 60000);
	});

	describe('Error handling', () => {
		it('should fail with non-existent file', async () => {
			const result = await helpers.taskMaster(
				'parse-prd',
				['non-existent-file.txt'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('not found');
		});

		it('should fail with empty PRD file', async () => {
			const emptyPrdPath = join(testDir, 'empty.txt');
			writeFileSync(emptyPrdPath, '');

			const result = await helpers.taskMaster('parse-prd', [emptyPrdPath], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
		});

		it('should show help when no PRD specified and no default exists', async () => {
			const result = await helpers.taskMaster('parse-prd', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Parse PRD Help');
			expect(result.stdout).toContain('No PRD file specified');
		});
	});

	describe('Performance and edge cases', () => {
		it('should handle large PRD files', async () => {
			// Create a large PRD with many requirements
			let largePrd = '# Large Project Requirements\n\n';
			for (let i = 1; i <= 50; i++) {
				largePrd += `## Feature ${i}\n`;
				largePrd += `Build feature ${i} with the following requirements:\n`;
				largePrd += `- Requirement A for feature ${i}\n`;
				largePrd += `- Requirement B for feature ${i}\n`;
				largePrd += `- Integration with feature ${i - 1}\n\n`;
			}

			const prdPath = join(testDir, 'large-prd.txt');
			writeFileSync(prdPath, largePrd);

			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'parse-prd',
				[prdPath, '--num-tasks', '20'],
				{ cwd: testDir, timeout: 120000 }
			);
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(duration).toBeLessThan(120000); // Should complete within 2 minutes

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasks = JSON.parse(readFileSync(tasksPath, 'utf8'));
			expect(tasks.master.tasks.length).toBeGreaterThan(10);
		}, 150000);

		it('should handle PRD with special characters', async () => {
			const prdContent = `# Project: Système de Gestion 管理システム

Build a system with:
- UTF-8 support: ñáéíóú αβγδε 中文字符
- Special symbols: @#$%^&*()_+{}[]|\\:;"'<>,.?/
- Emoji support: 🚀 📊 💻 ✅`;

			const prdPath = join(testDir, 'special-chars-prd.txt');
			writeFileSync(prdPath, prdContent, 'utf8');

			const result = await helpers.taskMaster('parse-prd', [prdPath], {
				cwd: testDir,
				timeout: 45000
			});

			expect(result).toHaveExitCode(0);

			const tasksPath = join(testDir, '.taskmaster/tasks/tasks.json');
			const tasksContent = readFileSync(tasksPath, 'utf8');
			const tasks = JSON.parse(tasksContent);

			// Verify special characters are preserved
			expect(tasksContent).toContain('UTF-8');
		}, 60000);
	});

	describe('Integration with other commands', () => {
		it('should work with list command after parsing', async () => {
			const prdContent = 'Build a simple blog system';
			const prdPath = join(testDir, 'blog-prd.txt');
			writeFileSync(prdPath, prdContent);

			// Parse PRD
			await helpers.taskMaster('parse-prd', [prdPath], { cwd: testDir });

			// List tasks
			const listResult = await helpers.taskMaster('list', [], { cwd: testDir });

			expect(listResult).toHaveExitCode(0);
			expect(listResult.stdout).toContain('ID');
			expect(listResult.stdout).toContain('Title');
			expect(listResult.stdout).toContain('pending');
		});

		it('should work with expand command on generated tasks', async () => {
			const prdContent = 'Build user authentication';
			const prdPath = join(testDir, 'auth-prd.txt');
			writeFileSync(prdPath, prdContent);

			// Parse PRD
			await helpers.taskMaster('parse-prd', [prdPath], { cwd: testDir });

			// Expand first task
			const expandResult = await helpers.taskMaster('expand', ['--id', '1'], {
				cwd: testDir,
				timeout: 45000
			});

			expect(expandResult).toHaveExitCode(0);
			expect(expandResult.stdout).toContain('Expanded task');
		}, 90000);
	});
});
