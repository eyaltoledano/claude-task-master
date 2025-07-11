/**
 * Comprehensive E2E tests for analyze-complexity command
 * Tests all aspects of complexity analysis including research mode and output formats
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
const { execSync } = require('child_process');

describe('analyze-complexity command', () => {
	let testDir;
	let helpers;
	let logger;
	let taskIds;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-analyze-complexity-'));

		// Initialize test helpers
		const context = global.createTestContext('analyze-complexity');
		helpers = context.helpers;
		logger = context.logger;

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

		// Setup test tasks for analysis
		taskIds = [];

		// Create simple task
		const simple = await helpers.taskMaster(
			'add-task',
			['--title', 'Simple task', '--description', 'A very simple task'],
			{ cwd: testDir }
		);
		taskIds.push(helpers.extractTaskId(simple.stdout));

		// Create complex task with subtasks
		const complex = await helpers.taskMaster(
			'add-task',
			[
				'--prompt',
				'Build a complete e-commerce platform with payment processing'
			],
			{ cwd: testDir }
		);
		const complexId = helpers.extractTaskId(complex.stdout);
		taskIds.push(complexId);

		// Expand complex task to add subtasks
		await helpers.taskMaster('expand', [complexId], { cwd: testDir });

		// Create task with dependencies
		const withDeps = await helpers.taskMaster(
			'add-task',
			['--title', 'Deployment task', '--depends-on', taskIds[0]],
			{ cwd: testDir }
		);
		taskIds.push(helpers.extractTaskId(withDeps.stdout));
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic complexity analysis', () => {
		it('should analyze complexity without flags', async () => {
			const result = await helpers.taskMaster('analyze-complexity', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('complexity');
		});

		it('should analyze with research flag', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--research'],
				{ cwd: testDir, timeout: 120000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('complexity');
		}, 120000);
	});

	describe('Output options', () => {
		it('should save to custom output file', async () => {
			const outputPath = '.taskmaster/reports/custom-complexity.json';
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--output', outputPath],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const fullPath = join(testDir, outputPath);
			expect(existsSync(fullPath)).toBe(true);

			// Verify it's valid JSON
			const report = JSON.parse(readFileSync(fullPath, 'utf8'));
			expect(report).toBeDefined();
			expect(typeof report).toBe('object');
		});

		it('should output in JSON format', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--format', 'json'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Output should be valid JSON
			let parsed;
			expect(() => {
				parsed = JSON.parse(result.stdout);
			}).not.toThrow();

			expect(parsed).toBeDefined();
			expect(typeof parsed).toBe('object');
		});

		it('should show detailed breakdown', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--detailed'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const output = result.stdout.toLowerCase();
			const expectedDetails = [
				'subtasks',
				'dependencies',
				'description',
				'metadata'
			];
			const foundDetails = expectedDetails.filter((detail) =>
				output.includes(detail)
			);

			expect(foundDetails.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe('Filtering options', () => {
		it('should analyze specific tasks', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--tasks', taskIds.join(',')],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Should analyze only specified tasks
			taskIds.forEach((taskId) => {
				expect(result.stdout).toContain(taskId);
			});
		});

		it('should filter by tag', async () => {
			// Create tag and tagged task
			await helpers.taskMaster('add-tag', ['complex-tag'], { cwd: testDir });
			const taggedResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Tagged complex task', '--tag', 'complex-tag'],
				{ cwd: testDir }
			);
			const taggedId = helpers.extractTaskId(taggedResult.stdout);

			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--tag', 'complex-tag'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain(taggedId);
		});

		it('should filter by status', async () => {
			// Set one task to completed
			await helpers.taskMaster('set-status', [taskIds[0], 'completed'], {
				cwd: testDir
			});

			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--status', 'pending'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			// Should not include completed task
			expect(result.stdout).not.toContain(taskIds[0]);
		});
	});

	describe('Threshold configuration', () => {
		it('should use custom thresholds', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[
					'--low-threshold',
					'3',
					'--medium-threshold',
					'7',
					'--high-threshold',
					'10'
				],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const output = result.stdout.toLowerCase();
			expect(output).toContain('low');
			expect(output).toContain('medium');
			expect(output).toContain('high');
		});

		it('should reject invalid thresholds', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--low-threshold', '-1'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
		});
	});

	describe('Edge cases', () => {
		it('should handle empty project', async () => {
			// Create a new temp directory
			const emptyDir = mkdtempSync(join(tmpdir(), 'task-master-empty-'));

			try {
				await helpers.taskMaster('init', ['-y'], { cwd: emptyDir });

				const result = await helpers.taskMaster('analyze-complexity', [], {
					cwd: emptyDir
				});

				expect(result).toHaveExitCode(0);
				expect(result.stdout.toLowerCase()).toMatch(/no tasks|0/);
			} finally {
				rmSync(emptyDir, { recursive: true, force: true });
			}
		});

		it('should handle invalid output path', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--output', '/invalid/path/report.json'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
		});
	});

	describe('Performance', () => {
		it('should analyze many tasks efficiently', async () => {
			// Create 20 more tasks
			const promises = [];
			for (let i = 0; i < 20; i++) {
				promises.push(
					helpers.taskMaster(
						'add-task',
						['--title', `Performance test task ${i}`],
						{ cwd: testDir }
					)
				);
			}
			await Promise.all(promises);

			const startTime = Date.now();
			const result = await helpers.taskMaster('analyze-complexity', [], {
				cwd: testDir
			});
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(duration).toBeLessThan(10000); // Should complete in less than 10 seconds
		});
	});

	describe('Complexity scoring', () => {
		it('should score complex tasks higher than simple ones', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--format', 'json'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			const analysis = JSON.parse(result.stdout);
			const simpleTask = analysis.tasks?.find((t) => t.id === taskIds[0]);
			const complexTask = analysis.tasks?.find((t) => t.id === taskIds[1]);

			expect(simpleTask).toBeDefined();
			expect(complexTask).toBeDefined();
			expect(complexTask.complexity).toBeGreaterThan(simpleTask.complexity);
		});
	});

	describe('Report generation', () => {
		it('should generate complexity report', async () => {
			// First run analyze-complexity to generate data
			await helpers.taskMaster(
				'analyze-complexity',
				['--output', '.taskmaster/reports/task-complexity-report.json'],
				{ cwd: testDir }
			);

			const result = await helpers.taskMaster('complexity-report', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toMatch(
				/complexity report|complexity/
			);
		});
	});
});
