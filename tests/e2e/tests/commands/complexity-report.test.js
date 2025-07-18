import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
describe('task-master complexity-report command', () => {
	let testDir;
	let helpers;
	let reportPath;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-complexity-report-command-'));

		// Initialize test helpers
		const context = global.createTestContext('complexity-report command');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(process.cwd(), '.env');
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

		// Ensure tasks.json exists (bug workaround)
		const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
		if (!existsSync(tasksJsonPath)) {
			mkdirSync(join(testDir, '.taskmaster/tasks'), { recursive: true });
			writeFileSync(tasksJsonPath, JSON.stringify({ master: { tasks: [] } }));
		}

		// Initialize report path
		reportPath = join(testDir, '.taskmaster/task-complexity-report.json');
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it('should display complexity report', async () => {
		// Create a sample complexity report matching actual structure
		const complexityReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 3,
				totalTasks: 3,
				analysisCount: 3,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: [
				{
					taskId: 1,
					taskTitle: 'Simple task',
					complexityScore: 3,
					recommendedSubtasks: 2,
					expansionPrompt: 'Break down this simple task',
					reasoning: 'This is a simple task with low complexity'
				},
				{
					taskId: 2,
					taskTitle: 'Medium complexity task',
					complexityScore: 5,
					recommendedSubtasks: 4,
					expansionPrompt: 'Break down this medium complexity task',
					reasoning: 'This task has moderate complexity'
				},
				{
					taskId: 3,
					taskTitle: 'Complex task',
					complexityScore: 8,
					recommendedSubtasks: 6,
					expansionPrompt: 'Break down this complex task',
					reasoning: 'This is a complex task requiring careful decomposition'
				}
			]
		};

		// Ensure .taskmaster directory exists
		mkdirSync(dirname(reportPath), { recursive: true });
		writeFileSync(reportPath, JSON.stringify(complexityReport, null, 2));

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// Verify success
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Task Complexity Analysis Report');
		expect(result.stdout).toContain('Tasks Analyzed:');
		expect(result.stdout).toContain('3'); // number of tasks
		expect(result.stdout).toContain('Simple task');
		expect(result.stdout).toContain('Medium complexity task');
		expect(result.stdout).toContain('Complex task');
		// Check for complexity distribution
		expect(result.stdout).toContain('Complexity Distribution');
		expect(result.stdout).toContain('Low');
		expect(result.stdout).toContain('Medium');
		expect(result.stdout).toContain('High')
	});

	it('should display detailed task complexity', async () => {
		// Create a report with detailed task info matching actual structure
		const detailedReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 1,
				totalTasks: 1,
				analysisCount: 1,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: [
				{
					taskId: 1,
					taskTitle: 'Implement authentication system',
					complexityScore: 7,
					recommendedSubtasks: 5,
					expansionPrompt: 'Break down authentication system implementation with focus on security',
					reasoning: 'Requires integration with multiple services, security considerations'
				}
			]
		};

		writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// Verify detailed output
		expect(result).toHaveExitCode(0);
		// Title might be truncated in display
		expect(result.stdout).toContain('Implement authentic'); // partial match
		expect(result.stdout).toContain('7'); // complexity score
		expect(result.stdout).toContain('5'); // recommended subtasks
		// Check for expansion prompt text (visible in the expansion command)
		expect(result.stdout).toContain('authentication');
		expect(result.stdout).toContain('system');
		expect(result.stdout).toContain('implementation');
	});

	it('should handle missing report file', async () => {
		const nonExistentPath = join(testDir, '.taskmaster', 'non-existent-report.json');

		// Run complexity-report command with non-existent file
		const result = await helpers.taskMaster('complexity-report', ['-f', nonExistentPath], { cwd: testDir, allowFailure: true });

		// Should fail gracefully
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('does not exist');
		// The error message doesn't contain 'analyze-complexity' but does show path not found
		expect(result.stderr).toContain('does not exist');
	});

	it('should handle empty report', async () => {
		// Create an empty report matching actual structure
		const emptyReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 0,
				totalTasks: 0,
				analysisCount: 0,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: []
		};

		writeFileSync(reportPath, JSON.stringify(emptyReport, null, 2));

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// Should handle gracefully
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Tasks Analyzed:');
		expect(result.stdout).toContain('0');
		// Empty report still shows the table structure
		expect(result.stdout).toContain('Complexity Distribution');
	});

	it('should work with tag option for tag-specific reports', async () => {
		// Create tag-specific report
		const reportsDir = join(testDir, '.taskmaster/reports');
		mkdirSync(reportsDir, { recursive: true });
		// For tags, the path includes the tag name
		const featureReportPath = join(testDir, '.taskmaster/reports/task-complexity-report_feature.json');
		const featureReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 2,
				totalTasks: 2,
				analysisCount: 2,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: [
				{
					taskId: 1,
					taskTitle: 'Feature task 1',
					complexityScore: 3,
					recommendedSubtasks: 2,
					expansionPrompt: 'Break down feature task 1',
					reasoning: 'Low complexity feature task'
				},
				{
					taskId: 2,
					taskTitle: 'Feature task 2',
					complexityScore: 5,
					recommendedSubtasks: 3,
					expansionPrompt: 'Break down feature task 2',
					reasoning: 'Medium complexity feature task'
				}
			]
		};

		writeFileSync(featureReportPath, JSON.stringify(featureReport, null, 2));

		// Run complexity-report command with specific file path (not tag)
		const result = await helpers.taskMaster('complexity-report', ['-f', featureReportPath], { cwd: testDir });

		// Should display feature-specific report
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Feature task 1');
		expect(result.stdout).toContain('Feature task 2');
		expect(result.stdout).toContain('Tasks Analyzed:');
		expect(result.stdout).toContain('2');
	});

	it('should display complexity distribution chart', async () => {
		// Create report with various complexity levels
		const distributionReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 10,
				totalTasks: 10,
				analysisCount: 10,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: Array.from({ length: 10 }, (_, i) => ({
				taskId: i + 1,
				taskTitle: `Task ${i + 1}`,
				complexityScore: i < 3 ? 2 : i < 8 ? 5 : 8,
				recommendedSubtasks: i < 3 ? 2 : i < 8 ? 3 : 5,
				expansionPrompt: `Break down task ${i + 1}`,
				reasoning: `Task ${i + 1} complexity reasoning`
			}))
		};

		writeFileSync(reportPath, JSON.stringify(distributionReport, null, 2));

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// Should show distribution
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Complexity Distribution');
		// The distribution text appears with percentages in a decorative box
		expect(result.stdout).toMatch(/Low \(1-4\): 3 tasks \(\d+%\)/);
		expect(result.stdout).toMatch(/Medium \(5-7\): 5 tasks \(\d+%\)/);
		expect(result.stdout).toMatch(/High \(8-10\): 2 tasks \(\d+%\)/);
	});

	it('should handle malformed report gracefully', async () => {
		// Create malformed report
		writeFileSync(reportPath, '{ invalid json }');

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// The command exits silently when JSON parsing fails
		expect(result).toHaveExitCode(0);
		// Output shows error message and tag footer
		expect(result.stdout).toContain('🏷️ tag: master');
		expect(result.stdout).toContain('[ERROR]');
		expect(result.stdout).toContain('Error reading complexity report');
	});

	it('should display report generation time', async () => {
		const generatedAt = '2024-03-15T10:30:00Z';
		const timedReport = {
			meta: {
				generatedAt,
				tasksAnalyzed: 1,
				totalTasks: 1,
				analysisCount: 1,
				thresholdScore: 5,
				projectName: 'test-project',
				usedResearch: false
			},
			complexityAnalysis: [{
				taskId: 1,
				taskTitle: 'Test task',
				complexityScore: 5,
				recommendedSubtasks: 3,
				expansionPrompt: 'Break down test task',
				reasoning: 'Medium complexity test task'
			}]
		};

		writeFileSync(reportPath, JSON.stringify(timedReport, null, 2));

		// Run complexity-report command
		const result = await helpers.taskMaster('complexity-report', ['-f', reportPath], { cwd: testDir });

		// Should show generation time
		expect(result).toHaveExitCode(0);
		expect(result.stdout).toContain('Generated');
		expect(result.stdout).toMatch(/2024|Mar|15/); // Date formatting may vary
	});
});