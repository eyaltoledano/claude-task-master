/**
 * Core task operations test module
 * Tests all fundamental task management functionality
 */

export default async function testCoreOperations(logger, helpers, context) {
  const { testDir } = context;
  const results = {
    status: 'passed',
    errors: []
  };

  try {
    logger.info('Starting core task operations tests...');

    // Test 1: List tasks (may have tasks from PRD parsing)
    logger.info('\nTest 1: List tasks');
    const listResult1 = await helpers.taskMaster('list', [], { cwd: testDir });
    if (listResult1.exitCode !== 0) {
      throw new Error(`List command failed: ${listResult1.stderr}`);
    }
    // Check for expected output patterns - either empty or with tasks
    const hasValidOutput = listResult1.stdout.includes('No tasks found') || 
                          listResult1.stdout.includes('Task List') ||
                          listResult1.stdout.includes('Project Dashboard') ||
                          listResult1.stdout.includes('Listing tasks from');
    if (!hasValidOutput) {
      throw new Error('Unexpected list output format');
    }
    logger.success('✓ List tasks successful');

    // Test 2: Add manual task
    logger.info('\nTest 2: Add manual task');
    const addResult1 = await helpers.taskMaster('add-task', ['--title', 'Write unit tests', '--description', 'Create comprehensive unit tests for the application'], { cwd: testDir });
    if (addResult1.exitCode !== 0) {
      throw new Error(`Failed to add manual task: ${addResult1.stderr}`);
    }
    const manualTaskId = helpers.extractTaskId(addResult1.stdout);
    if (!manualTaskId) {
      throw new Error('Failed to extract task ID from add output');
    }
    logger.success(`✓ Added manual task with ID: ${manualTaskId}`);

    // Test 3: Add AI task
    logger.info('\nTest 3: Add AI task');
    const addResult2 = await helpers.taskMaster('add-task', ['--prompt', 'Implement authentication system'], { cwd: testDir });
    if (addResult2.exitCode !== 0) {
      throw new Error(`Failed to add AI task: ${addResult2.stderr}`);
    }
    const aiTaskId = helpers.extractTaskId(addResult2.stdout);
    if (!aiTaskId) {
      throw new Error('Failed to extract AI task ID from add output');
    }
    logger.success(`✓ Added AI task with ID: ${aiTaskId}`);

    // Test 4: Add another task for dependency testing
    logger.info('\nTest 4: Add task for dependency testing');
    const addResult3 = await helpers.taskMaster('add-task', ['--title', 'Create database schema', '--description', 'Design and implement the database schema'], { cwd: testDir });
    if (addResult3.exitCode !== 0) {
      throw new Error(`Failed to add database task: ${addResult3.stderr}`);
    }
    const dbTaskId = helpers.extractTaskId(addResult3.stdout);
    if (!dbTaskId) {
      throw new Error('Failed to extract database task ID');
    }
    logger.success(`✓ Added database task with ID: ${dbTaskId}`);

    // Test 5: List tasks (should show our newly added tasks)
    logger.info('\nTest 5: List all tasks');
    const listResult2 = await helpers.taskMaster('list', [], { cwd: testDir });
    if (listResult2.exitCode !== 0) {
      throw new Error(`List command failed: ${listResult2.stderr}`);
    }
    // Check that we can find our task IDs in the output
    const hasTask11 = listResult2.stdout.includes('11');
    const hasTask12 = listResult2.stdout.includes('12');
    const hasTask13 = listResult2.stdout.includes('13');
    
    if (!hasTask11 || !hasTask12 || !hasTask13) {
      throw new Error('Not all task IDs found in list output');
    }
    
    // Also check for partial matches (list may truncate titles)
    const hasOurTasks = listResult2.stdout.includes('Write') || 
                       listResult2.stdout.includes('Create');
    if (hasOurTasks) {
      logger.success('✓ List tasks shows our added tasks');
    } else {
      logger.warning('Task titles may be truncated in list view');
    }

    // Test 6: Get next task
    logger.info('\nTest 6: Get next task');
    const nextResult = await helpers.taskMaster('next', [], { cwd: testDir });
    if (nextResult.exitCode !== 0) {
      throw new Error(`Next task command failed: ${nextResult.stderr}`);
    }
    logger.success('✓ Get next task successful');

    // Test 7: Show task details
    logger.info('\nTest 7: Show task details');
    const showResult = await helpers.taskMaster('show', [aiTaskId], { cwd: testDir });
    if (showResult.exitCode !== 0) {
      throw new Error(`Show task details failed: ${showResult.stderr}`);
    }
    // Check that the task ID is shown and basic structure is present
    if (!showResult.stdout.includes(`Task: #${aiTaskId}`) && !showResult.stdout.includes(`ID:           │ ${aiTaskId}`)) {
      throw new Error('Task ID not found in show output');
    }
    if (!showResult.stdout.includes('Status:') || !showResult.stdout.includes('Priority:')) {
      throw new Error('Task details missing expected fields');
    }
    logger.success('✓ Show task details successful');

    // Test 8: Add dependencies
    logger.info('\nTest 8: Add dependencies');
    const addDepResult = await helpers.taskMaster('add-dependency', ['--id', aiTaskId, '--depends-on', dbTaskId], { cwd: testDir });
    if (addDepResult.exitCode !== 0) {
      throw new Error(`Failed to add dependency: ${addDepResult.stderr}`);
    }
    logger.success('✓ Added dependency successfully');

    // Test 9: Verify dependency was added
    logger.info('\nTest 9: Verify dependency');
    const showResult2 = await helpers.taskMaster('show', [aiTaskId], { cwd: testDir });
    if (showResult2.exitCode !== 0) {
      throw new Error(`Show task failed: ${showResult2.stderr}`);
    }
    if (!showResult2.stdout.includes('Dependencies:') || !showResult2.stdout.includes(dbTaskId)) {
      throw new Error('Dependency not shown in task details');
    }
    logger.success('✓ Dependency verified in task details');

    // Test 10: Test circular dependency (should fail)
    logger.info('\nTest 10: Test circular dependency prevention');
    const circularResult = await helpers.taskMaster('add-dependency', ['--id', dbTaskId, '--depends-on', aiTaskId], { 
      cwd: testDir,
      allowFailure: true 
    });
    if (circularResult.exitCode === 0) {
      throw new Error('Circular dependency was not prevented');
    }
    if (!circularResult.stderr.toLowerCase().includes('circular')) {
      throw new Error('Expected circular dependency error message');
    }
    logger.success('✓ Circular dependency prevented successfully');

    // Test 11: Test non-existent dependency
    logger.info('\nTest 11: Test non-existent dependency');
    const nonExistResult = await helpers.taskMaster('add-dependency', ['--id', '99999', '--depends-on', '88888'], { 
      cwd: testDir,
      allowFailure: true 
    });
    if (nonExistResult.exitCode === 0) {
      throw new Error('Non-existent dependency was incorrectly allowed');
    }
    logger.success('✓ Non-existent dependency handled correctly');

    // Test 12: Remove dependency
    logger.info('\nTest 12: Remove dependency');
    const removeDepResult = await helpers.taskMaster('remove-dependency', ['--id', aiTaskId, '--depends-on', dbTaskId], { cwd: testDir });
    if (removeDepResult.exitCode !== 0) {
      throw new Error(`Failed to remove dependency: ${removeDepResult.stderr}`);
    }
    logger.success('✓ Removed dependency successfully');

    // Test 13: Validate dependencies
    logger.info('\nTest 13: Validate dependencies');
    const validateResult = await helpers.taskMaster('validate-dependencies', [], { cwd: testDir });
    if (validateResult.exitCode !== 0) {
      throw new Error(`Dependency validation failed: ${validateResult.stderr}`);
    }
    logger.success('✓ Dependency validation successful');

    // Test 14: Update task description
    logger.info('\nTest 14: Update task description');
    const updateResult = await helpers.taskMaster('update-task', [manualTaskId, '--description', 'Write comprehensive unit tests'], { cwd: testDir });
    if (updateResult.exitCode !== 0) {
      throw new Error(`Failed to update task: ${updateResult.stderr}`);
    }
    logger.success('✓ Updated task description successfully');

    // Test 15: Add subtask
    logger.info('\nTest 15: Add subtask');
    const subtaskResult = await helpers.taskMaster('add-subtask', [manualTaskId, 'Write test for login'], { cwd: testDir });
    if (subtaskResult.exitCode !== 0) {
      throw new Error(`Failed to add subtask: ${subtaskResult.stderr}`);
    }
    const subtaskId = helpers.extractTaskId(subtaskResult.stdout) || '1.1';
    logger.success(`✓ Added subtask with ID: ${subtaskId}`);

    // Test 16: Verify subtask relationship
    logger.info('\nTest 16: Verify subtask relationship');
    const showResult3 = await helpers.taskMaster('show', [manualTaskId], { cwd: testDir });
    if (showResult3.exitCode !== 0) {
      throw new Error(`Show task failed: ${showResult3.stderr}`);
    }
    if (!showResult3.stdout.includes('Subtasks:')) {
      throw new Error('Subtasks section not shown in parent task');
    }
    logger.success('✓ Subtask relationship verified');

    // Test 17: Set task status to in_progress
    logger.info('\nTest 17: Set task status to in_progress');
    const statusResult1 = await helpers.taskMaster('set-status', [manualTaskId, 'in_progress'], { cwd: testDir });
    if (statusResult1.exitCode !== 0) {
      throw new Error(`Failed to update task status: ${statusResult1.stderr}`);
    }
    logger.success('✓ Set task status to in_progress');

    // Test 18: Set task status to completed
    logger.info('\nTest 18: Set task status to completed');
    const statusResult2 = await helpers.taskMaster('set-status', [dbTaskId, 'completed'], { cwd: testDir });
    if (statusResult2.exitCode !== 0) {
      throw new Error(`Failed to complete task: ${statusResult2.stderr}`);
    }
    logger.success('✓ Set task status to completed');

    // Test 19: List tasks with status filter
    logger.info('\nTest 19: List tasks by status');
    const listStatusResult = await helpers.taskMaster('list', ['--status', 'completed'], { cwd: testDir });
    if (listStatusResult.exitCode !== 0) {
      throw new Error(`List by status failed: ${listStatusResult.stderr}`);
    }
    if (!listStatusResult.stdout.includes('Create database schema')) {
      throw new Error('Completed task not shown in filtered list');
    }
    logger.success('✓ List tasks by status successful');

    // Test 20: Remove single task
    logger.info('\nTest 20: Remove single task');
    const removeResult1 = await helpers.taskMaster('remove-task', [dbTaskId], { cwd: testDir });
    if (removeResult1.exitCode !== 0) {
      throw new Error(`Failed to remove task: ${removeResult1.stderr}`);
    }
    logger.success('✓ Removed single task successfully');

    // Test 21: Remove multiple tasks
    logger.info('\nTest 21: Remove multiple tasks');
    const removeResult2 = await helpers.taskMaster('remove-task', [manualTaskId, aiTaskId], { cwd: testDir });
    if (removeResult2.exitCode !== 0) {
      throw new Error(`Failed to remove multiple tasks: ${removeResult2.stderr}`);
    }
    logger.success('✓ Removed multiple tasks successfully');

    // Test 22: Verify tasks were removed
    logger.info('\nTest 22: Verify tasks were removed');
    const listResult3 = await helpers.taskMaster('list', [], { cwd: testDir });
    if (listResult3.exitCode !== 0) {
      throw new Error(`List command failed: ${listResult3.stderr}`);
    }
    // Check that our specific task IDs are no longer in the list
    const stillHasTask11 = new RegExp(`\\b${manualTaskId}\\b`).test(listResult3.stdout);
    const stillHasTask12 = new RegExp(`\\b${aiTaskId}\\b`).test(listResult3.stdout);
    const stillHasTask13 = new RegExp(`\\b${dbTaskId}\\b`).test(listResult3.stdout);
    
    if (stillHasTask11 || stillHasTask12 || stillHasTask13) {
      throw new Error('Removed task IDs still appear in list');
    }
    logger.success('✓ Verified tasks were removed');

    // Test 23: Fix dependencies (cleanup)
    logger.info('\nTest 23: Fix dependencies');
    const fixDepsResult = await helpers.taskMaster('fix-dependencies', [], { cwd: testDir });
    if (fixDepsResult.exitCode !== 0) {
      // Non-critical, just log
      logger.warning(`Fix dependencies had issues: ${fixDepsResult.stderr}`);
    } else {
      logger.success('✓ Fix dependencies command executed');
    }

    logger.info('\n✅ All core task operations tests passed!');

  } catch (error) {
    results.status = 'failed';
    results.errors.push({
      test: 'core operations',
      error: error.message,
      stack: error.stack
    });
    logger.error(`Core operations test failed: ${error.message}`);
  }

  return results;
}