import updateTaskById from '../../../scripts/modules/task-manager/update-task-by-id.js';
import { readJSON, writeJSON } from '../../../scripts/modules/utils.js';
import fs from 'fs';
import path from 'path';

describe('update-task-by-id with generateObject', () => {
    const testTasksFile = path.join(process.cwd(), 'test-tasks.json');
    
    beforeEach(() => {
        // Create a test tasks file
        const testTasks = {
            projectName: "Test Project",
            tasks: [
                {
                    id: 1,
                    title: "Setup project structure",
                    description: "Initialize the project with proper folder structure",
                    status: "pending",
                    dependencies: [],
                    priority: "high",
                    details: "Create folders for src, tests, docs",
                    testStrategy: "Manual verification"
                },
                {
                    id: 2,
                    title: "Implement authentication",
                    description: "Add user authentication with JWT tokens",
                    status: "pending",
                    dependencies: [1],
                    priority: "high",
                    details: null,
                    testStrategy: null
                }
            ]
        };
        fs.writeFileSync(testTasksFile, JSON.stringify(testTasks, null, 2));
    });
    
    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testTasksFile)) {
            fs.unlinkSync(testTasksFile);
        }
    });
    
    test('should update task with structured data', async () => {
        const result = await updateTaskById({
            file: testTasksFile,
            prompt: 'Update the description to include OAuth2 support',
            id: 2
        });

        expect(result).toHaveProperty('updatedTask');
        const { updatedTask } = result;
        
        // Verify the task structure
        expect(updatedTask).toHaveProperty('id', 2);
        expect(updatedTask).toHaveProperty('title');
        expect(updatedTask).toHaveProperty('description');
        expect(updatedTask).toHaveProperty('status');
        expect(updatedTask).toHaveProperty('dependencies');
        expect(updatedTask).toHaveProperty('priority');
        
        // Check that description was updated
        expect(updatedTask.description.toLowerCase()).toContain('oauth');
        
        // Verify task was written back to file
        const savedData = JSON.parse(fs.readFileSync(testTasksFile, 'utf8'));
        const savedTask = savedData.tasks.find(t => t.id === 2);
        expect(savedTask.description).toBe(updatedTask.description);
    }, 30000); // Increase timeout for AI call
    
    test('should handle append mode with plain text', async () => {
        const result = await updateTaskById({
            file: testTasksFile,
            prompt: 'Add information about refresh tokens',
            id: 2,
            append: true
        });

        expect(result).toHaveProperty('updatedTask');
        const { updatedTask } = result;
        
        // Check that details were appended
        expect(updatedTask.details).toBeTruthy();
        expect(updatedTask.details).toContain('<info added on');
        expect(updatedTask.details.toLowerCase()).toContain('refresh token');
    }, 30000);
});