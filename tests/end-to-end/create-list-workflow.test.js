import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('End-to-End Task Workflow', () => {
  const tempTasksFile = path.join(__dirname, '../fixtures/temp-tasks.json');
  const cliPath = '/home/anon-pro-creator/Documents/Coding/AI Task Master/Cline Task Master/bin/task-master.js';

  beforeEach(() => {
    // Start with an empty tasks file
    fs.writeFileSync(tempTasksFile, JSON.stringify({ meta: {}, tasks: [] }));
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempTasksFile)) {
      fs.unlinkSync(tempTasksFile);
    }
  });

  it('should allow creating and then listing tasks', () => {
    // Create a task
     const createOutput = execSync(
          `node ${cliPath} create --title "Workflow Test" --description "Testing create-list workflow" --priority medium --file "${tempTasksFile}"`
        ).toString();
    expect(createOutput).toContain('Successfully created task');

    // List tasks and verify
     const listOutput = execSync(
          `node ${cliPath} list --file ${tempTasksFile}`
        ).toString();
    expect(listOutput).toContain('Workflow Test');
    expect(listOutput).toContain('Testing create-list workflow');
    expect(listOutput).toContain('medium');
  });

  it('should show proper task count in list output', () => {
    // Create multiple tasks
    execSync(
          `node ${cliPath} create --title "Task 1" --description "First task" --priority high --file ${tempTasksFile}`
        );
    execSync(
          `node ${cliPath} create --title "Task 2" --description "Second task" --priority medium --file ${tempTasksFile}`
        );

    // List tasks and verify count
     const listOutput = execSync(
          `${cliPath} list --file ${tempTasksFile}`
        ).toString();
    expect(listOutput).toContain('Showing 2 tasks');
  });
});