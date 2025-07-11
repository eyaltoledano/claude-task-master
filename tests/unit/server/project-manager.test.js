/**
 * 项目管理器单元测试
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { ProjectManager } from '../../../server/utils/project-manager.js';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../../server/services/config-manager.js');

describe('ProjectManager', () => {
    let projectManager;
    let mockConfigManager;
    const testProjectsDir = '/test/projects';

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock config manager
        mockConfigManager = {
            getGlobalConfig: jest.fn().mockReturnValue({
                global: { userId: 'test-user' }
            }),
            getProjectsConfig: jest.fn().mockReturnValue({
                projects: {}
            }),
            updateProjectsConfig: jest.fn()
        };

        // Create project manager instance
        projectManager = new ProjectManager(testProjectsDir, mockConfigManager);
    });

    describe('constructor', () => {
        test('should initialize with correct properties', () => {
            expect(projectManager.projectsDir).toBe(testProjectsDir);
            expect(projectManager.configManager).toBe(mockConfigManager);
            expect(projectManager.projects).toBeInstanceOf(Map);
        });
    });

    describe('isValidProjectId', () => {
        test('should accept valid project IDs', () => {
            expect(projectManager.isValidProjectId('test-project')).toBe(true);
            expect(projectManager.isValidProjectId('project_123')).toBe(true);
            expect(projectManager.isValidProjectId('MyProject')).toBe(true);
            expect(projectManager.isValidProjectId('a')).toBe(true);
        });

        test('should reject invalid project IDs', () => {
            expect(projectManager.isValidProjectId('')).toBe(false);
            expect(projectManager.isValidProjectId('project with spaces')).toBe(false);
            expect(projectManager.isValidProjectId('project@special')).toBe(false);
            expect(projectManager.isValidProjectId('a'.repeat(51))).toBe(false);
        });
    });

    describe('projectExists', () => {
        test('should return true for existing project', () => {
            projectManager.projects.set('test-project', { id: 'test-project' });
            expect(projectManager.projectExists('test-project')).toBe(true);
        });

        test('should return false for non-existing project', () => {
            expect(projectManager.projectExists('non-existing')).toBe(false);
        });
    });

    describe('ensureProject', () => {
        beforeEach(() => {
            // Mock fs operations
            fs.access = jest.fn().mockResolvedValue();
            fs.mkdir = jest.fn().mockResolvedValue();
            fs.writeFile = jest.fn().mockResolvedValue();
            fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({
                projectInfo: {
                    name: 'Test Project',
                    description: 'Test description',
                    template: 'default',
                    created: '2024-01-01T00:00:00.000Z',
                    updated: '2024-01-01T00:00:00.000Z'
                }
            }));
        });

        test('should create new project when it does not exist', async () => {
            fs.access = jest.fn().mockRejectedValue(new Error('ENOENT'));
            
            const project = await projectManager.ensureProject('new-project');
            
            expect(project.id).toBe('new-project');
            expect(fs.mkdir).toHaveBeenCalled();
            expect(fs.writeFile).toHaveBeenCalled();
            expect(projectManager.projects.has('new-project')).toBe(true);
        });

        test('should load existing project when it exists', async () => {
            const project = await projectManager.ensureProject('existing-project');
            
            expect(project.id).toBe('existing-project');
            expect(fs.readFile).toHaveBeenCalled();
            expect(projectManager.projects.has('existing-project')).toBe(true);
        });

        test('should throw error for invalid project ID', async () => {
            await expect(projectManager.ensureProject('invalid project'))
                .rejects.toThrow('Invalid project ID');
        });
    });

    describe('getProject', () => {
        test('should return existing project', () => {
            const mockProject = { id: 'test-project', config: {} };
            projectManager.projects.set('test-project', mockProject);
            
            const project = projectManager.getProject('test-project');
            expect(project).toBe(mockProject);
        });

        test('should throw error for non-existing project', () => {
            expect(() => projectManager.getProject('non-existing'))
                .toThrow('Project non-existing not found');
        });
    });

    describe('listProjects', () => {
        test('should return list of all projects', () => {
            const mockProject1 = {
                id: 'project1',
                config: {
                    projectInfo: {
                        name: 'Project 1',
                        description: 'Description 1',
                        template: 'default',
                        created: '2024-01-01T00:00:00.000Z',
                        updated: '2024-01-01T00:00:00.000Z'
                    }
                },
                lastAccessed: new Date(),
                path: '/test/projects/project1'
            };

            const mockProject2 = {
                id: 'project2',
                config: {
                    projectInfo: {
                        name: 'Project 2',
                        description: 'Description 2',
                        template: 'default',
                        created: '2024-01-02T00:00:00.000Z',
                        updated: '2024-01-02T00:00:00.000Z'
                    }
                },
                lastAccessed: new Date(),
                path: '/test/projects/project2'
            };

            projectManager.projects.set('project1', mockProject1);
            projectManager.projects.set('project2', mockProject2);

            const projects = projectManager.listProjects();
            
            expect(projects).toHaveLength(2);
            expect(projects[0].id).toBe('project1');
            expect(projects[1].id).toBe('project2');
        });

        test('should return empty array when no projects exist', () => {
            const projects = projectManager.listProjects();
            expect(projects).toEqual([]);
        });
    });

    describe('deleteProject', () => {
        beforeEach(() => {
            fs.rm = jest.fn().mockResolvedValue();
        });

        test('should delete existing project', async () => {
            const mockProject = { id: 'test-project', path: '/test/projects/test-project' };
            projectManager.projects.set('test-project', mockProject);
            
            await projectManager.deleteProject('test-project');
            
            expect(fs.rm).toHaveBeenCalledWith('/test/projects/test-project', { recursive: true, force: true });
            expect(projectManager.projects.has('test-project')).toBe(false);
        });

        test('should throw error for non-existing project', async () => {
            await expect(projectManager.deleteProject('non-existing'))
                .rejects.toThrow('Project non-existing not found');
        });
    });

    describe('getProjectCount', () => {
        test('should return correct project count', () => {
            projectManager.projects.set('project1', { id: 'project1' });
            projectManager.projects.set('project2', { id: 'project2' });
            
            expect(projectManager.getProjectCount()).toBe(2);
        });

        test('should return 0 when no projects exist', () => {
            expect(projectManager.getProjectCount()).toBe(0);
        });
    });
});
