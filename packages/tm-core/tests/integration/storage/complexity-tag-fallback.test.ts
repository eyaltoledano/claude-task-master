import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStorage } from '../../../src/modules/storage/adapters/file-storage/file-storage.js';

describe('Complexity enrichment with tag fallback (issue #1614)', () => {
	let tempDir: string;
	let storage: FileStorage;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskmaster-test-'));
		fs.mkdirSync(path.join(tempDir, '.taskmaster', 'tasks'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.taskmaster', 'reports'), { recursive: true });
		storage = new FileStorage(tempDir);
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	it('should enrich tasks with complexity when tag falls back from master to actual tag', async () => {
		const tasksFile = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');
		fs.writeFileSync(tasksFile, JSON.stringify({
			foo: {
				tasks: [
					{ id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'high', dependencies: [], details: '', testStrategy: '', subtasks: [] },
					{ id: '2', title: 'Task 2', description: '', status: 'pending', priority: 'medium', dependencies: ['1'], details: '', testStrategy: '', subtasks: [] }
				],
				metadata: { version: '1.0.0', lastModified: new Date().toISOString(), taskCount: 2, completedCount: 0, tags: ['foo'] }
			}
		}, null, 2));

		const reportFile = path.join(tempDir, '.taskmaster', 'reports', 'task-complexity-report_foo.json');
		fs.writeFileSync(reportFile, JSON.stringify({
			meta: { generatedAt: new Date().toISOString(), taskCount: 2, thresholds: { high: 8, medium: 5 } },
			complexityAnalysis: [
				{ taskId: 1, taskTitle: 'Task 1', complexityScore: 7, recommendedSubtasks: 4, expansionPrompt: 'p', complexityReasoning: 'r' },
				{ taskId: 2, taskTitle: 'Task 2', complexityScore: 3, recommendedSubtasks: 2, expansionPrompt: 'p', complexityReasoning: 'r' }
			]
		}, null, 2));

		const tasks = await storage.loadTasks();
		expect(tasks).toHaveLength(2);
		const task1 = tasks.find((t) => String(t.id) === '1');
		const task2 = tasks.find((t) => String(t.id) === '2');
		expect(task1!.complexity).toBe(7);
		expect(task2!.complexity).toBe(3);
	});

	it('should enrich tasks with complexity when explicit tag matches report', async () => {
		const tasksFile = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');
		fs.writeFileSync(tasksFile, JSON.stringify({
			bar: {
				tasks: [{ id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', dependencies: [], details: '', testStrategy: '', subtasks: [] }],
				metadata: { version: '1.0.0', lastModified: new Date().toISOString(), taskCount: 1, completedCount: 0, tags: ['bar'] }
			}
		}, null, 2));

		const reportFile = path.join(tempDir, '.taskmaster', 'reports', 'task-complexity-report_bar.json');
		fs.writeFileSync(reportFile, JSON.stringify({
			meta: { generatedAt: new Date().toISOString(), taskCount: 1, thresholds: { high: 8, medium: 5 } },
			complexityAnalysis: [{ taskId: 1, taskTitle: 'Task 1', complexityScore: 9, recommendedSubtasks: 6, expansionPrompt: 'p', complexityReasoning: 'r' }]
		}, null, 2));

		const tasks = await storage.loadTasks('bar');
		expect(tasks).toHaveLength(1);
		expect(tasks[0].complexity).toBe(9);
	});

	it('should return undefined complexity when no report exists', async () => {
		const tasksFile = path.join(tempDir, '.taskmaster', 'tasks', 'tasks.json');
		fs.writeFileSync(tasksFile, JSON.stringify({
			tasks: [{ id: '1', title: 'Task 1', description: '', status: 'pending', priority: 'medium', dependencies: [], details: '', testStrategy: '', subtasks: [] }],
			metadata: { version: '1.0.0', lastModified: new Date().toISOString(), taskCount: 1, completedCount: 0 }
		}, null, 2));

		const tasks = await storage.loadTasks();
		expect(tasks).toHaveLength(1);
		expect(tasks[0].complexity).toBeUndefined();
	});
});
