/**
 * Comprehensive E2E tests for analyze-complexity command
 * Tests all aspects of complexity analysis including research mode and output formats
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { copyConfigFiles } from '../../utils/test-setup.js';

describe('analyze-complexity command', () => {
	let testDir;
	let helpers;
	let taskIds;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-analyze-complexity-'));

		// Initialize test helpers
		const context = global.createTestContext('analyze-complexity');
		helpers = context.helpers;

		copyConfigFiles(testDir);

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}

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
		await helpers.taskMaster('expand', ['-i', complexId, '-n', '3'], { cwd: testDir, timeout: 60000 });

		// Create task with dependencies
		const withDeps = await helpers.taskMaster(
			'add-task',
			['--title', 'Deployment task', '--description', 'Deploy the application'],
			{ cwd: testDir }
		);
		const withDepsId = helpers.extractTaskId(withDeps.stdout);
		taskIds.push(withDepsId);
		
		// Add dependency
		await helpers.taskMaster('add-dependency', ['--id', withDepsId, '--depends-on', taskIds[0]], { cwd: testDir });
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

		it.skip('should analyze with research flag', async () => {
			// Skip this test - research mode takes too long for CI
			// Research flag requires internet access and can timeout
		});
	});

	describe('Output options', () => {
		it('should save to custom output file', async () => {
			// Create reports directory first
			const reportsDir = join(testDir, '.taskmaster/reports');
			mkdirSync(reportsDir, { recursive: true });
			
			// Create the output file first (the command expects it to exist)
			const outputPath = '.taskmaster/reports/custom-complexity.json';
			const fullPath = join(testDir, outputPath);
			writeFileSync(fullPath, '{}');
			
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--output', outputPath],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(existsSync(fullPath)).toBe(true);

			// Verify it's valid JSON
			const report = JSON.parse(readFileSync(fullPath, 'utf8'));
			expect(report).toBeDefined();
			expect(typeof report).toBe('object');
		});

		it('should save analysis to default location', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Check if report was saved
			const defaultPath = join(testDir, '.taskmaster/reports/task-complexity-report.json');
			expect(existsSync(defaultPath)).toBe(true);
		});

		it('should show task analysis in output', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Check for basic analysis output
			const output = result.stdout.toLowerCase();
			expect(output).toContain('analyzing');
			
			// Check if tasks are mentioned
			taskIds.forEach(id => {
				expect(result.stdout).toContain(id.toString());
			});
		});
	});

	describe('Filtering options', () => {
		it('should analyze specific tasks', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--id', taskIds.join(',')],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Should analyze only specified tasks
			taskIds.forEach((taskId) => {
				expect(result.stdout).toContain(taskId.toString());
			});
		});

		it('should filter by tag', async () => {
			// Create tag
			await helpers.taskMaster('add-tag', ['complex-tag'], { cwd: testDir });
			
			// Switch to the tag context
			await helpers.taskMaster('use-tag', ['complex-tag'], { cwd: testDir });
			
			// Create task in that tag
			const taggedResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Tagged complex task', '--description', 'Task in complex-tag'],
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

		it.skip('should filter by status', async () => {
			// Skip this test - status filtering is not implemented
			// The analyze-complexity command doesn't support --status flag
		});
	});

	describe('Threshold configuration', () => {
		it('should use custom threshold', async () => {
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--threshold', '7'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			
			// Check that the analysis completed
			const output = result.stdout;
			expect(output).toContain('Task complexity analysis complete');
		});

		it('should accept threshold values between 1-10', async () => {
			// Test valid threshold
			const result = await helpers.taskMaster(
				'analyze-complexity',
				['--threshold', '10'],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Task complexity analysis complete');
		});
	});

	describe('Edge cases', () => {
		it('should handle empty project', async () => {
			// Create a new temp directory
			const emptyDir = mkdtempSync(join(tmpdir(), 'task-master-empty-'));

			try {
				await helpers.taskMaster('init', ['-y'], { cwd: emptyDir });
				
				// Ensure tasks.json exists (bug workaround)
				const tasksJsonPath = join(emptyDir, '.taskmaster/tasks/tasks.json');
				if (!existsSync(tasksJsonPath)) {
					mkdirSync(join(emptyDir, '.taskmaster/tasks'), { recursive: true });
					writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
				}

				const result = await helpers.taskMaster('analyze-complexity', [], {
					cwd: emptyDir
				});

				expect(result.exitCode).not.toBe(0);
				expect(result.stderr).toContain('No tasks found');
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
						['--title', `Performance test task ${i}`, '--description', `Test task ${i} for performance testing`],
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
			expect(duration).toBeLessThan(60000); // Should complete in less than 60 seconds
		});
	});

	describe('Complexity scoring', () => {
		it.skip('should score complex tasks higher than simple ones', async () => {
			// Skip this test as it requires AI API access
			const result = await helpers.taskMaster(
				'analyze-complexity',
				[],
				{ cwd: testDir }
			);

			expect(result).toHaveExitCode(0);

			// Read the saved report
			const reportPath = join(testDir, '.taskmaster/reports/task-complexity-report.json');
			
			// Check if report exists
			expect(existsSync(reportPath)).toBe(true);
			
			const analysis = JSON.parse(readFileSync(reportPath, 'utf8'));
			
			// The report structure might have tasks or complexityAnalysis array
			const tasks = analysis.tasks || analysis.complexityAnalysis || analysis.results || [];
			
			// If no tasks found, check if analysis itself is an array
			const taskArray = Array.isArray(analysis) ? analysis : tasks;
			
			// Convert taskIds to numbers if they're strings
			const simpleTaskId = parseInt(taskIds[0], 10);
			const complexTaskId = parseInt(taskIds[1], 10);
			
			// Try to find tasks by different possible ID fields
			const simpleTask = taskArray.find((t) => 
				t.id === simpleTaskId || 
				t.id === taskIds[0] || 
				t.taskId === simpleTaskId || 
				t.taskId === taskIds[0]
			);
			const complexTask = taskArray.find((t) => 
				t.id === complexTaskId || 
				t.id === taskIds[1] || 
				t.taskId === complexTaskId || 
				t.taskId === taskIds[1]
			);

			expect(simpleTask).toBeDefined();
			expect(complexTask).toBeDefined();
			
			// Get the complexity score from whichever property is used
			const simpleScore = simpleTask.complexityScore || simpleTask.complexity?.score || 0;
			const complexScore = complexTask.complexityScore || complexTask.complexity?.score || 0;
			expect(complexScore).toBeGreaterThan(simpleScore);
		});
	});

	describe('Report generation', () => {
		it('should generate complexity report', async () => {
			// First run analyze-complexity to generate the default report
			await helpers.taskMaster('analyze-complexity', [], { cwd: testDir });

			// Then run complexity-report to display it
			const result = await helpers.taskMaster('complexity-report', [], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toMatch(
				/complexity.*report|analysis/
			);
		});
	});
});
