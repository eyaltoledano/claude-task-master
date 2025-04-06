# Create Task Boomerang

## Description
This boomerang helps you implement task creation functionality in the Task Master CLI.

## Target Pattern
Task creation implementation

## Guidance

### Task Creation Command Template

```javascript
programInstance
  .command('create-task')
  .description('Create a new task with the specified properties')
  .option('-f, --file <path>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-t, --title <title>', 'Title of the task (required)')
  .option('-d, --description <description>', 'Description of the task')
  .option('--details <details>', 'Implementation details for the task')
  .option('--status <status>', 'Initial status for the task', 'pending')
  .option('--priority <priority>', 'Priority of the task (low, medium, high)', 'medium')
  .option('--dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
  .action(async (options) => {
    try {
      // Validate required parameters
      if (!options.title) {
        console.error(chalk.red('Error: --title parameter is required'));
        process.exit(1);
      }
      
      // Show operation status
      console.log(chalk.blue(`Creating new task: ${options.title}`));
      
      // Parse dependencies if provided
      let dependencies = [];
      if (options.dependencies) {
        dependencies = options.dependencies.split(',').map(id => id.trim());
      }
      
      // Call the core function
      const newTask = await createTask(
        options.file,
        options.title,
        options.description || '',
        options.details || '',
        options.status,
        options.priority,
        dependencies
      );
      
      console.log(chalk.green(`Successfully created task with ID: ${newTask.id}`));
      
      // Display the created task
      displayTaskDetails(newTask);
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (CONFIG.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });
```

### Core Task Creation Implementation

The `createTask` function should:

1. Load the tasks from the specified file
2. Generate a new task ID
3. Create the task object with the provided properties
4. Validate dependencies if specified
5. Add the task to the tasks array
6. Save the updated tasks back to the file

```javascript
async function createTask(tasksPath, title, description, details, status, priority, dependencies = []) {
  // Load tasks
  const tasksData = await readJSON(tasksPath);
  
  // Generate new task ID
  const newId = generateNewTaskId(tasksData.tasks);
  
  // Create task object
  const newTask = {
    id: newId,
    title,
    description,
    details,
    status,
    priority,
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add dependencies if specified
  if (dependencies.length > 0) {
    // Validate each dependency exists
    for (const depId of dependencies) {
      if (!taskExists(tasksData.tasks, depId)) {
        throw new Error(`Dependency task with ID ${depId} not found`);
      }
    }
    
    // Check for circular dependencies
    if (wouldCreateCircularDependency(tasksData.tasks, newTask.id, dependencies)) {
      throw new Error(`Adding these dependencies would create a circular dependency`);
    }
    
    newTask.dependencies = dependencies;
  }
  
  // Add the task to the tasks array
  tasksData.tasks.push(newTask);
  
  // Save the updated tasks
  await writeJSON(tasksPath, tasksData);
  
  return newTask;
}
```

### Helper Functions

```javascript
// Generate a new task ID that's not already in use
function generateNewTaskId(tasks) {
  // Find the highest existing ID
  const highestId = tasks.reduce((maxId, task) => {
    const taskId = parseInt(task.id, 10);
    return taskId > maxId ? taskId : maxId;
  }, 0);
  
  // Return the next available ID
  return String(highestId + 1);
}

// Check if a task with the given ID exists
function taskExists(tasks, taskId) {
  return tasks.some(task => task.id === taskId);
}

// Check if adding dependencies would create a circular dependency
function wouldCreateCircularDependency(tasks, taskId, dependencies) {
  // Create a dependency map
  const dependencyMap = {};
  
  // Add all existing dependencies to the map
  for (const task of tasks) {
    dependencyMap[task.id] = task.dependencies || [];
  }
  
  // Add the new task's dependencies
  dependencyMap[taskId] = dependencies;
  
  // Check for circular dependencies
  return isCircularDependency(dependencyMap, taskId, []);
}

// Recursively check for circular dependencies
function isCircularDependency(dependencyMap, taskId, visitedTasks) {
  // If we've already visited this task, we found a cycle
  if (visitedTasks.includes(taskId)) {
    return true;
  }
  
  // Add this task to the visited list
  const visited = [...visitedTasks, taskId];
  
  // Check all dependencies
  const deps = dependencyMap[taskId] || [];
  for (const depId of deps) {
    if (isCircularDependency(dependencyMap, depId, visited)) {
      return true;
    }
  }
  
  return false;
}
```

### Error Handling

Ensure proper error handling:

- Check for missing required parameters
- Validate dependency references
- Prevent circular dependencies
- Handle file read/write errors
- Provide clear error messages to the user

### Testing

```javascript
// Test task creation
test('should create a new task', async () => {
  // Setup test data
  const testTasksData = {
    tasks: [{ id: '1', title: 'Existing Task', dependencies: [] }]
  };
  mockReadJSON.mockResolvedValue(testTasksData);
  
  // Call the function
  const newTask = await createTask(
    'test-tasks.json',
    'New Task',
    'Task Description',
    'Implementation details',
    'pending',
    'medium',
    []
  );
  
  // Verify task was created with correct properties
  expect(newTask).toEqual(expect.objectContaining({
    id: '2',
    title: 'New Task',
    description: 'Task Description',
    details: 'Implementation details',
    status: 'pending',
    priority: 'medium',
    dependencies: []
  }));
  
  // Verify task was saved
  expect(mockWriteJSON).toHaveBeenCalledWith(
    'test-tasks.json',
    expect.objectContaining({
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: '1' }),
        expect.objectContaining({ id: '2', title: 'New Task' })
      ])
    })
  );
});

// Test task creation with dependencies
test('should create a task with dependencies', async () => {
  // Setup test data with existing tasks
  const testTasksData = {
    tasks: [
      { id: '1', title: 'Task 1', dependencies: [] },
      { id: '2', title: 'Task 2', dependencies: [] }
    ]
  };
  mockReadJSON.mockResolvedValue(testTasksData);
  
  // Call the function with dependencies
  await createTask(
    'test-tasks.json',
    'New Task',
    'Description',
    'Details',
    'pending',
    'high',
    ['1', '2']
  );
  
  // Verify task was saved with correct dependencies
  expect(mockWriteJSON).toHaveBeenCalledWith(
    'test-tasks.json',
    expect.objectContaining({
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: '3', dependencies: ['1', '2'] })
      ])
    })
  );
});

// Test circular dependency detection
test('should reject creating a task with circular dependencies', async () => {
  // Setup test data where task 2 depends on task 1
  const testTasksData = {
    tasks: [
      { id: '1', title: 'Task 1', dependencies: ['2'] },
      { id: '2', title: 'Task 2', dependencies: [] }
    ]
  };
  mockReadJSON.mockResolvedValue(testTasksData);
  
  // Try to create a task where task 3 depends on task 1 (creating a cycle)
  await expect(
    createTask(
      'test-tasks.json',
      'New Task',
      'Description',
      'Details',
      'pending',
      'medium',
      ['1']
    )
  ).rejects.toThrow('circular dependency');
});
```