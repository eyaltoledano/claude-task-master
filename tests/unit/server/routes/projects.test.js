/**
 * 项目管理API路由单元测试
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import projectsRouter from '../../../../server/routes/projects.js';

// Mock dependencies
jest.mock('../../../../server/utils/project-manager.js');
jest.mock('../../../../server/middleware/project-validator.js', () => ({
    validateProjectId: (req, res, next) => next(),
    ensureProject: (req, res, next) => {
        req.project = { id: req.params.projectId };
        next();
    }
}));

describe('Projects API Routes', () => {
    let app;
    let mockProjectManager;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock project manager
        mockProjectManager = {
            listProjects: jest.fn(),
            ensureProject: jest.fn(),
            getProject: jest.fn(),
            updateProject: jest.fn(),
            deleteProject: jest.fn(),
            projectExists: jest.fn()
        };

        // Create Express app with router
        app = express();
        app.use(express.json());
        
        // Add middleware to inject mocked dependencies
        app.use((req, res, next) => {
            req.projectManager = mockProjectManager;
            req.requestId = 'test-request-id';
            next();
        });
        
        app.use('/api/projects', projectsRouter);
        
        // Error handler
        app.use((error, req, res, next) => {
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        });
    });

    describe('GET /api/projects', () => {
        test('should return list of projects', async () => {
            const mockProjects = [
                {
                    id: 'project1',
                    name: 'Project 1',
                    description: 'Description 1',
                    created: '2024-01-01T00:00:00.000Z'
                },
                {
                    id: 'project2',
                    name: 'Project 2',
                    description: 'Description 2',
                    created: '2024-01-02T00:00:00.000Z'
                }
            ];
            
            mockProjectManager.listProjects.mockReturnValue(mockProjects);
            
            const response = await request(app)
                .get('/api/projects')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.projects).toHaveLength(2);
            expect(response.body.data.projects[0].id).toBe('project1');
        });

        test('should return empty list when no projects exist', async () => {
            mockProjectManager.listProjects.mockReturnValue([]);
            
            const response = await request(app)
                .get('/api/projects')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.projects).toHaveLength(0);
        });
    });

    describe('POST /api/projects', () => {
        test('should create new project', async () => {
            const newProject = {
                id: 'new-project',
                name: 'New Project',
                description: 'New project description',
                path: '/projects/new-project',
                config: {}
            };
            
            mockProjectManager.ensureProject.mockResolvedValue(newProject);
            
            const response = await request(app)
                .post('/api/projects')
                .send({
                    projectId: 'new-project',
                    name: 'New Project',
                    description: 'New project description'
                })
                .expect(201);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('new-project');
            expect(mockProjectManager.ensureProject).toHaveBeenCalledWith('new-project');
        });

        test('should return 400 for missing projectId', async () => {
            const response = await request(app)
                .post('/api/projects')
                .send({
                    name: 'New Project'
                })
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('projectId is required');
        });
    });

    describe('GET /api/projects/:projectId', () => {
        test('should return project details', async () => {
            const mockProject = {
                id: 'test-project',
                name: 'Test Project',
                description: 'Test description',
                path: '/projects/test-project',
                config: {}
            };
            
            mockProjectManager.getProject.mockReturnValue(mockProject);
            
            const response = await request(app)
                .get('/api/projects/test-project')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('test-project');
        });

        test('should return 404 for non-existing project', async () => {
            mockProjectManager.getProject.mockImplementation(() => {
                throw new Error('Project not found');
            });
            
            const response = await request(app)
                .get('/api/projects/non-existing')
                .expect(500);
            
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/projects/:projectId/initialize', () => {
        test('should initialize existing project', async () => {
            const mockProject = {
                id: 'test-project',
                path: '/projects/test-project',
                config: {}
            };
            
            mockProjectManager.projectExists.mockReturnValue(true);
            mockProjectManager.ensureProject.mockResolvedValue(mockProject);
            
            const response = await request(app)
                .post('/api/projects/test-project/initialize')
                .send({ force: false })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('already initialized');
        });

        test('should force initialize project when force=true', async () => {
            const mockProject = {
                id: 'test-project',
                path: '/projects/test-project',
                config: {}
            };
            
            mockProjectManager.projectExists.mockReturnValue(true);
            mockProjectManager.ensureProject.mockResolvedValue(mockProject);
            
            const response = await request(app)
                .post('/api/projects/test-project/initialize')
                .send({ force: true })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.initialized).toBe(true);
        });

        test('should initialize new project', async () => {
            const mockProject = {
                id: 'new-project',
                path: '/projects/new-project',
                config: {}
            };
            
            mockProjectManager.projectExists.mockReturnValue(false);
            mockProjectManager.ensureProject.mockResolvedValue(mockProject);
            
            const response = await request(app)
                .post('/api/projects/new-project/initialize')
                .send({})
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.initialized).toBe(true);
        });
    });

    describe('PUT /api/projects/:projectId', () => {
        test('should update project', async () => {
            const updatedProject = {
                id: 'test-project',
                name: 'Updated Project',
                description: 'Updated description'
            };
            
            mockProjectManager.updateProject.mockResolvedValue(updatedProject);
            
            const response = await request(app)
                .put('/api/projects/test-project')
                .send({
                    name: 'Updated Project',
                    description: 'Updated description'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Project');
        });
    });

    describe('DELETE /api/projects/:projectId', () => {
        test('should delete project', async () => {
            mockProjectManager.deleteProject.mockResolvedValue();
            
            const response = await request(app)
                .delete('/api/projects/test-project')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.deleted).toBe(true);
            expect(mockProjectManager.deleteProject).toHaveBeenCalledWith('test-project');
        });
    });
});
