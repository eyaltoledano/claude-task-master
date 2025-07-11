/**
 * 端到端测试：远程HTTP MCP服务器
 * 测试完整的远程MCP服务器功能，包括多项目支持和所有MCP工具
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs/promises';

describe('Remote HTTP MCP Server E2E Tests', () => {
    let mcpServerProcess;
    let httpServerProcess;
    const MCP_SERVER_PORT = 3001;
    const HTTP_SERVER_PORT = 3000;
    const TEST_PROJECT_ID = 'e2e-test-project';
    const TEST_USERNAME = 'test-user';
    const TEST_PASSWORD = 'test-pass';

    beforeAll(async () => {
        // 启动HTTP服务器
        console.log('Starting HTTP server...');
        httpServerProcess = spawn('npm', ['run', 'server'], {
            stdio: 'pipe',
            cwd: process.cwd()
        });

        // 等待HTTP服务器启动
        await setTimeout(3000);

        // 启动远程MCP服务器
        console.log('Starting remote MCP server...');
        mcpServerProcess = spawn('node', ['server.js', '--http'], {
            stdio: 'pipe',
            cwd: path.join(process.cwd(), 'mcp-remote')
        });

        // 等待MCP服务器启动
        await setTimeout(2000);

        // 验证服务器是否启动成功
        await waitForServer(`http://localhost:${HTTP_SERVER_PORT}/health`, 10000);
        await waitForServer(`http://localhost:${MCP_SERVER_PORT}/health`, 10000);
    });

    afterAll(async () => {
        // 清理测试项目
        try {
            await cleanupTestProject();
        } catch (error) {
            console.warn('Failed to cleanup test project:', error.message);
        }

        // 停止服务器
        if (mcpServerProcess) {
            mcpServerProcess.kill('SIGTERM');
        }
        if (httpServerProcess) {
            httpServerProcess.kill('SIGTERM');
        }

        // 等待进程结束
        await setTimeout(1000);
    });

    describe('MCP Protocol Tests', () => {
        test('should list all 36 MCP tools', async () => {
            const response = await callMCPTool('tools/list');
            
            expect(response.tools).toBeDefined();
            expect(response.tools).toHaveLength(36);
            
            // 验证关键工具存在
            const toolNames = response.tools.map(tool => tool.name);
            expect(toolNames).toContain('get-tasks');
            expect(toolNames).toContain('add-task');
            expect(toolNames).toContain('switch-project');
            expect(toolNames).toContain('parse-prd');
        });

        test('should initialize project successfully', async () => {
            const response = await callMCPTool('tools/call', {
                name: 'initialize-project',
                arguments: { force: true }
            });

            expect(response.content).toBeDefined();
            expect(response.content[0].text).toContain('initialized successfully');
        });

        test('should add task successfully', async () => {
            const response = await callMCPTool('tools/call', {
                name: 'add-task',
                arguments: {
                    title: 'E2E Test Task',
                    description: 'This is a test task created by E2E test',
                    priority: 'high'
                }
            });

            expect(response.content).toBeDefined();
            expect(response.content[0].text).toContain('Task added successfully');
        });

        test('should get tasks successfully', async () => {
            const response = await callMCPTool('tools/call', {
                name: 'get-tasks',
                arguments: {}
            });

            expect(response.content).toBeDefined();
            expect(response.content[0].text).toContain('Tasks in project');
        });

        test('should switch project successfully', async () => {
            const newProjectId = 'e2e-test-project-2';
            const response = await callMCPTool('tools/call', {
                name: 'switch-project',
                arguments: { projectId: newProjectId }
            }, newProjectId);

            expect(response.content).toBeDefined();
            expect(response.content[0].text).toContain('switched to project');
        });
    });

    describe('Multi-Project Support Tests', () => {
        test('should handle multiple projects independently', async () => {
            // 在项目1中添加任务
            await callMCPTool('tools/call', {
                name: 'add-task',
                arguments: {
                    title: 'Project 1 Task',
                    description: 'Task in project 1'
                }
            }, TEST_PROJECT_ID);

            // 在项目2中添加任务
            await callMCPTool('tools/call', {
                name: 'add-task',
                arguments: {
                    title: 'Project 2 Task',
                    description: 'Task in project 2'
                }
            }, 'e2e-test-project-2');

            // 验证项目1的任务
            const project1Tasks = await callMCPTool('tools/call', {
                name: 'get-tasks',
                arguments: {}
            }, TEST_PROJECT_ID);

            // 验证项目2的任务
            const project2Tasks = await callMCPTool('tools/call', {
                name: 'get-tasks',
                arguments: {}
            }, 'e2e-test-project-2');

            expect(project1Tasks.content[0].text).toContain('Project 1 Task');
            expect(project2Tasks.content[0].text).toContain('Project 2 Task');
        });
    });

    describe('Error Handling Tests', () => {
        test('should handle invalid tool name', async () => {
            const response = await callMCPTool('tools/call', {
                name: 'invalid-tool',
                arguments: {}
            });

            expect(response.content[0].text).toContain('Error');
            expect(response.content[0].text).toContain('Unknown tool');
        });

        test('should handle missing required parameters', async () => {
            const response = await callMCPTool('tools/call', {
                name: 'add-task',
                arguments: {} // 缺少必需的title和description
            });

            expect(response.content[0].text).toContain('Error');
        });

        test('should handle authentication errors', async () => {
            try {
                await fetch(`http://localhost:${MCP_SERVER_PORT}/mcp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 缺少认证头
                    },
                    body: JSON.stringify({ method: 'tools/list' })
                });
            } catch (error) {
                expect(error.message).toContain('authentication');
            }
        });
    });

    // 辅助函数
    async function callMCPTool(method, params = {}, projectId = TEST_PROJECT_ID) {
        const response = await fetch(`http://localhost:${MCP_SERVER_PORT}/mcp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-PROJECT': projectId,
                'X-USERNAME': TEST_USERNAME,
                'X-PASSWORD': TEST_PASSWORD
            },
            body: JSON.stringify({
                method,
                params
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    async function waitForServer(url, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    return;
                }
            } catch (error) {
                // 服务器还未启动，继续等待
            }
            await setTimeout(500);
        }
        throw new Error(`Server at ${url} did not start within ${timeout}ms`);
    }

    async function cleanupTestProject() {
        const projectsDir = path.join(process.cwd(), 'projects');
        const testProjectDir = path.join(projectsDir, TEST_PROJECT_ID);
        const testProject2Dir = path.join(projectsDir, 'e2e-test-project-2');

        try {
            await fs.rm(testProjectDir, { recursive: true, force: true });
            await fs.rm(testProject2Dir, { recursive: true, force: true });
        } catch (error) {
            // 忽略清理错误
        }
    }
});
