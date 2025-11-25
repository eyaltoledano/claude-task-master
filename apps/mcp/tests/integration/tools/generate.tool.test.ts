/**
 * @fileoverview Integration tests for generate MCP tool
 *
 * Tests MCP-specific behavior: tool response format, parameter handling.
 * Core file generation logic is tested in tm-core's task-file-generator.service.spec.ts.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTask, createTasksFile } from '@tm/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('generate MCP tool', () => {
	let testDir: string;
	let tasksPath: string;
	let cliPath: string;
	let mcpServerPath: string;

	beforeEach(() => {
		testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-mcp-generate-'));
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

	// ========== MCP-specific tests ==========

	it('should return MCP response with data object on success', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const response = callMCPTool('generate', { projectRoot: testDir });

		// Verify MCP response structure
		expect(response).toHaveProperty('data');
		expect(response.data).toHaveProperty('count');
		expect(response.data).toHaveProperty('directory');
		expect(response.data).toHaveProperty('message');
	}, 15000);

	it('should include tag in response', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const response = callMCPTool('generate', { projectRoot: testDir });

		expect(response.tag).toBe('master');
	}, 15000);

	it('should return count of generated files', () => {
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' }),
				createTask({ id: 3, title: 'Task 3', status: 'pending' })
			]
		});
		writeTasks(testData);

		const response = callMCPTool('generate', { projectRoot: testDir });

		expect(response.data.count).toBe(3);
	}, 15000);

	it('should return zero count when no tasks exist', () => {
		const response = callMCPTool('generate', { projectRoot: testDir });

		expect(response.data.count).toBe(0);
	}, 15000);

	it('should return orphanedFilesRemoved count', () => {
		// Create tasks and generate files
		const testData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' }),
				createTask({ id: 3, title: 'Task 3', status: 'pending' })
			]
		});
		writeTasks(testData);
		callMCPTool('generate', { projectRoot: testDir });

		// Remove task 3 and regenerate
		const reducedData = createTasksFile({
			tasks: [
				createTask({ id: 1, title: 'Task 1', status: 'pending' }),
				createTask({ id: 2, title: 'Task 2', status: 'pending' })
			]
		});
		writeTasks(reducedData);

		const response = callMCPTool('generate', { projectRoot: testDir });

		expect(response.data.orphanedFilesRemoved).toBe(1);
	}, 15000);

	it('should accept output parameter for custom directory', () => {
		const testData = createTasksFile({
			tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })]
		});
		writeTasks(testData);

		const customDir = path.join(testDir, 'custom-tasks');

		const response = callMCPTool('generate', {
			projectRoot: testDir,
			output: customDir
		});

		expect(response.data.directory).toBe(customDir);
	}, 15000);

	it('should accept tag parameter', () => {
		// Create tasks under a custom tag (not master)
		const testData = {
			master: { tasks: [], metadata: {} },
			'feature-branch': {
				tasks: [createTask({ id: 1, title: 'Test Task', status: 'pending' })],
				metadata: {}
			}
		};
		writeTasks(testData);

		const response = callMCPTool('generate', {
			projectRoot: testDir,
			tag: 'feature-branch'
		});

		expect(response.data.count).toBe(1);

		// Verify tag-specific file was created
		const outputDir = path.join(testDir, '.taskmaster', 'tasks');
		expect(
			fs.existsSync(path.join(outputDir, 'task_001_feature-branch.md'))
		).toBe(true);
	}, 15000);
});
