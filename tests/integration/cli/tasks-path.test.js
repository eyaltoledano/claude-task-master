import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the CLI script
// Changed to point to bin/task-master.js as per new instructions
const CLI_SCRIPT_PATH = path.resolve(__dirname, '../../../bin/task-master.js');

import { spawn } from 'child_process'; // Import spawn

// Helper function to run CLI commands
// Accepts commandName (e.g., 'generate') and commandArgs (e.g., ['--file', 'tasks.json'])
async function runCliCommand(commandName, commandArgs = [], cwd) {
    return new Promise((resolve, reject) => {
        const nodeExecutable = process.execPath;
        // Add --experimental-vm-modules to the node arguments
        const args = ['--experimental-vm-modules', CLI_SCRIPT_PATH, commandName, ...commandArgs];

        // console.log(`Executing: ${nodeExecutable} ${args.join(' ')} in ${cwd} (CLI_SCRIPT_PATH: ${CLI_SCRIPT_PATH})`); // Debug log

        const child = spawn(nodeExecutable, args, { cwd });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`CLI Error (stderr) for command "${nodeExecutable} ${args.join(' ')}" in ${cwd}:\n${stderr}`);
                console.error(`CLI Error (stdout) for command "${nodeExecutable} ${args.join(' ')}" in ${cwd}:\n${stdout}`);
                return reject(new Error(`Command failed with exit code ${code} for command: ${nodeExecutable} ${args.join(' ')}`));
            }
            resolve({ stdout, stderr });
        });

        child.on('error', (error) => {
            // This 'error' event is for issues spawning the process itself
            console.error(`Failed to start CLI process for command "${nodeExecutable} ${args.join(' ')}": ${error.message}`);
            return reject(error);
        });
    });
}

// Helper function to create a temporary project structure
async function setupTemporaryProject(projectPath, configContent, tasksJsonContent, tasksJsonSubDir = '') {
    await fs.mkdir(projectPath, { recursive: true });
    await fs.writeFile(path.join(projectPath, '.taskmasterconfig'), JSON.stringify(configContent));

    if (tasksJsonContent) {
        const tasksDir = tasksJsonSubDir ? path.join(projectPath, tasksJsonSubDir) : projectPath;
        if (tasksJsonSubDir) {
            await fs.mkdir(tasksDir, { recursive: true });
        }
        await fs.writeFile(path.join(tasksDir, 'tasks.json'), JSON.stringify(tasksJsonContent));
    }
}

// Helper function to check if a file exists
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

describe('CLI Commands with custom tasksPath Integration Tests', () => {
    let tempTestDir;

    beforeEach(async () => {
        // Create a unique temporary directory for each test
        tempTestDir = path.join(__dirname, `temp_tasks_path_test_${Date.now()}`);
        await fs.mkdir(tempTestDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up the temporary directory
        if (tempTestDir) {
            await fs.rm(tempTestDir, { recursive: true, force: true });
        }
    });

    test('generate command should use tasksPath from .taskmasterconfig', async () => {
        const customTasksPath = 'my_generated_tasks';
        const projectConfig = { global: { tasksPath: `./${customTasksPath}` } };
        const tasksData = {
            tasks: [{ id: 1, title: 'Test Task 1', description: 'Desc 1', status: 'pending', priority: 'medium', dependencies: [] }]
        };

        await setupTemporaryProject(tempTestDir, projectConfig, tasksData, customTasksPath);

        // Act: Run the generate command from the temp directory root
        await runCliCommand('generate', [], tempTestDir);

        // Assert: Check if task file is created in the custom tasksPath
        const expectedTaskFilePath = path.join(tempTestDir, customTasksPath, 'task_001.txt');
        expect(await fileExists(expectedTaskFilePath)).toBe(true);

        // Also assert it's NOT in the default ./tasks path
        const defaultTaskFilePath = path.join(tempTestDir, 'tasks', 'task_001.txt');
        expect(await fileExists(defaultTaskFilePath)).toBe(false);
    });

    test('list command should use tasksPath from .taskmasterconfig', async () => {
        const customTasksPath = 'my_listed_tasks';
        const projectConfig = { global: { tasksPath: `./${customTasksPath}` } };
        const tasksData = {
            tasks: [{ id: 1, title: 'Custom List Task Alpha', description: 'Desc Alpha', status: 'pending', priority: 'medium', dependencies: [] }]
        };

        await setupTemporaryProject(tempTestDir, projectConfig, tasksData, customTasksPath);

        // Act: Run the list command
        const { stdout } = await runCliCommand('list', [], tempTestDir);

        // Assert: Check stdout for the task title
        expect(stdout).toContain('Custom List Task Alpha');
        // A more robust check might be to ensure it's listing from the correct file,
        // but stdout check is a good first step.
    });

    test('add-task command should use tasksPath from .taskmasterconfig', async () => {
        const customTasksPath = 'specific_add_dir';
        const projectConfig = { global: { tasksPath: `./${customTasksPath}` } };
        const initialTasksData = { tasks: [] }; // Create an empty tasks array

        await setupTemporaryProject(tempTestDir, projectConfig, initialTasksData, customTasksPath);

        const taskTitle = 'My New Added Task';
        // Act: Run the add-task command
        // We need to ensure API key checks don't interfere. For add-task with AI, it might be an issue.
        // For now, let's assume add-task can proceed far enough to create/update tasks.json.
        // If it fails due to API key issues, this test will need adjustment (e.g., mocking API calls or ensuring keys are available in test env).
        // For simplicity, we'll try to add a manual task if the command supports it easily, or rely on it creating the file.
        // The current add-task command in the project uses AI by default.
        // To avoid AI call, we'd need to ensure it can run without it or mock AI.
        // The prompt is required for AI, but we want to test path creation.
        // Let's use --title and --description for manual creation if that bypasses AI
        const addTaskArgs = [`--title=${taskTitle}`, '--description="A test task desc"'];
        try {
            await runCliCommand('add-task', addTaskArgs, tempTestDir);
        } catch (e) {
            // If add-task fails because of AI/API key issues, this test might be flaky.
            // For now, we'll proceed assuming it can create the file structure.
            console.warn("add-task command failed, but checking file creation anayway for tasksPath test: ", e.message);
        }


        // Assert: Check if tasks.json is created in the custom tasksPath
        const tasksJsonPath = path.join(tempTestDir, customTasksPath, 'tasks.json');
        expect(await fileExists(tasksJsonPath)).toBe(true);

        // Verify content
        const tasksFileContent = await fs.readFile(tasksJsonPath, 'utf-8');
        const createdTasksData = JSON.parse(tasksFileContent);
        expect(createdTasksData.tasks).toBeInstanceOf(Array);
        expect(createdTasksData.tasks.length).toBeGreaterThanOrEqual(1); // It might add default tasks or just the one.
        
        const addedTask = createdTasksData.tasks.find(task => task.title === taskTitle);
        expect(addedTask).toBeDefined();
        expect(addedTask.title).toBe(taskTitle);

        // Also assert it's NOT in the default ./tasks path
        const defaultTasksJsonPath = path.join(tempTestDir, 'tasks', 'tasks.json');
        expect(await fileExists(defaultTasksJsonPath)).toBe(false);
    });

});
