const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

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
            timeout: 60000, // 60 second timeout for AI operations
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

describe('MCP Inspector CLI - expand_task Tool Tests', () => {
    const testProjectPath = path.join(__dirname, '../../../../test-fixtures/mcp-expand-test-project');
    const tasksDir = path.join(testProjectPath, '.taskmaster/tasks');
    const tasksFile = path.join(tasksDir, 'tasks.json');
    
    beforeAll(async () => {
        // Create test project directory structure
        await fs.mkdir(tasksDir, { recursive: true });
        
        // Create sample tasks data
        const sampleTasks = {
            tasks: [
                {
                    id: 1,
                    description: 'Implement user authentication system',
                    status: 'pending',
                    tags: ['master'],
                    subtasks: []
                },
                {
                    id: 2,
                    description: 'Create API endpoints',
                    status: 'pending',
                    tags: ['master'],
                    subtasks: [
                        {
                            id: '2.1',
                            description: 'Setup Express server',
                            status: 'pending'
                        }
                    ]
                },
                {
                    id: 3,
                    description: 'Design database schema',
                    status: 'completed',
                    tags: ['master']
                }
            ],
            tags: {
                master: {
                    name: 'master',
                    description: 'Main development branch'
                }
            },
            activeTag: 'master',
            metadata: {
                nextId: 4,
                version: '1.0.0'
            }
        };
        
        await fs.writeFile(tasksFile, JSON.stringify(sampleTasks, null, 2));
    });
    
    afterAll(async () => {
        // Clean up test project
        await fs.rm(testProjectPath, { recursive: true, force: true });
    });
    
    it('should list available tools including expand_task', async () => {
        const { stdout } = await runMCPCommand('tools/list');
        const response = JSON.parse(stdout);
        
        expect(response).toHaveProperty('tools');
        expect(Array.isArray(response.tools)).toBe(true);
        
        const expandTaskTool = response.tools.find(tool => tool.name === 'expand_task');
        expect(expandTaskTool).toBeDefined();
        expect(expandTaskTool.description).toContain('Expand a task into subtasks');
    });
    
    it('should expand a task without existing subtasks', async () => {
        // Skip if no API key is set
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
            console.log('Skipping test: No AI API key found in environment');
            return;
        }

        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '1',
                projectRoot: testProjectPath,
                num: '3',
                prompt: 'Focus on security and authentication best practices'
            }
        });
        
        const response = JSON.parse(stdout);
        expect(response).toHaveProperty('content');
        expect(Array.isArray(response.content)).toBe(true);
        
        // Parse the text content to get result
        const textContent = response.content.find(c => c.type === 'text');
        expect(textContent).toBeDefined();
        
        const result = JSON.parse(textContent.text);
        expect(result.task).toBeDefined();
        expect(result.task.id).toBe(1);
        expect(result.subtasksAdded).toBeGreaterThan(0);
        
        // Verify the task was actually updated
        const updatedTasks = JSON.parse(await fs.readFile(tasksFile, 'utf8'));
        const expandedTask = updatedTasks.tasks.find(t => t.id === 1);
        expect(expandedTask.subtasks.length).toBeGreaterThan(0);
    });
    
    it('should handle expansion with force flag for task with existing subtasks', async () => {
        // Skip if no API key is set
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
            console.log('Skipping test: No AI API key found in environment');
            return;
        }

        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '2',
                projectRoot: testProjectPath,
                force: 'true',
                num: '2'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        const result = JSON.parse(textContent.text);
        
        expect(result.task).toBeDefined();
        expect(result.task.id).toBe(2);
        expect(result.subtasksAdded).toBe(2);
    });
    
    it('should reject expansion of completed task', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '3',
                projectRoot: testProjectPath
            }
        });
        
        const response = JSON.parse(stdout);
        expect(response).toHaveProperty('content');
        
        const textContent = response.content.find(c => c.type === 'text');
        expect(textContent.text).toContain('Error');
        expect(textContent.text).toContain('completed');
    });
    
    it('should handle invalid task ID', async () => {
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '999',
                projectRoot: testProjectPath
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        expect(textContent.text).toContain('Error');
        expect(textContent.text).toContain('not found');
    });
    
    it('should handle missing required parameters', async () => {
        try {
            await runMCPCommand('tools/call', {
                toolName: 'expand_task',
                toolArgs: {
                    // Missing id and projectRoot
                    num: '3'
                }
            });
            fail('Should have thrown an error');
        } catch (error) {
            expect(error.message).toContain('validation');
        }
    });
    
    it('should work with custom tasks file path', async () => {
        // Skip if no API key is set
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
            console.log('Skipping test: No AI API key found in environment');
            return;
        }

        // Create custom tasks file
        const customDir = path.join(testProjectPath, 'custom');
        await fs.mkdir(customDir, { recursive: true });
        const customTasksPath = path.join(customDir, 'my-tasks.json');
        await fs.copyFile(tasksFile, customTasksPath);
        
        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '1',
                projectRoot: testProjectPath,
                file: 'custom/my-tasks.json',
                num: '2'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        const result = JSON.parse(textContent.text);
        
        expect(result.task).toBeDefined();
        expect(result.subtasksAdded).toBe(2);
        
        // Verify the custom file was updated
        const updatedData = JSON.parse(await fs.readFile(customTasksPath, 'utf8'));
        const task = updatedData.tasks.find(t => t.id === 1);
        expect(task.subtasks.length).toBe(2);
    });
    
    it('should handle expansion with research flag', async () => {
        // Skip if no API key is set
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.PERPLEXITY_API_KEY) {
            console.log('Skipping test: No AI API key found in environment');
            return;
        }

        const { stdout } = await runMCPCommand('tools/call', {
            toolName: 'expand_task',
            toolArgs: {
                id: '1',
                projectRoot: testProjectPath,
                research: 'true',
                num: '2'
            }
        });
        
        const response = JSON.parse(stdout);
        const textContent = response.content.find(c => c.type === 'text');
        
        // Even if research fails, expansion should still work
        const result = JSON.parse(textContent.text);
        expect(result.task).toBeDefined();
        expect(result.subtasksAdded).toBeGreaterThanOrEqual(0);
    });
});