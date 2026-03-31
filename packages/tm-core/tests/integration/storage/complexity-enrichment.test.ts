/**
 * @fileoverview Integration test for complexity enrichment in list command
 *
 * This test reproduces the bug where task complexity is not shown in `list`
 * after running `analyze-complexity` with a tag.
 *
 * Bug: https://github.com/eyaltoledano/claude-task-master/issues/1614
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileStorage } from '../../../src/modules/storage/adapters/file-storage/file-storage.js';
import type { Task, ComplexityReport } from '../../../src/common/types/index.js';

describe('Complexity Enrichment Integration Test', () => {
	let tempDir: string;
	let storage: FileStorage;

	beforeEach(async () => {
		// Create a temporary directory for testing
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tm-complexity-test-'));

		// Initialize storage
		storage = new FileStorage(tempDir);
		await storage.initialize();
	});

	afterEach(async () => {
		// Cleanup
		await storage.close();
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	it('should enrich tasks with complexity data for tagged tasks', async () => {
		const tag = 'foo';

		// Step 1: Create tasks with the 'foo' tag
		const tasks: Task[] = [
			{
				id: '1',
				title: 'Implement authentication',
				description: 'Add JWT-based auth',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				subtasks: [],
				tags: [tag]
			},
			{
				id: '2',
				title: 'Create API endpoints',
				description: 'Build REST API',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				subtasks: [],
				tags: [tag]
			}
		];

		await storage.saveTasks(tasks, tag);

		// Step 2: Create a complexity report for the 'foo' tag
		const reportsDir = path.join(tempDir, '.taskmaster', 'reports');
		await fs.mkdir(reportsDir, { recursive: true });

		const complexityReport: ComplexityReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 2,
				thresholdScore: 5,
				usedResearch: false
			},
			complexityAnalysis: [
				{
					taskId: '1',
					taskTitle: 'Implement authentication',
					complexityScore: 8,
					recommendedSubtasks: 5,
					complexityReasoning: 'High complexity due to security concerns',
					expansionPrompt: 'Break down auth into smaller tasks'
				},
				{
					taskId: '2',
					taskTitle: 'Create API endpoints',
					complexityScore: 6,
					recommendedSubtasks: 4,
					complexityReasoning: 'Moderate complexity',
					expansionPrompt: 'Split by endpoint functionality'
				}
			]
		};

		const reportPath = path.join(reportsDir, `task-complexity-report_${tag}.json`);
		await fs.writeFile(reportPath, JSON.stringify(complexityReport, null, 2), 'utf-8');

		// Step 3: Load tasks with the tag - complexity should be enriched
		const loadedTasks = await storage.loadTasks(tag);

		// Verify tasks were loaded
		expect(loadedTasks).toHaveLength(2);

		// Step 4: Verify complexity data was enriched
		const task1 = loadedTasks.find(t => t.id === '1');
		const task2 = loadedTasks.find(t => t.id === '2');

		expect(task1).toBeDefined();
		expect(task2).toBeDefined();

		// BUG: These assertions should pass but currently fail
		expect(task1!.complexity).toBe(8);
		expect(task1!.recommendedSubtasks).toBe(5);
		expect(task1!.expansionPrompt).toBe('Break down auth into smaller tasks');

		expect(task2!.complexity).toBe(6);
		expect(task2!.recommendedSubtasks).toBe(4);
		expect(task2!.expansionPrompt).toBe('Split by endpoint functionality');
	});

	it('should handle master tag complexity enrichment', async () => {
		// Test with default 'master' tag (no suffix in report filename)
		const tasks: Task[] = [
			{
				id: '1',
				title: 'Setup project',
				description: 'Initialize project structure',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				subtasks: [],
				tags: []
			}
		];

		await storage.saveTasks(tasks);

		// Create complexity report for master tag (no suffix)
		const reportsDir = path.join(tempDir, '.taskmaster', 'reports');
		await fs.mkdir(reportsDir, { recursive: true });

		const complexityReport: ComplexityReport = {
			meta: {
				generatedAt: new Date().toISOString(),
				tasksAnalyzed: 1,
				thresholdScore: 5,
				usedResearch: false
			},
			complexityAnalysis: [
				{
					taskId: '1',
					taskTitle: 'Setup project',
					complexityScore: 3,
					recommendedSubtasks: 2,
					complexityReasoning: 'Low complexity',
					expansionPrompt: 'Simple setup tasks'
				}
			]
		};

		const reportPath = path.join(reportsDir, 'task-complexity-report.json');
		await fs.writeFile(reportPath, JSON.stringify(complexityReport, null, 2), 'utf-8');

		// Load tasks without specifying tag (defaults to master)
		const loadedTasks = await storage.loadTasks();

		expect(loadedTasks).toHaveLength(1);
		expect(loadedTasks[0].complexity).toBe(3);
		expect(loadedTasks[0].recommendedSubtasks).toBe(2);
	});

	it('should return tasks without complexity when no report exists', async () => {
		const tag = 'no-report';
		const tasks: Task[] = [
			{
				id: '1',
				title: 'Test task',
				description: 'A test',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				subtasks: [],
				tags: [tag]
			}
		];

		await storage.saveTasks(tasks, tag);
		const loadedTasks = await storage.loadTasks(tag);

		expect(loadedTasks).toHaveLength(1);
		expect(loadedTasks[0].complexity).toBeUndefined();
		expect(loadedTasks[0].recommendedSubtasks).toBeUndefined();
	});
});
