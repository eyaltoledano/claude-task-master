import analyzeTaskComplexity from '../../../scripts/modules/task-manager/analyze-task-complexity.js';
import { readJSON } from '../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

describe('analyze-complexity with generateObject', () => {
	const testTasksFile = path.join(process.cwd(), 'test-tasks.json');
	const testComplexityFile = path.join(process.cwd(), 'test-complexity.json');

	beforeEach(() => {
		// Create a test tasks file
		const testTasks = {
			projectName: 'Test Project',
			tasks: [
				{
					id: 1,
					title: 'Setup project structure',
					description: 'Initialize the project with proper folder structure',
					status: 'pending',
					dependencies: [],
					priority: 'high'
				},
				{
					id: 2,
					title: 'Implement authentication',
					description: 'Add user authentication with JWT tokens',
					status: 'pending',
					dependencies: [1],
					priority: 'high'
				}
			]
		};
		fs.writeFileSync(testTasksFile, JSON.stringify(testTasks, null, 2));
	});

	afterEach(() => {
		// Clean up test files
		if (fs.existsSync(testTasksFile)) {
			fs.unlinkSync(testTasksFile);
		}
		if (fs.existsSync(testComplexityFile)) {
			fs.unlinkSync(testComplexityFile);
		}
	});

	test('should return structured complexity analysis', async () => {
		const result = await analyzeTaskComplexity({
			file: testTasksFile,
			output: testComplexityFile,
			threshold: 5
		});

		expect(result).toHaveProperty('report');
		expect(result.report).toHaveProperty('complexityAnalysis');
		expect(Array.isArray(result.report.complexityAnalysis)).toBe(true);

		if (result.report.complexityAnalysis.length > 0) {
			const analysis = result.report.complexityAnalysis[0];
			expect(analysis).toHaveProperty('taskId');
			expect(analysis).toHaveProperty('taskTitle');
			expect(analysis).toHaveProperty('complexityScore');
			expect(analysis).toHaveProperty('recommendedSubtasks');
			expect(analysis).toHaveProperty('expansionPrompt');
			expect(analysis).toHaveProperty('reasoning');

			// Check that the values are of the correct type
			expect(typeof analysis.taskId).toBe('number');
			expect(typeof analysis.taskTitle).toBe('string');
			expect(typeof analysis.complexityScore).toBe('number');
			expect(analysis.complexityScore).toBeGreaterThanOrEqual(1);
			expect(analysis.complexityScore).toBeLessThanOrEqual(10);
			expect(typeof analysis.recommendedSubtasks).toBe('number');
			expect(typeof analysis.expansionPrompt).toBe('string');
			expect(typeof analysis.reasoning).toBe('string');
		}
	}, 30000); // Increase timeout for AI call
});
