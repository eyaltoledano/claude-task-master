import { execSync } from 'child_process';
import path from 'path';
// import fs from 'fs'; // fs seems unused in this version of the file
// import { fileURLToPath } from 'url'; // fileURLToPath and __filename, __dirname are not used with PROJECT_ROOT = '/app'

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const PROJECT_ROOT = '/app'; // Assuming the project is always at /app in the sandbox
const TASK_MASTER_CLI_SCRIPT_PATH = path.join(PROJECT_ROOT, 'bin/task-master.js');

// Helper function to construct fixture path
const fixturePath = (filename) => {
  // __dirname would be /app/tests/integration/cli if using the old way
  // For robustness with PROJECT_ROOT = '/app', construct from there
  return path.resolve(PROJECT_ROOT, 'tests/integration/cli/fixtures', filename);
}

// Helper to run CLI command, capture output, and handle errors
const runCLI = (args = []) => { // Added default empty array for args
  const commandArgs = Array.isArray(args) ? args.join(' ') : args; // Handle if args is already a string
  const command = `node ${TASK_MASTER_CLI_SCRIPT_PATH} ${commandArgs}`;
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    // console.log(`Executing: ${command} in ${PROJECT_ROOT}`); // Removed for cleanliness
    // stdout = execSync(command, { // Original call
    //   encoding: 'utf8',
    //   stdio: 'pipe',
    //   cwd: PROJECT_ROOT
    // });
    // Temporary call with more verbose error logging
    stdout = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: PROJECT_ROOT
      // env: { // Debug settings removed
      //   ...process.env,
      //   TASKMASTER_DEBUG: 'true',
      //   TASKMASTER_LOG_LEVEL: 'debug'
      // }
    });
  } catch (error) {
    // console.log('--- RAW STDOUT (from catch) ---', error.stdout); // Cleaned up
    // console.log('--- RAW STDERR (from catch) ---', error.stderr); // Cleaned up
    stdout = error.stdout ? error.stdout.toString() : '';
    stderr = error.stderr ? error.stderr.toString() : '';
    exitCode = typeof error.status === 'number' ? error.status : 1;
  }
  // console.log('--- CLI STDOUT (from runCLI return) ---', stdout); // Cleaned up
  return { stdout, stderr, exitCode };
};

describe('CLI command: validate-tasks', () => {
  // Construct absolute paths for fixture files
  const validTasksFile = fixturePath('valid-tasks.json');
  const invalidTaskFieldFile = fixturePath('invalid-task-field.json');
  const invalidFileStructureFile = fixturePath('invalid-file-structure.json');
  const tasksForTagValidationFile = fixturePath('tasks-for-tag-validation.json');

  // Test 1: Validate a valid tasks.json file
  test('should succeed with a valid tasks.json file', () => {
    const { stdout, exitCode } = runCLI([`validate-tasks --file ${validTasksFile}`]);
    expect(stdout).toMatch(/Validation successful for entire file structure/i);
    expect(exitCode).toBe(0);
  });

  // Test 2: Validate tasks.json with an invalid task field
  test('should fail with specific error for invalid task field', () => {
    const { stdout, stderr, exitCode } = runCLI([`validate-tasks --file ${invalidTaskFieldFile}`]);
    expect(stdout).toMatch(/Validation failed/i);
    // Updated to Zod error format
    expect(stdout).toMatch(/Path: mainS.tasks.0.status - Issue: Invalid enum value. Expected 'pending' | 'in-progress' | 'done' | 'review' | 'deferred' | 'cancelled', received 'invalid_status_value'/i);
    expect(exitCode).toBe(1);
  });

  // Test 3: Validate tasks.json with invalid file structure (e.g., missing metadata)
  test('should fail with specific error for invalid file structure', () => {
    const { stdout, stderr, exitCode } = runCLI([`validate-tasks --file ${invalidFileStructureFile}`]);
    expect(stdout).toMatch(/Validation failed/i);
    // Updated to Zod error format
    expect(stdout).toMatch(/Path: brokenTagS.metadata - Issue: Required/i);
    expect(exitCode).toBe(1);
  });

  // Test 4: Validate a specific tag with an invalid task
  test('should fail for a specific tag containing an invalid task', () => {
    const { stdout, stderr, exitCode } = runCLI([
      `validate-tasks --file ${tasksForTagValidationFile} --tag validTagWithInvalidTaskS`
    ]);
    expect(stdout).toMatch(/Validation failed for tasks for tag 'validTagWithInvalidTaskS'/i);
    // Updated to Zod error format - path is relative to the array
    expect(stdout).toMatch(/Path: 0.status - Issue: Required/i);
    expect(exitCode).toBe(1);
  });

  // Test 5: Validate a non-existent tag
  test('should error when trying to validate a non-existent tag', () => {
    const { stdout, stderr, exitCode } = runCLI([
      `validate-tasks --file ${tasksForTagValidationFile} --tag nonExistentTagS`
    ]);
    // This error comes from the command itself, not the schema validation, so it might be in stderr or different stdout format
    expect(stdout).toMatch(/Tag 'nonExistentTagS' not found or has no tasks array/i);
    expect(exitCode).toBe(1);
  });

  // Test 6: Validate a specific tag with all valid tasks
  test('should succeed for a specific tag with all valid tasks', () => {
    const { stdout, exitCode } = runCLI([
      `validate-tasks --file ${tasksForTagValidationFile} --tag validTagWithValidTasksS`
    ]);
    expect(stdout).toMatch(/Validation successful for tasks for tag 'validTagWithValidTasksS'/i);
    expect(exitCode).toBe(0);
  });
   // Test 7: Validate a specific tag with no tasks (should be valid)
  test('should succeed for a specific tag with no tasks', () => {
    const { stdout, exitCode } = runCLI([
      `validate-tasks --file ${tasksForTagValidationFile} --tag anotherValidTagS`
    ]);
    expect(stdout).toMatch(/Validation successful for tasks for tag 'anotherValidTagS'/i);
    expect(exitCode).toBe(0);
  });
});
