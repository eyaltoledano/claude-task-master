import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to run MCP inspector CLI commands
async function runMCPCommand(method, args = {}) {
    const serverPath = path.join(__dirname, '../../../../mcp-server/server.js');
    let command = `npx @modelcontextprotocol/inspector --cli node ${serverPath} --method ${method}`;
    
    // Add tool-specific arguments
    if (args.toolName) {
        command += ` --tool-name ${args.toolName}`;
    }
    
    // Add tool arguments
    if (args.toolArgs) {
        for (const [key, value] of Object.entries(args.toolArgs)) {
            command += ` --tool-arg ${key}=${value}`;
        }
    }
    
    try {
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30000, // 30 second timeout
            env: { ...process.env, NODE_ENV: 'test' }
        });
        
        if (stderr && !stderr.includes('DeprecationWarning')) {
            console.error('MCP Command stderr:', stderr);
        }
        
        return { stdout, stderr };
    } catch (error) {
        console.error('MCP Command failed:', error);
        throw error;
    }
}

describe('MCP Inspector CLI - get_tasks Tool Tests', () => {
    const testProjectPath = path.join(__dirname, '../../../../test-fixtures/mcp-test-project');
    const tasksFile = path.join(testProjectPath, '.task-master/tasks.json');
    
    beforeAll(async () => {
        // Create test project directory and tasks file
        await fs.mkdir(path.join(testProjectPath, '.task-master'), { recursive: true });
        
        // Create sample tasks data
        const sampleTasks = {
            tasks: [
                {
                    id: 'task-1',
                    description: 'Implement user authentication',
                    status: 'pending',
                    type: 'feature',
                    priority: 1,
                    dependencies: [],
                    subtasks: [
                        {
                            id: 'subtask-1-1',
                            description: 'Set up JWT tokens',
                            status: 'done',
                            type: 'implementation'
                        },
                        {
                            id: 'subtask-1-2',
                            description: 'Create login endpoint',
                            status: 'pending',
                            type: 'implementation'
                        }
                    ]
                },
                {
                    id: 'task-2',
                    description: 'Add database migrations',
                    status: 'done',
                    type: 'infrastructure',
                    priority: 2,
                    dependencies: [],
                    subtasks: []
                },
                {
                    id: 'task-3',
                    description: 'Fix memory leak in worker process',
                    status: 'blocked',
                    type: 'bug',
                    priority: 1,
                    dependencies: ['task-1'],
                    subtasks: []
                }
            ],
            metadata: {
                version: '1.0.0',
                lastUpdated: new Date().toISOString()
            }
        };
        
        await fs.writeFile(tasksFile, JSON.stringify(sampleTasks, null, 2));
    });
    
    afterAll(async () => {
        // Clean up test project
        await fs.rm(testProjectPath, { recursive: true, force: true });
    });
    
    it('should list available tools including get_tasks', async () => {
        const { stdout } = await runMCPCommand('tools/list');
        const response = JSON.parse(stdout);
        
        expect(response).toHaveProperty('tools');
        expect(Array.isArray(response.tools)).toBe(true);
        
        const getTasksTool = response.tools.find(tool => tool.name === 'get_tasks');
        expect(getTasksTool).toBeDefined();
        expect(getTasksTool.description).toContain('Get all tasks from Task Master');
    });
    
    it('should get all tasks without filters', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'get_tasks',
            toolArgs: {
                file: tasksFile
            }
        });
        
        const response = JSON.parse(stdout);
        expect(response).toHaveProperty('content');
        expect(Array.isArray(response.content)).toBe(true);
        
        // Parse the text content to get tasks
        const textContent = response.content.find(c => c.type === 'text');
        expect(textContent).toBeDefined();
        
        const tasksData = JSON.parse(textContent.text);
        expect(tasksData.tasks).toHaveLength(3);
        expect(tasksData.tasks[0].description).toBe('Implement user authentication');
    });
    
    it('should filter tasks by status', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'get_tasks',
            toolArgs: {
                file: tasksFile,
                status: 'pending'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        const tasksData = JSON.parse(textContent.text);
        
        expect(tasksData.tasks).toHaveLength(1);
        expect(tasksData.tasks[0].status).toBe('pending');
        expect(tasksData.tasks[0].description).toBe('Implement user authentication');
    });
    
    it('should filter tasks by multiple statuses', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'get_tasks',
            toolArgs: {
                file: tasksFile,
                status: 'done,blocked'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        const tasksData = JSON.parse(textContent.text);
        
        expect(tasksData.tasks).toHaveLength(2);
        expect(tasksData.tasks.map(t => t.status).sort()).toEqual(['blocked', 'done']);
    });
    
    it('should include subtasks when requested', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'get_tasks',
            toolArgs: {
                file: tasksFile,
                withSubtasks: 'true'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        const tasksData = JSON.parse(textContent.text);
        
        const taskWithSubtasks = tasksData.tasks.find(t => t.id === 'task-1');
        expect(taskWithSubtasks.subtasks).toHaveLength(2);
        expect(taskWithSubtasks.subtasks[0].description).toBe('Set up JWT tokens');
    });
    
    it('should handle non-existent file gracefully', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'get_tasks',
            toolArgs: {
                file: '/non/existent/path/tasks.json'
            }
        });
        
        const response = JSON.parse(stdout);
        expect(response).toHaveProperty('error');
        expect(response.error).toHaveProperty('message');
        expect(response.error.message).toContain('not found');
    });
});