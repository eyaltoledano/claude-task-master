const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Task Listing Integration Tests', () => {
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  const cliPath = path.join(__dirname, '../../../bin/task-master.js');

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
      `node ${cliPath} list --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('First Task');
    expect(output).toContain('Second Task');
  });

  it('should filter tasks by status', () => {
    const output = execSync(
      `node ${cliPath} list --status done --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('Second Task');
    expect(output).not.toContain('First Task');
  });

  it('should filter tasks by priority', () => {
    const output = execSync(
      `node ${cliPath} list --priority high --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('First Task');
    expect(output).not.toContain('Second Task');
  });

  it('should show empty message when no tasks match filters', () => {
    const output = execSync(
      `node ${cliPath} list --status in-progress --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('No tasks found matching the specified filters');
  });
});