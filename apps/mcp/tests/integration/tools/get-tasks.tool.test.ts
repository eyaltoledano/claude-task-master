/**
 * @fileoverview Integration tests for get_tasks MCP tool
 *
 * Tests the get_tasks MCP tool using the MCP inspector CLI.
 * This approach is simpler than a custom JSON-RPC client.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('get_tasks MCP tool', () => {
	let testDir: string;
	let tasksPath: string;
	let cliPath: string;
	let mcpServerPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-mcp-get-tasks-'));
		process.chdir(testDir);

		cliPath = path.resolve(__dirname, '../../../../../dist/task-master.js');
		mcpServerPath = path.resolve(
			__dirname,
			'../../../../../dist/mcp-server.js'
		);

		// Initialize Task Master in test directory
		execSync(`node "${cliPath}" init --yes`, {
			stdio: 'pipe',
			env: { ...process.env, TASKMASTER_SKIP_AUTO_UPDATE: '1' }
		});

		tasksPath = path.join(testDir, '.taskmaster', 'tasks', 'tasks.json');

		// Create initial empty tasks file using fixtures
		const initialTasks = createTasksFile();
		fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
	});

	afterEach(() => {
		// Change back to original directory and cleanup
		try {
			const originalDir = path.resolve(__dirname, '../../../../..');
			process.chdir(originalDir);
		} catch {
			process.chdir(os.homedir());
		}

		if (testDir && fs.existsSync(testDir)) {
			fs.rmSync(testDir, { recursive: true, force: true });
		}
	});

	const writeTasks = (tasksData: any) => {
		fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
	};

	/**
	 * Call an MCP tool using the inspector CLI
	 * The inspector returns MCP protocol format: { content: [{ type: "text", text: "<json>" }] }
	 */
	const callMCPTool = (toolName: string, args: Record<string, any>): any => {
		const toolArgs = Object.entries(args)
			.map(([key, value]) => `--tool-arg ${key}=${value}`)
			.join(' ');

		const output = execSync(
			`npx @modelcontextprotocol/inspector --cli node "${mcpServerPath}" --method tools/call --tool-name ${toolName} ${toolArgs}`,
			{ encoding: 'utf-8', stdio: 'pipe' }
		);

		// Parse the MCP protocol response: { content: [{ type: "text", text: "<json>" }] }
		const mcpResponse = JSON.parse(output);
		const resultText = mcpResponse.content[0].text;
		return JSON.parse(resultText);
	};

	it('should return empty task list when no tasks exist', () => {
		const data = callMCPTool('get_tasks', { projectRoot: testDir });

		expect(data.data.tasks).toEqual([]);
		expect(data.data.stats.total).toBe(0);
		expect(data.tag).toBe('master');
	}, 15000);

	it('should get all tasks with correct information', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Setup Environment',
					description: 'Install and configure',
					status: 'done',
					priority: 'high'
				}),
				createTask({
					id: 2,
					title: 'Write Tests',
					description: 'Create test suite',
					status: 'in-progress',
					priority: 'high',
					dependencies: ['1']
				}),
				createTask({
					id: 3,
					title: 'Implement Feature',
					description: 'Build the thing',
					status: 'pending',
					priority: 'medium',
					dependencies: ['2']
				})
			]
		});
		writeTasks(testData);

		const data = callMCPTool('get_tasks', { projectRoot: testDir });

		expect(data.data.tasks).toHaveLength(3);
		expect(data.data.tasks[0].title).toBe('Setup Environment');
		expect(data.data.tasks[1].title).toBe('Write Tests');
		expect(data.data.tasks[2].title).toBe('Implement Feature');
		expect(data.data.stats.total).toBe(3);
		expect(data.data.stats.completed).toBe(1);
		expect(data.data.stats.inProgress).toBe(1);
		expect(data.data.stats.pending).toBe(1);
	}, 15000);

	it('should filter tasks by status', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done Task', status: 'done' }),
				createTask({ id: 2, title: 'Pending Task 1', status: 'pending' }),
				createTask({ id: 3, title: 'Pending Task 2', status: 'pending' }),
				createTask({ id: 4, title: 'In Progress', status: 'in-progress' })
			]
		});
		writeTasks(testData);

		const data = callMCPTool('get_tasks', {
			projectRoot: testDir,
			status: 'pending'
		});

		expect(data.data.tasks).toHaveLength(2);
		expect(data.data.tasks.every((t: any) => t.status === 'pending')).toBe(
			true
		);
	}, 15000);

	it('should include subtasks when requested', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({
					id: 1,
					title: 'Parent Task',
					status: 'in-progress',
					subtasks: [
						{
							id: '1.1',
							parentId: '1',
							title: 'First Subtask',
							description: 'First Subtask',
							status: 'done',
							priority: 'medium',
							dependencies: [],
							details: '',
							testStrategy: ''
						},
						{
							id: '1.2',
							parentId: '1',
							title: 'Second Subtask',
							description: 'Second Subtask',
							status: 'pending',
							priority: 'medium',
							dependencies: [],
							details: '',
							testStrategy: ''
						}
					]
				})
			]
		});
		writeTasks(testData);

		const data = callMCPTool('get_tasks', {
			projectRoot: testDir,
			withSubtasks: true
		});

		expect(data.data.tasks).toHaveLength(1);
		expect(data.data.tasks[0].subtasks).toHaveLength(2);
		expect(data.data.stats.subtasks.total).toBe(2);
		expect(data.data.stats.subtasks.completed).toBe(1);
		expect(data.data.stats.subtasks.pending).toBe(1);
	}, 15000);

	it('should calculate statistics correctly', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done 1', status: 'done' }),
				createTask({ id: 2, title: 'Done 2', status: 'done' }),
				createTask({ id: 3, title: 'Done 3', status: 'done' }),
				createTask({ id: 4, title: 'Pending', status: 'pending' })
			]
		});
		writeTasks(testData);

		const data = callMCPTool('get_tasks', { projectRoot: testDir });

		expect(data.data.stats.total).toBe(4);
		expect(data.data.stats.completed).toBe(3);
		expect(data.data.stats.pending).toBe(1);
		expect(data.data.stats.completionPercentage).toBe(75);
	}, 15000);

	it('should handle multiple status filters', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Done Task', status: 'done' }),
				createTask({ id: 2, title: 'Pending Task', status: 'pending' }),
				createTask({ id: 3, title: 'Blocked Task', status: 'blocked' }),
				createTask({ id: 4, title: 'In Progress', status: 'in-progress' })
			]
		});
		writeTasks(testData);

		const data = callMCPTool('get_tasks', {
			projectRoot: testDir,
			status: 'blocked,pending'
		});

		expect(data.data.tasks).toHaveLength(2);
		const statuses = data.data.tasks.map((t: any) => t.status);
		expect(statuses).toContain('pending');
		expect(statuses).toContain('blocked');
	}, 15000);
});
