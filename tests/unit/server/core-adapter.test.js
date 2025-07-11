/**
 * 核心适配器单元测试
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { CoreAdapter } from '../../../server/services/core-adapter.js';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../scripts/modules/task-manager.js');
jest.mock('../../../scripts/modules/prd-parser.js');

describe('CoreAdapter', () => {
    let coreAdapter;
    let mockProject;
    let mockLogger;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock project
        mockProject = {
            id: 'test-project',
            path: '/test/projects/test-project',
            config: {
                projectInfo: {
                    name: 'Test Project',
                    description: 'Test description'
                }
            }
        };

        // Mock logger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        // Create core adapter instance
        coreAdapter = new CoreAdapter(mockProject, mockLogger);
    });

    describe('constructor', () => {
        test('should initialize with correct properties', () => {
            expect(coreAdapter.project).toBe(mockProject);
            expect(coreAdapter.logger).toBe(mockLogger);
            expect(coreAdapter.projectPath).toBe(mockProject.path);
        });
    });

    describe('_ensureTaskmasterDir', () => {
        beforeEach(() => {
            fs.access = jest.fn();
            fs.mkdir = jest.fn().mockResolvedValue();
            fs.writeFile = jest.fn().mockResolvedValue();
        });

        test('should create .taskmaster directory if it does not exist', async () => {
            fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
            
            await coreAdapter._ensureTaskmasterDir();
            
            expect(fs.mkdir).toHaveBeenCalledWith(
                path.join(mockProject.path, '.taskmaster'),
                { recursive: true }
            );
            expect(fs.writeFile).toHaveBeenCalled();
        });

        test('should not create directory if it already exists', async () => {
            fs.access = jest.fn().mockResolvedValue();
            
            await coreAdapter._ensureTaskmasterDir();
            
            expect(fs.mkdir).not.toHaveBeenCalled();
        });
    });

    describe('_createTempConfig', () => {
        beforeEach(() => {
            fs.writeFile = jest.fn().mockResolvedValue();
        });

        test('should create temporary config file', async () => {
            const configPath = await coreAdapter._createTempConfig();
            
            expect(configPath).toBe(path.join(mockProject.path, '.taskmaster', 'config.json'));
            expect(fs.writeFile).toHaveBeenCalledWith(
                configPath,
                expect.stringContaining('"models"')
            );
        });

        test('should include project-specific configuration', async () => {
            await coreAdapter._createTempConfig();
            
            const writeCall = fs.writeFile.mock.calls[0];
            const configContent = JSON.parse(writeCall[1]);
            
            expect(configContent.global.userId).toBe('remote-mcp-user');
            expect(configContent.models.main.provider).toBe('openrouter');
        });
    });

    describe('_cleanupTempConfig', () => {
        beforeEach(() => {
            fs.unlink = jest.fn().mockResolvedValue();
        });

        test('should remove temporary config file', async () => {
            const configPath = path.join(mockProject.path, '.taskmaster', 'config.json');
            
            await coreAdapter._cleanupTempConfig();
            
            expect(fs.unlink).toHaveBeenCalledWith(configPath);
        });

        test('should handle file not found error gracefully', async () => {
            fs.unlink = jest.fn().mockRejectedValue(new Error('ENOENT'));
            
            await expect(coreAdapter._cleanupTempConfig()).resolves.not.toThrow();
        });
    });

    describe('_executeWithTempConfig', () => {
        let mockOperation;

        beforeEach(() => {
            mockOperation = jest.fn().mockResolvedValue('operation result');
            coreAdapter._createTempConfig = jest.fn().mockResolvedValue('/temp/config.json');
            coreAdapter._cleanupTempConfig = jest.fn().mockResolvedValue();
        });

        test('should execute operation with temporary config', async () => {
            const result = await coreAdapter._executeWithTempConfig(mockOperation);
            
            expect(coreAdapter._createTempConfig).toHaveBeenCalled();
            expect(mockOperation).toHaveBeenCalled();
            expect(coreAdapter._cleanupTempConfig).toHaveBeenCalled();
            expect(result).toBe('operation result');
        });

        test('should cleanup config even if operation fails', async () => {
            mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
            
            await expect(coreAdapter._executeWithTempConfig(mockOperation))
                .rejects.toThrow('Operation failed');
            
            expect(coreAdapter._cleanupTempConfig).toHaveBeenCalled();
        });
    });

    describe('getTasks', () => {
        beforeEach(() => {
            coreAdapter._executeWithTempConfig = jest.fn().mockResolvedValue([
                {
                    id: 'task-1',
                    title: 'Test Task 1',
                    description: 'Description 1',
                    status: 'pending'
                },
                {
                    id: 'task-2',
                    title: 'Test Task 2',
                    description: 'Description 2',
                    status: 'completed'
                }
            ]);
        });

        test('should return list of tasks', async () => {
            const tasks = await coreAdapter.getTasks();
            
            expect(tasks).toHaveLength(2);
            expect(tasks[0].id).toBe('task-1');
            expect(tasks[1].id).toBe('task-2');
        });

        test('should filter tasks by status when provided', async () => {
            const tasks = await coreAdapter.getTasks({ status: 'pending' });
            
            expect(coreAdapter._executeWithTempConfig).toHaveBeenCalledWith(
                expect.any(Function)
            );
        });
    });

    describe('addTask', () => {
        beforeEach(() => {
            coreAdapter._executeWithTempConfig = jest.fn().mockResolvedValue({
                id: 'new-task',
                title: 'New Task',
                description: 'New task description',
                status: 'pending'
            });
        });

        test('should add new task', async () => {
            const taskData = {
                title: 'New Task',
                description: 'New task description',
                priority: 'high'
            };
            
            const result = await coreAdapter.addTask(taskData);
            
            expect(result.id).toBe('new-task');
            expect(result.title).toBe('New Task');
        });

        test('should throw error for invalid task data', async () => {
            await expect(coreAdapter.addTask({}))
                .rejects.toThrow('Title is required');
        });
    });

    describe('parsePRD', () => {
        beforeEach(() => {
            coreAdapter._executeWithTempConfig = jest.fn().mockResolvedValue({
                tasks: [
                    { title: 'Task 1', description: 'Description 1' },
                    { title: 'Task 2', description: 'Description 2' }
                ],
                summary: 'PRD parsing completed'
            });
        });

        test('should parse PRD content', async () => {
            const prdContent = 'Sample PRD content';
            
            const result = await coreAdapter.parsePRD(prdContent);
            
            expect(result.tasks).toHaveLength(2);
            expect(result.summary).toBe('PRD parsing completed');
        });

        test('should throw error for empty PRD content', async () => {
            await expect(coreAdapter.parsePRD(''))
                .rejects.toThrow('PRD content is required');
        });
    });

    describe('generateTaskFile', () => {
        beforeEach(() => {
            fs.writeFile = jest.fn().mockResolvedValue();
        });

        test('should generate task file', async () => {
            const tasks = [
                { id: 'task-1', title: 'Task 1', description: 'Description 1' }
            ];
            
            const filePath = await coreAdapter.generateTaskFile(tasks, 'json');
            
            expect(filePath).toContain('.json');
            expect(fs.writeFile).toHaveBeenCalled();
        });

        test('should support different file formats', async () => {
            const tasks = [{ id: 'task-1', title: 'Task 1' }];

            const jsonPath = await coreAdapter.generateTaskFile(tasks, 'json');
            const mdPath = await coreAdapter.generateTaskFile(tasks, 'md');

            expect(jsonPath).toContain('.json');
            expect(mdPath).toContain('.md');
        });
    });

    describe('error handling', () => {
        test('should handle file system errors gracefully', async () => {
            coreAdapter._executeWithTempConfig = jest.fn().mockRejectedValue(
                new Error('File system error')
            );

            await expect(coreAdapter.getTasks())
                .rejects.toThrow('File system error');
        });

        test('should log errors appropriately', async () => {
            const error = new Error('Test error');
            coreAdapter._executeWithTempConfig = jest.fn().mockRejectedValue(error);

            try {
                await coreAdapter.getTasks();
            } catch (e) {
                // Expected to throw
            }

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error in getTasks:',
                error
            );
        });
    });
});
