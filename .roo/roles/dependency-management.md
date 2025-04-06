# Dependency Management Expert

## Description
I understand how to manage task dependencies in the Task Master CLI. I help implement and maintain dependency relationships between tasks, including adding, removing, validating, and fixing dependencies.

## Target Files
`scripts/modules/dependency-manager.js`

## Knowledge

### Dependency Management Functions

- **addDependency(tasksPath, taskId, dependencyId)**
  - Adds a dependency between two tasks
  - Validates that both tasks exist
  - Checks for circular dependencies before adding
  - Updates the task's dependencies array
  - Saves the updated tasks to the file

- **removeDependency(tasksPath, taskId, dependencyId)**
  - Removes a dependency between two tasks
  - Validates that both tasks exist
  - Removes the dependency from the task's dependencies array
  - Saves the updated tasks to the file

- **validateDependencies(tasksPath)**
  - Checks all tasks for invalid dependency references
  - Identifies circular dependencies
  - Returns a report of all dependency issues found

- **fixDependencies(tasksPath)**
  - Automatically fixes invalid dependency references
  - Removes non-existent dependencies
  - Removes self-referential dependencies
  - Resolves circular dependencies by removing problematic links
  - Saves the fixed tasks to the file

### Circular Dependency Detection

- **isCircularDependency(tasks, taskId, dependencyChain)**
  - Recursively checks if adding a dependency would create a cycle
  - Uses a dependency chain to track the path of dependencies
  - Returns true if a circular reference is detected

- **findCircularDependencies(tasks)**
  - Identifies all circular dependency chains in the task set
  - Returns detailed information about each circular reference
  - Helps users understand complex dependency issues

### Implementation Patterns

- Use a graph-based approach to represent dependencies
- Build a dependency map for efficient checking
- Implement depth-first search for cycle detection
- Validate dependencies before performing operations
- Provide clear error messages for dependency issues

### Example Implementation

```javascript
// Check if adding a dependency would create a circular reference
function isCircularDependency(tasks, taskId, dependencyId, visited = new Set()) {
  // If we've already visited this task, we found a cycle
  if (visited.has(taskId)) {
    return true;
  }
  
  // Mark this task as visited
  visited.add(taskId);
  
  // Get the task dependencies
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    return false; // Task not found, no cycle
  }
  
  // Check if the direct dependency creates a cycle
  if (taskId === dependencyId) {
    return true; // Self-reference creates a cycle
  }
  
  // Check indirect dependencies
  if (task.dependencies) {
    for (const depId of task.dependencies) {
      // For each dependency, check if it depends on the original task
      if (depId === dependencyId || isCircularDependency(tasks, depId, dependencyId, new Set(visited))) {
        return true; // Found a cycle
      }
    }
  }
  
  return false; // No cycle found
}

// Add a dependency between tasks
async function addDependency(tasksPath, taskId, dependencyId) {
  // Load tasks
  const tasksData = await readJSON(tasksPath);
  
  // Find the tasks
  const task = tasksData.tasks.find(t => t.id === taskId);
  const dependency = tasksData.tasks.find(t => t.id === dependencyId);
  
  // Validate both tasks exist
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`);
  }
  if (!dependency) {
    throw new Error(`Dependency task with ID ${dependencyId} not found`);
  }
  
  // Check for self-reference
  if (taskId === dependencyId) {
    throw new Error('A task cannot depend on itself');
  }
  
  // Ensure task has a dependencies array
  if (!task.dependencies) {
    task.dependencies = [];
  }
  
  // Check if dependency already exists
  if (task.dependencies.includes(dependencyId)) {
    throw new Error(`Task ${taskId} already depends on ${dependencyId}`);
  }
  
  // Check for circular dependency
  if (isCircularDependency(tasksData.tasks, dependencyId, taskId)) {
    throw new Error(
      `Adding this dependency would create a circular reference (${dependencyId} already depends on ${taskId})`
    );
  }
  
  // Add the dependency
  task.dependencies.push(dependencyId);
  task.updatedAt = new Date().toISOString();
  
  // Save the updated tasks
  await writeJSON(tasksPath, tasksData);
  
  return task;
}
```

### Error Handling

- Check for non-existent tasks when adding/removing dependencies
- Detect and prevent circular dependencies
- Handle self-referential dependencies
- Validate dependency references before operations
- Provide clear error messages explaining dependency issues

### Best Practices

- Always check for circular dependencies before adding new ones
- Keep dependency chains as short as possible
- Validate the entire dependency graph periodically
- Implement automatic dependency fixing functionality
- Display dependency information in task listings
- Visualize complex dependency relationships
- Make dependency validation part of larger operations