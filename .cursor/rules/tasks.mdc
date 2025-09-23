---
description: Guidelines for implementing task management operations
globs: scripts/modules/task-manager.js
alwaysApply: false
---
# Task Management Guidelines

## Tagged Task Lists System

Task Master now uses a **tagged task lists system** for multi-context task management:

- **Data Structure**: Tasks are organized into separate contexts (tags) within `tasks.json`
- **Legacy Format**: `{"tasks": [...]}`
- **Tagged Format**: `{"master": {"tasks": [...]}, "feature-branch": {"tasks": [...]}}`
- **Silent Migration**: Legacy format automatically converts to tagged format on first use
- **Tag Resolution**: Core functions receive legacy format for 100% backward compatibility
- **Default Tag**: "master" is used for all existing and new tasks unless otherwise specified

## Task Structure Standards

- **Core Task Properties**:
  - ✅ DO: Include all required properties in each task object
  - ✅ DO: Provide default values for optional properties
  - ❌ DON'T: Add extra properties that aren't in the standard schema

  ```javascript
  // ✅ DO: Follow this structure for task objects
  const task = {
    id: nextId,
    title: "Task title",
    description: "Brief task description",
    status: "pending", // "pending", "in-progress", "done", etc.
    dependencies: [], // Array of task IDs
    priority: "medium", // "high", "medium", "low"
    details: "Detailed implementation instructions",
    testStrategy: "Verification approach",
    subtasks: [] // Array of subtask objects
  };
  ```

- **Tagged Data Structure**:
  - ✅ DO: Access tasks through tag resolution layer
  - ✅ DO: Use `getTasksForTag(data, tagName)` to retrieve tasks for a specific tag
  - ✅ DO: Use `setTasksForTag(data, tagName, tasks)` to update tasks for a specific tag
  - ❌ DON'T: Directly manipulate the tagged structure in core functions

  ```javascript
  // ✅ DO: Use tag resolution functions
  const tasksData = readJSON(tasksPath);
  const currentTag = getCurrentTag() || 'master';
  const tasks = getTasksForTag(tasksData, currentTag);
  
  // Manipulate tasks as normal...
  
  // Save back to the tagged structure
  setTasksForTag(tasksData, currentTag, tasks);
  writeJSON(tasksPath, tasksData);
  ```

- **Subtask Structure**:
  - ✅ DO: Use consistent properties across subtasks
  - ✅ DO: Maintain simple numeric IDs within parent tasks
  - ❌ DON'T: Duplicate parent task properties in subtasks

  ```javascript
  // ✅ DO: Structure subtasks consistently
  const subtask = {
    id: nextSubtaskId, // Simple numeric ID, unique within the parent task
    title: "Subtask title",
    description: "Brief subtask description",
    status: "pending",
    dependencies: [], // Can include numeric IDs (other subtasks) or full task IDs
    details: "Detailed implementation instructions"
  };
  ```

## Task Creation and Parsing

- **ID Management**:
  - ✅ DO: Assign unique sequential IDs to tasks within each tag context
  - ✅ DO: Calculate the next ID based on existing tasks in the current tag
  - ❌ DON'T: Hardcode or reuse IDs within the same tag

  ```javascript
  // ✅ DO: Calculate the next available ID within the current tag
  const tasksData = readJSON(tasksPath);
  const currentTag = getCurrentTag() || 'master';
  const tasks = getTasksForTag(tasksData, currentTag);
  const highestId = Math.max(...tasks.map(t => t.id));
  const nextTaskId = highestId + 1;
  ```

- **PRD Parsing**:
  - ✅ DO: Extract tasks from PRD documents using AI
  - ✅ DO: Create tasks in the current tag context (defaults to "master")
  - ✅ DO: Provide clear prompts to guide AI task generation
  - ✅ DO: Validate and clean up AI-generated tasks

  ```javascript
  // ✅ DO: Parse into current tag context
  const tasksData = readJSON(tasksPath) || {};
  const currentTag = getCurrentTag() || 'master';
  
  // Parse tasks and add to current tag
  const newTasks = await parseTasksFromPRD(prdContent);
  setTasksForTag(tasksData, currentTag, newTasks);
  writeJSON(tasksPath, tasksData);
  ```

## Task Updates and Modifications

- **Status Management**:
  - ✅ DO: Provide functions for updating task status within current tag context
  - ✅ DO: Handle both individual tasks and subtasks
  - ✅ DO: Consider subtask status when updating parent tasks

  ```javascript
  // ✅ DO: Handle status updates within tagged context
  async function setTaskStatus(tasksPath, taskIdInput, newStatus) {
    const tasksData = readJSON(tasksPath);
    const currentTag = getCurrentTag() || 'master';
    const tasks = getTasksForTag(tasksData, currentTag);
    
    // Check if it's a subtask (e.g., "1.2")
    if (taskIdInput.includes('.')) {
      const [parentId, subtaskId] = taskIdInput.split('.').map(id => parseInt(id, 10));
      
      // Find the parent task and subtask
      const parentTask = tasks.find(t => t.id === parentId);
      const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
      
      // Update subtask status
      subtask.status = newStatus;
      
      // Check if all subtasks are done
      if (newStatus === 'done') {
        const allSubtasksDone = parentTask.subtasks.every(st => st.status === 'done');
        if (allSubtasksDone) {
          // Suggest updating parent task
        }
      }
    } else {
      // Handle regular task
      const task = tasks.find(t => t.id === parseInt(taskIdInput, 10));
      task.status = newStatus;
      
      // If marking as done, also mark subtasks
      if (newStatus === 'done' && task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          subtask.status = newStatus;
        });
      }
    }
    
    // Save updated tasks back to tagged structure
    setTasksForTag(tasksData, currentTag, tasks);
    writeJSON(tasksPath, tasksData);
  }
  ```

- **Task Expansion**:
  - ✅ DO: Use AI to generate detailed subtasks within current tag context
  - ✅ DO: Consider complexity analysis for subtask counts
  - ✅ DO: Ensure proper IDs for newly created subtasks

  ```javascript
  // ✅ DO: Generate appropriate subtasks based on complexity
  const tasksData = readJSON(tasksPath);
  const currentTag = getCurrentTag() || 'master';
  const tasks = getTasksForTag(tasksData, currentTag);
  
  if (taskAnalysis) {
    log('info', `Found complexity analysis for task ${taskId}: Score ${taskAnalysis.complexityScore}/10`);
    
    // Use recommended number of subtasks if available
    if (taskAnalysis.recommendedSubtasks && numSubtasks === CONFIG.defaultSubtasks) {
      numSubtasks = taskAnalysis.recommendedSubtasks;
      log('info', `Using recommended number of subtasks: ${numSubtasks}`);
    }
  }
  
  // Generate subtasks and save back
  // ... subtask generation logic ...
  setTasksForTag(tasksData, currentTag, tasks);
  writeJSON(tasksPath, tasksData);
  ```

## Task File Generation

- **File Formatting**:
  - ✅ DO: Use consistent formatting for task files
  - ✅ DO: Include all task properties in text files
  - ✅ DO: Format dependencies with status indicators

  ```javascript
  // ✅ DO: Use consistent file formatting
  let content = `# Task ID: ${task.id}\n`;
  content += `# Title: ${task.title}\n`;
  content += `# Status: ${task.status || 'pending'}\n`;
  
  // Format dependencies with their status
  if (task.dependencies && task.dependencies.length > 0) {
    content += `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, tasks)}\n`;
  } else {
    content += '# Dependencies: None\n';
  }
  ```

- **Tagged Context Awareness**:
  - ✅ DO: Generate task files from current tag context
  - ✅ DO: Include tag information in generated files
  - ❌ DON'T: Mix tasks from different tags in file generation

  ```javascript
  // ✅ DO: Generate files for current tag context
  async function generateTaskFiles(tasksPath, outputDir) {
    const tasksData = readJSON(tasksPath);
    const currentTag = getCurrentTag() || 'master';
    const tasks = getTasksForTag(tasksData, currentTag);
    
    // Add tag context to file header
    let content = `# Tag Context: ${currentTag}\n`;
    content += `# Task ID: ${task.id}\n`;
    // ... rest of file generation
  }
  ```

## Task Listing and Display

- **Filtering and Organization**:
  - ✅ DO: Allow filtering tasks by status within current tag context
  - ✅ DO: Handle subtask display in lists
  - ✅ DO: Use consistent table formats

  ```javascript
  // ✅ DO: Implement clear filtering within tag context
  const tasksData = readJSON(tasksPath);
  const currentTag = getCurrentTag() || 'master';
  const tasks = getTasksForTag(tasksData, currentTag);
  
  // Filter tasks by status if specified
  const filteredTasks = statusFilter 
    ? tasks.filter(task => 
        task.status && task.status.toLowerCase() === statusFilter.toLowerCase())
    : tasks;
  ```

- **Progress Tracking**:
  - ✅ DO: Calculate and display completion statistics for current tag
  - ✅ DO: Track both task and subtask completion
  - ✅ DO: Use visual progress indicators

  ```javascript
  // ✅ DO: Track and display progress within tag context
  const tasksData = readJSON(tasksPath);
  const currentTag = getCurrentTag() || 'master';
  const tasks = getTasksForTag(tasksData, currentTag);
  
  // Calculate completion statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => 
    task.status === 'done' || task.status === 'completed').length;
  const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  // Count subtasks
  let totalSubtasks = 0;
  let completedSubtasks = 0;
  
  tasks.forEach(task => {
    if (task.subtasks && task.subtasks.length > 0) {
      totalSubtasks += task.subtasks.length;
      completedSubtasks += task.subtasks.filter(st => 
        st.status === 'done' || st.status === 'completed').length;
    }
  });
  ```

## Migration and Compatibility

- **Silent Migration Handling**:
  - ✅ DO: Implement silent migration in `readJSON()` function
  - ✅ DO: Detect legacy format and convert automatically
  - ✅ DO: Preserve all existing task data during migration

  ```javascript
  // ✅ DO: Handle silent migration (implemented in utils.js)
  function readJSON(filepath) {
    let data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // Silent migration for tasks.json files
    if (data.tasks && Array.isArray(data.tasks) && !data.master && isTasksFile) {
      const migratedData = {
        master: {
          tasks: data.tasks
        }
      };
      writeJSON(filepath, migratedData);
      data = migratedData;
    }
    
    return data;
  }
  ```

- **Tag Resolution**:
  - ✅ DO: Use tag resolution functions to maintain backward compatibility
  - ✅ DO: Return legacy format to core functions
  - ❌ DON'T: Expose tagged structure to existing core logic

  ```javascript
  // ✅ DO: Use tag resolution layer
  function getTasksForTag(data, tagName) {
    if (data.tasks && Array.isArray(data.tasks)) {
      // Legacy format - return as-is
      return data.tasks;
    }
    
    if (data[tagName] && data[tagName].tasks) {
      // Tagged format - return tasks for specified tag
      return data[tagName].tasks;
    }
    
    return [];
  }
  ```

Refer to [`task-manager.js`](mdc:scripts/modules/task-manager.js) for implementation examples and [`new_features.mdc`](mdc:.cursor/rules/new_features.mdc) for integration guidelines. 