import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('CLI Task Listing Integration Tests', () => {
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  const cliPath = '/home/anon-pro-creator/Documents/Coding/AI Task Master/Cline Task Master/bin/task-master.js';

  beforeEach(() => {
    // Create a temp tasks file with sample data
    fs.writeFileSync(tempTasksFile, JSON.stringify({
      meta: {
        projectName: "Test Project",
        version: "1.0.0"
      },
      tasks: [
        {
          id: 1,
          title: "First Task",
          description: "First Description",
          status: "pending",
          priority: "high"
        },
        {
          id: 2,
          title: "Second Task",
          description: "Second Description",
          status: "done",
          priority: "medium"
        }
      ]
    }));
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempTasksFile)) {
      fs.unlinkSync(tempTasksFile);
    }
  });

  it('should list all tasks', () => {
    const output = execSync(
              `${cliPath} list --file "${tempTasksFile}"`
            ).toString();

    expect(output).toContain('First Task');
    expect(output).toContain('Second Task');
  });

  it('should filter tasks by status', () => {
    const output = execSync(
          `${cliPath} list --status done --file ${tempTasksFile}`
        ).toString();

    expect(output).toContain('Second Task');
    expect(output).not.toContain('First Task');
  });

  it('should filter tasks by priority', () => {
    const output = execSync(
          `${cliPath} list --priority high --file ${tempTasksFile}`
        ).toString();

    expect(output).toContain('First Task');
    expect(output).not.toContain('Second Task');
  });

  it('should show empty message when no tasks match filters', () => {
    const output = execSync(
          `${cliPath} list --status in-progress --file ${tempTasksFile}`
        ).toString();

    expect(output).toContain('No tasks found matching the specified filters');
  });
});