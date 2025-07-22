/**
 * Comprehensive integration test suite for all generateObject-migrated commands
 * Tests end-to-end command execution with real AI service calls
 */
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// Import all commands
import analyzeTaskComplexity from '../../../scripts/modules/task-manager/analyze-task-complexity.js';
import updateTaskById from '../../../scripts/modules/task-manager/update-task-by-id.js';
import expandTask from '../../../scripts/modules/task-manager/expand-task.js';
import updateTasks from '../../../scripts/modules/task-manager/update-tasks.js';
import addTask from '../../../scripts/modules/task-manager/add-task.js';
import parsePRD from '../../../scripts/modules/task-manager/parse-prd.js';

describe('GenerateObject Migration - Comprehensive Integration Tests', () => {
    const testDir = path.join(process.cwd(), 'test-integration-output');
    const testTasksFile = path.join(testDir, 'test-tasks.json');
    const testPrdFile = path.join(testDir, 'test-prd.md');
    
    beforeAll(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });
    
    beforeEach(() => {
        // Create initial test data
        const initialTasks = {
            master: {
                tasks: [
                    {
                        id: 1,
                        title: "Setup project infrastructure",
                        description: "Initialize the project with proper structure and dependencies",
                        status: "done",
                        dependencies: [],
                        priority: "high",
                        details: "Created project structure with src, tests, and docs folders",
                        testStrategy: "Manual verification of folder structure",
                        subtasks: []
                    },
                    {
                        id: 2,
                        title: "Implement authentication system",
                        description: "Add user authentication with JWT tokens and OAuth2 support",
                        status: "in-progress",
                        dependencies: [1],
                        priority: "high",
                        details: "Need to support both OAuth2 and traditional email/password login",
                        testStrategy: "Unit tests for auth logic, integration tests for endpoints",
                        subtasks: [
                            {
                                id: 1,
                                title: "Design authentication flow",
                                description: "Create detailed flow diagrams for auth process",
                                status: "done",
                                dependencies: []
                            },
                            {
                                id: 2,
                                title: "Implement JWT token generation",
                                description: "Create secure JWT token generation and validation",
                                status: "pending",
                                dependencies: []
                            }
                        ]
                    },
                    {
                        id: 3,
                        title: "Build RESTful API",
                        description: "Create comprehensive REST API endpoints",
                        status: "pending",
                        dependencies: [2],
                        priority: "medium",
                        details: "Use Express.js with proper middleware and error handling",
                        testStrategy: null,
                        subtasks: []
                    }
                ],
                metadata: {
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                    description: "Test project tasks"
                }
            }
        };
        
        fs.writeFileSync(testTasksFile, JSON.stringify(initialTasks, null, 2));
        
        // Create test PRD file
        const testPrd = `# Product Requirements Document

## Overview
We need to build a modern task management system with real-time collaboration features.

## Key Features
1. User authentication and authorization
2. Task creation and management
3. Real-time updates via WebSockets
4. File attachments and comments
5. Advanced search and filtering

## Technical Requirements
- Node.js backend with Express
- PostgreSQL database
- Redis for caching
- WebSocket support
- RESTful API design

## Success Criteria
- Support 10,000+ concurrent users
- Sub-100ms API response times
- 99.9% uptime SLA`;
        
        fs.writeFileSync(testPrdFile, testPrd);
    });
    
    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testTasksFile)) {
            fs.unlinkSync(testTasksFile);
        }
        if (fs.existsSync(testPrdFile)) {
            fs.unlinkSync(testPrdFile);
        }
    });
    
    afterAll(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });
    
    describe('analyze-complexity command', () => {
        test('should analyze task complexity with structured output', async () => {
            const result = await analyzeTaskComplexity(
                testTasksFile,
                2, // Analyze task ID 2
                false, // Don't use research mode
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json' // JSON output format
            );
            
            expect(result).toBeDefined();
            expect(result.complexityAnalysis).toBeDefined();
            expect(result.complexityAnalysis.overallComplexity).toMatch(/low|medium|high|very high/i);
            expect(result.complexityAnalysis.factors).toBeDefined();
            expect(Array.isArray(result.complexityAnalysis.factors)).toBe(true);
            expect(result.complexityAnalysis.timeEstimate).toBeDefined();
            expect(result.complexityAnalysis.riskAssessment).toBeDefined();
            expect(result.telemetryData).toBeDefined();
        }, 30000);
    });
    
    describe('add-task command', () => {
        test('should add a new task with structured output', async () => {
            const result = await addTask(
                testTasksFile,
                'Implement caching layer with Redis for improved performance',
                [2], // Depends on task 2
                'medium',
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json',
                null, // No manual task data
                false // Don't use research mode
            );
            
            expect(result).toBeDefined();
            expect(result.newTaskId).toBe(4); // Should be the next ID
            expect(result.telemetryData).toBeDefined();
            
            // Verify task was added
            const updatedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
            const newTask = updatedData.master.tasks.find(t => t.id === 4);
            expect(newTask).toBeDefined();
            expect(newTask.title).toContain('caching');
            expect(newTask.priority).toBe('medium');
            expect(newTask.dependencies).toContain(2);
        }, 30000);
    });
    
    describe('expand-task command', () => {
        test('should expand task into subtasks with structured output', async () => {
            const result = await expandTask(
                testTasksFile,
                3, // Expand task ID 3
                5, // Generate 5 subtasks
                false, // Don't use research mode
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json'
            );
            
            expect(result).toBeDefined();
            expect(result.expandedTask).toBeDefined();
            expect(result.generatedSubtasks).toBeDefined();
            expect(Array.isArray(result.generatedSubtasks)).toBe(true);
            expect(result.generatedSubtasks.length).toBeGreaterThan(0);
            expect(result.generatedSubtasks.length).toBeLessThanOrEqual(5);
            
            // Verify subtasks were added
            const updatedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
            const task3 = updatedData.master.tasks.find(t => t.id === 3);
            expect(task3.subtasks).toBeDefined();
            expect(task3.subtasks.length).toBeGreaterThan(0);
        }, 30000);
    });
    
    describe('update-task-by-id command', () => {
        test('should update task with structured output (full update mode)', async () => {
            const result = await updateTaskById(
                testTasksFile,
                3, // Update task ID 3
                'Add GraphQL support alongside REST API for more flexible queries',
                false, // Append mode off (full update)
                false, // Don't use research mode
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json'
            );
            
            expect(result).toBeDefined();
            expect(result.updatedTask).toBeDefined();
            expect(result.updatedTask.id).toBe(3);
            expect(result.updatedTask.description.toLowerCase()).toContain('graphql');
            expect(result.telemetryData).toBeDefined();
        }, 30000);
        
        test('should append to task details (append mode)', async () => {
            const result = await updateTaskById(
                testTasksFile,
                2, // Update task ID 2
                'Add support for multi-factor authentication',
                true, // Append mode on
                false, // Don't use research mode
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json'
            );
            
            expect(result).toBeDefined();
            expect(result.updatedTask).toBeDefined();
            expect(result.updatedTask.details).toContain('multi-factor authentication');
            expect(result.telemetryData).toBeDefined();
        }, 30000);
    });
    
    describe('update-tasks command', () => {
        test('should update multiple tasks with structured output', async () => {
            const result = await updateTasks(
                testTasksFile,
                2, // Update from task ID 2 onwards
                'Migrate to microservices architecture for better scalability',
                false, // Don't use research mode
                {
                    projectRoot: process.cwd(),
                    tag: 'master'
                },
                'json'
            );
            
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.updatedTasks).toBeDefined();
            expect(Array.isArray(result.updatedTasks)).toBe(true);
            expect(result.updatedTasks.length).toBeGreaterThan(0);
            
            // Tasks 2 and 3 should be updated (not done)
            const task2 = result.updatedTasks.find(t => t.id === 2);
            const task3 = result.updatedTasks.find(t => t.id === 3);
            expect(task2).toBeDefined();
            expect(task3).toBeDefined();
            expect(task2.description.toLowerCase()).toMatch(/microservice|scalability/);
            expect(task3.description.toLowerCase()).toMatch(/microservice|scalability/);
        }, 30000);
    });
    
    describe('parse-prd command', () => {
        test('should parse PRD and generate tasks with structured output', async () => {
            // Use a new file for PRD output to avoid conflicts
            const prdTasksFile = path.join(testDir, 'prd-tasks.json');
            
            const result = await parsePRD(
                testPrdFile,
                prdTasksFile,
                5, // Generate 5 tasks
                {
                    projectRoot: process.cwd(),
                    force: true,
                    append: false,
                    research: false,
                    tag: 'master'
                }
            );
            
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.tasksPath).toBe(prdTasksFile);
            expect(result.telemetryData).toBeDefined();
            
            // Verify tasks were generated
            const generatedData = JSON.parse(fs.readFileSync(prdTasksFile, 'utf8'));
            expect(generatedData.master).toBeDefined();
            expect(generatedData.master.tasks).toBeDefined();
            expect(generatedData.master.tasks.length).toBeGreaterThan(0);
            expect(generatedData.master.tasks.length).toBeLessThanOrEqual(5);
            
            // Verify task quality
            const firstTask = generatedData.master.tasks[0];
            expect(firstTask.title).toBeTruthy();
            expect(firstTask.description).toBeTruthy();
            expect(firstTask.status).toBe('pending');
            expect(firstTask.priority).toMatch(/low|medium|high/);
            
            // Clean up
            fs.unlinkSync(prdTasksFile);
        }, 30000);
    });
    
    describe('Command Integration Flow', () => {
        test('should handle a complete workflow with multiple commands', async () => {
            // 1. Add a new task
            const addResult = await addTask(
                testTasksFile,
                'Implement comprehensive logging system',
                [1],
                'high',
                { projectRoot: process.cwd(), tag: 'master' },
                'json'
            );
            const newTaskId = addResult.newTaskId;
            
            // 2. Analyze its complexity
            const complexityResult = await analyzeTaskComplexity(
                testTasksFile,
                newTaskId,
                false,
                { projectRoot: process.cwd(), tag: 'master' },
                'json'
            );
            expect(complexityResult.complexityAnalysis).toBeDefined();
            
            // 3. Expand it into subtasks
            const expandResult = await expandTask(
                testTasksFile,
                newTaskId,
                3,
                false,
                { projectRoot: process.cwd(), tag: 'master' },
                'json'
            );
            expect(expandResult.generatedSubtasks.length).toBeGreaterThan(0);
            
            // 4. Update the task with additional context
            const updateResult = await updateTaskById(
                testTasksFile,
                newTaskId,
                'Include structured logging with JSON format and log aggregation support',
                false,
                false,
                { projectRoot: process.cwd(), tag: 'master' },
                'json'
            );
            expect(updateResult.updatedTask.description).toContain('JSON format');
            
            // 5. Verify final state
            const finalData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
            const finalTask = finalData.master.tasks.find(t => t.id === newTaskId);
            expect(finalTask).toBeDefined();
            expect(finalTask.subtasks.length).toBeGreaterThan(0);
            expect(finalTask.description).toContain('JSON format');
        }, 60000); // Longer timeout for multiple operations
    });
    
    describe('Error Handling', () => {
        test('should handle invalid task IDs gracefully', async () => {
            await expect(
                analyzeTaskComplexity(
                    testTasksFile,
                    999, // Non-existent task ID
                    false,
                    { projectRoot: process.cwd(), tag: 'master' },
                    'json'
                )
            ).rejects.toThrow('Task with ID 999 not found');
        });
        
        test('should handle empty prompts', async () => {
            await expect(
                addTask(
                    testTasksFile,
                    '', // Empty prompt
                    [],
                    'medium',
                    { projectRoot: process.cwd(), tag: 'master' },
                    'json'
                )
            ).rejects.toThrow();
        });
        
        test('should handle invalid dependencies', async () => {
            const result = await addTask(
                testTasksFile,
                'New task with invalid dependency',
                [999], // Non-existent dependency
                'medium',
                { projectRoot: process.cwd(), tag: 'master' },
                'json'
            );
            
            // Should succeed but filter out invalid dependency
            expect(result.newTaskId).toBeDefined();
            const data = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
            const newTask = data.master.tasks.find(t => t.id === result.newTaskId);
            expect(newTask.dependencies).not.toContain(999);
        });
    });
});