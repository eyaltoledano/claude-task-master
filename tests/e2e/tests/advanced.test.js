export default async function testAdvanced(logger, helpers, context) {
  const { testDir } = context;
  logger.info('Starting advanced features tests...');
  const results = [];

  try {
    // Test Tag Context Management
    logger.info('Testing tag context management...');
    
    // Create new tag contexts
    const tag1Result = await helpers.taskMaster('add-tag', ['feature-auth', '--description', 'Authentication feature'], { cwd: testDir });
    results.push({
      test: 'Create tag context - feature-auth',
      passed: tag1Result.exitCode === 0,
      output: tag1Result.stdout
    });

    const tag2Result = await helpers.taskMaster('add-tag', ['feature-api', '--description', 'API development'], { cwd: testDir });
    results.push({
      test: 'Create tag context - feature-api',
      passed: tag2Result.exitCode === 0,
      output: tag2Result.stdout
    });

    // Add task to feature-auth tag
    const task1Result = await helpers.taskMaster('add-task', ['--tag=feature-auth', '--prompt', 'Implement user authentication'], { cwd: testDir });
    results.push({
      test: 'Add task to feature-auth tag',
      passed: task1Result.exitCode === 0,
      output: task1Result.stdout
    });

    // Add task to feature-api tag
    const task2Result = await helpers.taskMaster('add-task', ['--tag=feature-api', '--prompt', 'Create REST API endpoints'], { cwd: testDir });
    results.push({
      test: 'Add task to feature-api tag',
      passed: task2Result.exitCode === 0,
      output: task2Result.stdout
    });

    // List all tag contexts
    const listTagsResult = await helpers.taskMaster('tags', [], { cwd: testDir });
    results.push({
      test: 'List all tag contexts',
      passed: listTagsResult.exitCode === 0 && 
              listTagsResult.stdout.includes('feature-auth') && 
              listTagsResult.stdout.includes('feature-api'),
      output: listTagsResult.stdout
    });

    // List tasks in feature-auth tag
    const taggedTasksResult = await helpers.taskMaster('list', ['--tag=feature-auth'], { cwd: testDir });
    results.push({
      test: 'List tasks in feature-auth tag',
      passed: taggedTasksResult.exitCode === 0 && 
              taggedTasksResult.stdout.includes('Implement user authentication'),
      output: taggedTasksResult.stdout
    });

    // Test Model Configuration
    logger.info('Testing model configuration...');

    // Set main model
    const setMainModelResult = await helpers.taskMaster('models', ['--set-main', 'gpt-4'], { cwd: testDir });
    results.push({
      test: 'Set main model',
      passed: setMainModelResult.exitCode === 0,
      output: setMainModelResult.stdout
    });

    // Set research model
    const setResearchModelResult = await helpers.taskMaster('models', ['--set-research', 'claude-3-sonnet'], { cwd: testDir });
    results.push({
      test: 'Set research model',
      passed: setResearchModelResult.exitCode === 0,
      output: setResearchModelResult.stdout
    });

    // Set fallback model
    const setFallbackModelResult = await helpers.taskMaster('models', ['--set-fallback', 'gpt-3.5-turbo'], { cwd: testDir });
    results.push({
      test: 'Set fallback model',
      passed: setFallbackModelResult.exitCode === 0,
      output: setFallbackModelResult.stdout
    });

    // Verify model configuration
    const showModelsResult = await helpers.taskMaster('models', [], { cwd: testDir });
    results.push({
      test: 'Show model configuration',
      passed: showModelsResult.exitCode === 0 && 
              showModelsResult.stdout.includes('gpt-4') &&
              showModelsResult.stdout.includes('claude-3-sonnet') &&
              showModelsResult.stdout.includes('gpt-3.5-turbo'),
      output: showModelsResult.stdout
    });

    // Test Task Expansion
    logger.info('Testing task expansion...');

    // Add task for expansion
    const expandTaskResult = await helpers.taskMaster('add-task', ['--prompt', 'Build REST API'], { cwd: testDir });
    const expandTaskMatch = expandTaskResult.stdout.match(/#(\d+)/);
    const expandTaskId = expandTaskMatch ? expandTaskMatch[1] : null;
    
    results.push({
      test: 'Add task for expansion',
      passed: expandTaskResult.exitCode === 0 && expandTaskId !== null,
      output: expandTaskResult.stdout
    });

    if (expandTaskId) {
      // Single task expansion
      const expandResult = await helpers.taskMaster('expand', [expandTaskId], { cwd: testDir });
      results.push({
        test: 'Expand single task',
        passed: expandResult.exitCode === 0 && expandResult.stdout.includes('subtasks'),
        output: expandResult.stdout
      });

      // Verify expand worked
      const afterExpandResult = await helpers.taskMaster('show', [expandTaskId], { cwd: testDir });
      results.push({
        test: 'Verify task expansion',
        passed: afterExpandResult.exitCode === 0 && afterExpandResult.stdout.includes('subtasks'),
        output: afterExpandResult.stdout
      });

      // Force expand (re-expand)
      const forceExpandResult = await helpers.taskMaster('expand', [expandTaskId, '--force'], { cwd: testDir });
      results.push({
        test: 'Force expand task',
        passed: forceExpandResult.exitCode === 0,
        output: forceExpandResult.stdout
      });
    }

    // Test Subtask Management
    logger.info('Testing subtask management...');

    // Add task for subtask testing
    const subtaskParentResult = await helpers.taskMaster('add-task', ['--prompt', 'Create user interface'], { cwd: testDir });
    const parentMatch = subtaskParentResult.stdout.match(/#(\d+)/);
    const parentTaskId = parentMatch ? parentMatch[1] : null;

    if (parentTaskId) {
      // Add subtasks manually
      const addSubtask1Result = await helpers.taskMaster('add-subtask', ['--parent', parentTaskId, '--title', 'Design mockups'], { cwd: testDir });
      results.push({
        test: 'Add subtask - Design mockups',
        passed: addSubtask1Result.exitCode === 0,
        output: addSubtask1Result.stdout
      });

      const addSubtask2Result = await helpers.taskMaster('add-subtask', ['--parent', parentTaskId, '--title', 'Implement components'], { cwd: testDir });
      results.push({
        test: 'Add subtask - Implement components',
        passed: addSubtask2Result.exitCode === 0,
        output: addSubtask2Result.stdout
      });

      // List subtasks (use show command to see subtasks)
      const listSubtasksResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
      results.push({
        test: 'List subtasks',
        passed: listSubtasksResult.exitCode === 0 && 
                listSubtasksResult.stdout.includes('Design mockups') &&
                listSubtasksResult.stdout.includes('Implement components'),
        output: listSubtasksResult.stdout
      });

      // Update subtask
      const subtaskId = `${parentTaskId}.1`;
      const updateSubtaskResult = await helpers.taskMaster('update-subtask', ['--id', subtaskId, '--prompt', 'Create detailed mockups'], { cwd: testDir });
      results.push({
        test: 'Update subtask',
        passed: updateSubtaskResult.exitCode === 0,
        output: updateSubtaskResult.stdout
      });

      // Remove subtask
      const removeSubtaskId = `${parentTaskId}.2`;
      const removeSubtaskResult = await helpers.taskMaster('remove-subtask', ['--id', removeSubtaskId], { cwd: testDir });
      results.push({
        test: 'Remove subtask',
        passed: removeSubtaskResult.exitCode === 0,
        output: removeSubtaskResult.stdout
      });

      // Verify subtask changes
      const verifySubtasksResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
      results.push({
        test: 'Verify subtask changes',
        passed: verifySubtasksResult.exitCode === 0 && 
                verifySubtasksResult.stdout.includes('Create detailed mockups') &&
                !verifySubtasksResult.stdout.includes('Implement components'),
        output: verifySubtasksResult.stdout
      });

      // Clear all subtasks
      const clearSubtasksResult = await helpers.taskMaster('clear-subtasks', ['--id', parentTaskId], { cwd: testDir });
      results.push({
        test: 'Clear all subtasks',
        passed: clearSubtasksResult.exitCode === 0,
        output: clearSubtasksResult.stdout
      });

      // Verify subtasks cleared
      const verifyClearResult = await helpers.taskMaster('show', [parentTaskId], { cwd: testDir });
      results.push({
        test: 'Verify subtasks cleared',
        passed: verifyClearResult.exitCode === 0 && 
                (!verifyClearResult.stdout.includes('Design mockups') &&
                 !verifyClearResult.stdout.includes('Create detailed mockups')),
        output: verifyClearResult.stdout
      });
    }

    // Test Expand All
    logger.info('Testing expand all...');

    // Add multiple tasks
    await helpers.taskMaster('add-task', ['--prompt', 'Task A for expand all'], { cwd: testDir });
    await helpers.taskMaster('add-task', ['--prompt', 'Task B for expand all'], { cwd: testDir });

    const expandAllResult = await helpers.taskMaster('expand', ['--all'], { cwd: testDir });
    results.push({
      test: 'Expand all tasks',
      passed: expandAllResult.exitCode === 0,
      output: expandAllResult.stdout
    });

    // Test Generate Task Files
    logger.info('Testing generate task files...');

    // Generate files for a specific task
    if (expandTaskId) {
      const generateResult = await helpers.taskMaster('generate', [expandTaskId], { cwd: testDir });
      results.push({
        test: 'Generate task files',
        passed: generateResult.exitCode === 0,
        output: generateResult.stdout
      });

      // Check if files were created
      const taskFilePath = `${testDir}/tasks/task_${expandTaskId}.md`;
      const fileExists = helpers.fileExists(taskFilePath);
      
      results.push({
        test: 'Verify generated task file exists',
        passed: fileExists,
        output: fileExists ? `Task file created at ${taskFilePath}` : 'Task file not found'
      });
    }

    // Test Tag Context Integrity After Operations
    logger.info('Testing tag context integrity after operations...');

    // Verify tag contexts still exist
    const finalTagListResult = await helpers.taskMaster('tags', [], { cwd: testDir });
    results.push({
      test: 'Final tag context list verification',
      passed: finalTagListResult.exitCode === 0 && 
              finalTagListResult.stdout.includes('feature-auth') &&
              finalTagListResult.stdout.includes('feature-api'),
      output: finalTagListResult.stdout
    });

    // Verify tasks are still in their respective tag contexts
    const finalTaggedTasksResult = await helpers.taskMaster('list', ['--tag=feature-api'], { cwd: testDir });
    results.push({
      test: 'Final tasks in tag context verification',
      passed: finalTaggedTasksResult.exitCode === 0 && 
              finalTaggedTasksResult.stdout.includes('Create REST API endpoints'),
      output: finalTaggedTasksResult.stdout
    });

    // Test Additional Advanced Features
    logger.info('Testing additional advanced features...');

    // Test priority task
    const priorityTagResult = await helpers.taskMaster('add-task', ['--prompt', 'High priority task', '--priority', 'high'], { cwd: testDir });
    results.push({
      test: 'Add task with high priority',
      passed: priorityTagResult.exitCode === 0,
      output: priorityTagResult.stdout
    });

    // Test filtering by status
    const statusFilterResult = await helpers.taskMaster('list', ['--status', 'pending'], { cwd: testDir });
    results.push({
      test: 'Filter by status',
      passed: statusFilterResult.exitCode === 0,
      output: statusFilterResult.stdout
    });

  } catch (error) {
    logger.error('Error in advanced features tests:', error);
    results.push({
      test: 'Advanced features test suite',
      passed: false,
      error: error.message
    });
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  return {
    name: 'Advanced Features',
    passed,
    total,
    results,
    summary: `Advanced features tests: ${passed}/${total} passed`
  };
};