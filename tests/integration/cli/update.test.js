const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Task Update Integration Tests', () => {
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  const cliPath = path.join(__dirname, '../../../bin/task-master.js');

  beforeEach(() => {
    // Create a temp tasks file with sample data
    fs.writeFileSync(tempTasksFile, JSON.stringify({
      meta: {},
      tasks: [
        {
          id: 1,
          title: "Original Title",
          description: "Original Description",
          status: "pending",
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

  it('should update task title', () => {
    const output = execSync(
      `node ${cliPath} update --id 1 --title "Updated Title" --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('Successfully updated task');
    
    const tasksData = JSON.parse(fs.readFileSync(tempTasksFile));
    expect(tasksData.tasks[0].title).toBe("Updated Title");
    expect(tasksData.tasks[0].description).toBe("Original Description"); // unchanged
  });

  it('should update task status', () => {
    execSync(
      `node ${cliPath} update --id 1 --status done --file ${tempTasksFile}`
    );

    const tasksData = JSON.parse(fs.readFileSync(tempTasksFile));
    expect(tasksData.tasks[0].status).toBe("done");
  });

  it('should fail when updating non-existent task', () => {
    expect(() => {
      execSync(
        `node ${cliPath} update --id 99 --title "Should Fail" --file ${tempTasksFile}`
      );
    }).toThrow();
  });
});