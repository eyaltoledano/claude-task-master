# UI Expert

## Description
I specialize in the user interface components for the Task Master CLI. I help implement and maintain clear, well-formatted display of information to the user through the command line interface.

## Target Files
`scripts/modules/ui.js`

## Knowledge

### UI Components

- **displayTaskList(tasks, statusFilter, withSubtasks)**
  - Displays a list of tasks in a formatted table
  - Filters tasks by status if specified
  - Shows or hides subtasks based on the withSubtasks parameter
  - Uses cli-table3 for table formatting
  - Includes status with color, ID, title, and dependencies

- **displayTaskDetails(task)**
  - Shows detailed information for a single task
  - Displays title, description, status, dependencies, and other metadata
  - Uses boxen to create a visual box around the task details
  - Formats dates, dependencies, and subtasks clearly

- **displayComplexityReport(reportPath)**
  - Shows the task complexity analysis report
  - Formats tasks by complexity score
  - Highlights high-complexity tasks for user attention

- **startLoadingIndicator(message) / stopLoadingIndicator(indicator)**
  - Creates and manages loading spinners using ora
  - Provides visual feedback during long-running operations
  - Shows success or failure messages on completion

### Formatting Helpers

- **getStatusWithColor(status)**
  - Returns a status string with appropriate color based on the status value
  - Uses chalk for colorization
  - Example: "pending" in yellow, "done" in green, "blocked" in red

- **formatDependenciesWithStatus(dependencies, allTasks, inTable)**
  - Formats a list of dependencies with their status indicators
  - Includes dependency status colors
  - Adapts format based on display context (table or standalone)

- **formatDate(dateString)**
  - Converts ISO date strings to human-readable format
  - Includes relative time (e.g., "2 days ago")

### Implementation Patterns

```javascript
// Display a list of tasks in a table
function displayTaskList(tasks, statusFilter, withSubtasks = false) {
  // Filter tasks by status if filter provided
  const filteredTasks = statusFilter
    ? tasks.filter(task => task.status === statusFilter)
    : tasks;
  
  if (filteredTasks.length === 0) {
    console.log(chalk.yellow(`No tasks found${statusFilter ? ` with status '${statusFilter}'` : ''}.`));
    return;
  }
  
  // Create table with appropriate columns
  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Title'),
      chalk.cyan('Status'),
      chalk.cyan('Priority'),
      chalk.cyan('Dependencies')
    ],
    wordWrap: true,
    wrapOnWordBoundary: true,
    colWidths: [10, 30, 15, 15, 30]
  });
  
  // Add tasks to table
  for (const task of filteredTasks) {
    table.push([
      task.id,
      truncate(task.title, 28),
      getStatusWithColor(task.status),
      task.priority || 'medium',
      formatDependenciesWithStatus(task.dependencies || [], tasks, true)
    ]);
    
    // Add subtasks if requested
    if (withSubtasks && task.subtasks && task.subtasks.length > 0) {
      for (const subtask of task.subtasks) {
        const subtaskId = `${task.id}.${subtask.id}`;
        table.push([
          `└─ ${subtask.id}`,
          chalk.dim(truncate(subtask.title, 25)),
          getStatusWithColor(subtask.status || 'pending'),
          subtask.priority || 'medium',
          formatDependenciesWithStatus(subtask.dependencies || [], task.subtasks, true)
        ]);
      }
    }
  }
  
  // Display the table
  console.log(table.toString());
  
  // Show task count summary
  console.log(chalk.blue(
    `Showing ${filteredTasks.length} ${statusFilter ? `${statusFilter} ` : ''}tasks${withSubtasks ? ' with subtasks' : ''}`
  ));
}

// Format status with appropriate color
function getStatusWithColor(status) {
  switch (status.toLowerCase()) {
    case 'done':
      return chalk.green(status);
    case 'in progress':
      return chalk.blue(status);
    case 'blocked':
      return chalk.red(status);
    case 'pending':
      return chalk.yellow(status);
    default:
      return status;
  }
}

// Create a loading indicator
function startLoadingIndicator(message) {
  const spinner = ora({
    text: message,
    color: 'blue',
    spinner: 'dots'
  }).start();
  
  return spinner;
}
```

### Best Practices

- Use consistent color schemes for similar information
- Apply appropriate color highlighting for status and priorities
- Create clear visual hierarchies for nested information
- Keep table columns aligned and well-proportioned
- Truncate long text to maintain formatting
- Use loading indicators for operations that take time
- Include summary information after displays
- Make output responsive to terminal width
- Provide helpful navigation suggestions after operations
- Use boxen for important highlighted information