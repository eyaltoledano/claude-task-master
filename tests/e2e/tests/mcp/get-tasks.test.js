import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../../..');

describe('MCP Server - get_tasks tool', () => {
	let client;
	let transport;

	beforeAll(async () => {
		// Create transport by spawning the server
		transport = new StdioClientTransport({
			command: 'node',
			args: ['mcp-server/server.js'],
			env: process.env,
			cwd: projectRoot
		});

		// Create client
		client = new Client(
			{
				name: 'test-client',
				version: '1.0.0'
			},
			{
				capabilities: {
					sampling: {}
				}
			}
		);

		// Connect to server
		await client.connect(transport);
	});

	afterAll(async () => {
		if (client) {
			await client.close();
		}
	});

	it('should connect to MCP server successfully', async () => {
		const tools = await client.listTools();
		expect(tools.tools).toBeDefined();
		expect(tools.tools.length).toBeGreaterThan(0);

		const toolNames = tools.tools.map((t) => t.name);
		expect(toolNames).toContain('get_tasks');
		expect(toolNames).toContain('initialize_project');
	});

	it('should initialize project successfully', async () => {
		const result = await client.callTool({
			name: 'initialize_project',
			arguments: {
				projectRoot: projectRoot
			}
		});

		expect(result.content).toBeDefined();
		expect(result.content[0].type).toBe('text');
		expect(result.content[0].text).toContain(
			'Project initialized successfully'
		);
	});

	it('should handle missing tasks file gracefully', async () => {
		const result = await client.callTool({
			name: 'get_tasks',
			arguments: {
				projectRoot: projectRoot,
				file: '.taskmaster/non-existent-tasks.json'
			}
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('Error');
	});

	it('should get tasks with fixture data', async () => {
		// Create a temporary tasks file with proper structure
		const testTasksPath = join(projectRoot, '.taskmaster/test-tasks.json');
		const testTasks = {
			tasks: [
				{
					id: 'test-001',
					description: 'Test task 1',
					status: 'pending',
					priority: 'high',
					estimatedMinutes: 30,
					actualMinutes: 0,
					dependencies: [],
					tags: ['test'],
					subtasks: [
						{
							id: 'test-001-1',
							description: 'Test subtask 1.1',
							status: 'pending',
							priority: 'medium',
							estimatedMinutes: 15,
							actualMinutes: 0
						}
					]
				},
				{
					id: 'test-002',
					description: 'Test task 2',
					status: 'in_progress',
					priority: 'medium',
					estimatedMinutes: 60,
					actualMinutes: 15,
					dependencies: ['test-001'],
					tags: ['test', 'demo'],
					subtasks: []
				}
			]
		};

		// Write test tasks file
		fs.writeFileSync(testTasksPath, JSON.stringify(testTasks, null, 2));

		try {
			const result = await client.callTool({
				name: 'get_tasks',
				arguments: {
					projectRoot: projectRoot,
					file: '.taskmaster/test-tasks.json',
					withSubtasks: true
				}
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0].text).toContain('2 tasks found');
			expect(result.content[0].text).toContain('Test task 1');
			expect(result.content[0].text).toContain('Test task 2');
			expect(result.content[0].text).toContain('Test subtask 1.1');
		} finally {
			// Cleanup
			if (fs.existsSync(testTasksPath)) {
				fs.unlinkSync(testTasksPath);
			}
		}
	});

	it('should filter tasks by status', async () => {
		// Create a temporary tasks file
		const testTasksPath = join(
			projectRoot,
			'.taskmaster/test-status-tasks.json'
		);
		const testTasks = {
			tasks: [
				{
					id: 'status-001',
					description: 'Pending task',
					status: 'pending',
					priority: 'high',
					estimatedMinutes: 30,
					actualMinutes: 0,
					dependencies: [],
					tags: ['test'],
					subtasks: []
				},
				{
					id: 'status-002',
					description: 'Done task',
					status: 'done',
					priority: 'medium',
					estimatedMinutes: 60,
					actualMinutes: 60,
					dependencies: [],
					tags: ['test'],
					subtasks: []
				}
			]
		};

		fs.writeFileSync(testTasksPath, JSON.stringify(testTasks, null, 2));

		try {
			// Test filtering by 'done' status
			const result = await client.callTool({
				name: 'get_tasks',
				arguments: {
					projectRoot: projectRoot,
					file: '.taskmaster/test-status-tasks.json',
					status: 'done'
				}
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0].text).toContain('1 task found');
			expect(result.content[0].text).toContain('Done task');
			expect(result.content[0].text).not.toContain('Pending task');
		} finally {
			// Cleanup
			if (fs.existsSync(testTasksPath)) {
				fs.unlinkSync(testTasksPath);
			}
		}
	});
});
