const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Task Creation Integration Tests', () => {
  const tempTasksFile = path.join(__dirname, '../../fixtures/temp-tasks.json');
  const cliPath = path.join(__dirname, '../../../bin/task-master.js');

  beforeEach(() => {
    // Create a clean temp tasks file
    fs.writeFileSync(tempTasksFile, JSON.stringify({ meta: {}, tasks: [] }));
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempTasksFile)) {
      fs.unlinkSync(tempTasksFile);
    }
  });

  it('should create a new task with required fields', () => {
    const title = 'Test Task';
    const description = 'Test Description';
    const priority = 'high';
    
    const output = execSync(
      `node ${cliPath} create --title "${title}" --description "${description}" --priority ${priority} --file ${tempTasksFile}`
    ).toString();

    expect(output).toContain('Successfully created task');
    
    const tasksData = JSON.parse(fs.readFileSync(tempTasksFile));
    expect(tasksData.tasks).toHaveLength(1);
    expect(tasksData.tasks[0].title).toBe(title);
    expect(tasksData.tasks[0].description).toBe(description);
    expect(tasksData.tasks[0].priority).toBe(priority);
  });

  it('should fail when required fields are missing', () => {
    expect(() => {
      execSync(`node ${cliPath} create --file ${tempTasksFile}`);
    }).toThrow();
  });
});