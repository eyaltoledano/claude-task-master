import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestEnvironment, cleanupTestEnvironment, runCommand } from '../../utils/test-helpers.js';
import path from 'path';
import fs from 'fs';

describe('complexity-report command', () => {
	let testDir;
	let reportPath;

	beforeAll(() => {
		testDir = setupTestEnvironment('complexity-report-command');
		reportPath = path.join(testDir, '.taskmaster', 'task-complexity-report.json');
	});

	afterAll(() => {
		cleanupTestEnvironment(testDir);
	});

	it('should display complexity report', async () => {
		// Create a sample complexity report
		const complexityReport = {
			generatedAt: new Date().toISOString(),
			totalTasks: 3,
			averageComplexity: 5.33,
			complexityDistribution: {
				low: 1,
				medium: 1,
				high: 1
			},
			tasks: [
				{
					id: 1,
					description: 'Simple task',
					complexity: {
						score: 3,
						level: 'low',
						factors: {
							technical: 'low',
							scope: 'small',
							dependencies: 'none',
							uncertainty: 'low'
						}
					}
				},
				{
					id: 2,
					description: 'Medium complexity task',
					complexity: {
						score: 5,
						level: 'medium',
						factors: {
							technical: 'medium',
							scope: 'medium',
							dependencies: 'some',
							uncertainty: 'medium'
						}
					}
				},
				{
					id: 3,
					description: 'Complex task',
					complexity: {
						score: 8,
						level: 'high',
						factors: {
							technical: 'high',
							scope: 'large',
							dependencies: 'many',
							uncertainty: 'high'
						}
					}
				}
			]
		};

		// Ensure .taskmaster directory exists
		fs.mkdirSync(path.dirname(reportPath), { recursive: true });
		fs.writeFileSync(reportPath, JSON.stringify(complexityReport, null, 2));

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Verify success
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Complexity Analysis Report');
		expect(result.stdout).toContain('Total Tasks: 3');
		expect(result.stdout).toContain('Average Complexity: 5.33');
		expect(result.stdout).toContain('Simple task');
		expect(result.stdout).toContain('Medium complexity task');
		expect(result.stdout).toContain('Complex task');
		expect(result.stdout).toContain('Low: 1');
		expect(result.stdout).toContain('Medium: 1');
		expect(result.stdout).toContain('High: 1');
	});

	it('should display detailed task complexity', async () => {
		// Create a report with detailed task info
		const detailedReport = {
			generatedAt: new Date().toISOString(),
			totalTasks: 1,
			averageComplexity: 7,
			tasks: [
				{
					id: 1,
					description: 'Implement authentication system',
					complexity: {
						score: 7,
						level: 'high',
						factors: {
							technical: 'high',
							scope: 'large',
							dependencies: 'many',
							uncertainty: 'medium'
						},
						reasoning: 'Requires integration with multiple services, security considerations'
					},
					subtasks: [
						{
							id: '1.1',
							description: 'Setup JWT tokens',
							complexity: {
								score: 5,
								level: 'medium'
							}
						},
						{
							id: '1.2',
							description: 'Implement OAuth2',
							complexity: {
								score: 6,
								level: 'medium'
							}
						}
					]
				}
			]
		};

		fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Verify detailed output
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Implement authentication system');
		expect(result.stdout).toContain('Score: 7');
		expect(result.stdout).toContain('Technical: high');
		expect(result.stdout).toContain('Scope: large');
		expect(result.stdout).toContain('Dependencies: many');
		expect(result.stdout).toContain('Setup JWT tokens');
		expect(result.stdout).toContain('Implement OAuth2');
	});

	it('should handle missing report file', async () => {
		const nonExistentPath = path.join(testDir, '.taskmaster', 'non-existent-report.json');

		// Run complexity-report command with non-existent file
		const result = await runCommand(
			'complexity-report',
			['-f', nonExistentPath],
			testDir
		);

		// Should fail gracefully
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
		expect(result.stderr).toContain('not found');
		expect(result.stderr).toContain('analyze-complexity');
	});

	it('should handle empty report', async () => {
		// Create an empty report
		const emptyReport = {
			generatedAt: new Date().toISOString(),
			totalTasks: 0,
			averageComplexity: 0,
			tasks: []
		};

		fs.writeFileSync(reportPath, JSON.stringify(emptyReport, null, 2));

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Should handle gracefully
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Total Tasks: 0');
		expect(result.stdout).toContain('No tasks analyzed');
	});

	it('should work with tag option for tag-specific reports', async () => {
		// Create tag-specific report
		const featureReportPath = path.join(testDir, '.taskmaster', 'task-complexity-report_feature.json');
		const featureReport = {
			generatedAt: new Date().toISOString(),
			totalTasks: 2,
			averageComplexity: 4,
			tag: 'feature',
			tasks: [
				{
					id: 1,
					description: 'Feature task 1',
					complexity: {
						score: 3,
						level: 'low'
					}
				},
				{
					id: 2,
					description: 'Feature task 2',
					complexity: {
						score: 5,
						level: 'medium'
					}
				}
			]
		};

		fs.writeFileSync(featureReportPath, JSON.stringify(featureReport, null, 2));

		// Run complexity-report command with tag
		const result = await runCommand(
			'complexity-report',
			['--tag', 'feature'],
			testDir
		);

		// Should display feature-specific report
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Feature task 1');
		expect(result.stdout).toContain('Feature task 2');
		expect(result.stdout).toContain('Total Tasks: 2');
	});

	it('should display complexity distribution chart', async () => {
		// Create report with various complexity levels
		const distributionReport = {
			generatedAt: new Date().toISOString(),
			totalTasks: 10,
			averageComplexity: 5.5,
			complexityDistribution: {
				low: 3,
				medium: 5,
				high: 2
			},
			tasks: Array.from({ length: 10 }, (_, i) => ({
				id: i + 1,
				description: `Task ${i + 1}`,
				complexity: {
					score: i < 3 ? 2 : i < 8 ? 5 : 8,
					level: i < 3 ? 'low' : i < 8 ? 'medium' : 'high'
				}
			}))
		};

		fs.writeFileSync(reportPath, JSON.stringify(distributionReport, null, 2));

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Should show distribution
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Complexity Distribution');
		expect(result.stdout).toContain('Low: 3');
		expect(result.stdout).toContain('Medium: 5');
		expect(result.stdout).toContain('High: 2');
	});

	it('should handle malformed report gracefully', async () => {
		// Create malformed report
		fs.writeFileSync(reportPath, '{ invalid json }');

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Should fail gracefully
		expect(result.code).toBe(1);
		expect(result.stderr).toContain('Error');
	});

	it('should display report generation time', async () => {
		const generatedAt = '2024-03-15T10:30:00Z';
		const timedReport = {
			generatedAt,
			totalTasks: 1,
			averageComplexity: 5,
			tasks: [{
				id: 1,
				description: 'Test task',
				complexity: { score: 5, level: 'medium' }
			}]
		};

		fs.writeFileSync(reportPath, JSON.stringify(timedReport, null, 2));

		// Run complexity-report command
		const result = await runCommand(
			'complexity-report',
			['-f', reportPath],
			testDir
		);

		// Should show generation time
		expect(result.code).toBe(0);
		expect(result.stdout).toContain('Generated');
		expect(result.stdout).toMatch(/2024|Mar|15/); // Date formatting may vary
	});
});