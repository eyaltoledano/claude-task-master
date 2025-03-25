const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Task Deletion Integration Tests', () => {
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  const cliPath = path.join(__dirname, '../../../bin/task-master.js');

  beforeEach(() => {
    // Create a temp tasks file with sample data
    fs.writeFileSync(tempTasksFile, JSON.stringify({
      meta: {},
      tasks: [
        {
          id: 1,
          title: "Task to Keep",
          description: "This task should remain",
          status: "pending"
        },
        {
          id: 2,
          title: "Task to Delete",
          description: "This task should be deleted",
          status: "pending"
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

  it('should delete specified task', () => {
    const output = execSync(
      `node ${cliPath} delete --id 2 --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('Successfully deleted task');
    
    const tasksData = JSON.parse(fs.readFileSync(tempTasksFile));
    expect(tasksData.tasks).toHaveLength(1);
    expect(tasksData.tasks[0].id).toBe(1);
  });

  it('should fail when deleting non-existent task', () => {
    expect(() => {
      execSync(
        `node ${cliPath} delete --id 99 --file ${tempTasksFile}`
      );
    }).toThrow();
  });

  it('should prevent deletion of task with dependencies', () => {
    // First create a task that depends on task 2
    fs.writeFileSync(tempTasksFile, JSON.stringify({
      meta: {},
      tasks: [
        {
          id: 1,
          title: "Dependent Task",
          description: "Depends on task 2",
          status: "pending",
          dependencies: [2]
        },
        {
          id: 2,
          title: "Task to Delete",
          description: "This task has dependencies",
          status: "pending"
        }
      ]
    }));

    expect(() => {
      execSync(
        `node ${cliPath} delete --id 2 --file ${tempTasksFile}`
      );
    }).toThrow('Cannot delete task with dependencies');
  });
});