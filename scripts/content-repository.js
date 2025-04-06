/**
 * Content Repository for Task Master
 * 
 * This module serves as a central repository for content used by both
 * the traditional file-based approach (.roo directory) and the MCP-based approach.
 * It contains the content for roles and boomerangs, along with their variables.
 */

/**
 * Roles - Expertise areas for different parts of the codebase
 */
export const roles = {
  architecture: {
    title: "Application Architecture Expert",
    content: `# Application Architecture Expert

## Description
I understand the high-level architecture of the Task Master CLI application. I specialize in helping maintain the modular structure and ensuring proper separation of concerns.

## Target Files
\`scripts/modules/*.js\`

## Knowledge

The Task Master CLI is built using a modular architecture, with distinct modules responsible for different aspects:

- **\`commands.js\`**: Command Handling
  - Defines and registers all CLI commands using Commander.js
  - Parses command-line arguments and options
  - Invokes appropriate functions from other modules
  - Handles user input/output related to command execution

- **\`task-manager.js\`**: Task Data Management
  - Manages task data (loading, saving, creating, updating, deleting)
  - Implements task CRUD operations
  - Handles PRD parsing using AI
  - Manages task expansion and subtask generation
  - Updates task statuses and implements listing logic

- **\`dependency-manager.js\`**: Dependency Management
  - Manages task dependencies (adding, removing, validating)
  - Prevents circular dependencies
  - Fixes invalid dependency relationships

- **\`ui.js\`**: User Interface Components
  - Displays task lists, details, and command outputs
  - Uses chalk for colored output
  - Implements table display using cli-table3
  - Shows loading indicators and progress reporting

- **\`utils.js\`**: Utility Functions and Configuration
  - Manages global configuration settings
  - Implements logging utility
  - Provides file system operation utilities
  - Includes string manipulation and task-specific utilities`,
    variables: {
      projectName: "Task Master",
      moduleStructure: ["commands.js", "task-manager.js", "dependency-manager.js", "ui.js", "utils.js"]
    }
  },
  
  commands: {
    title: "CLI Commands Expert",
    content: `# CLI Commands Expert

## Description
I understand how to implement CLI commands using Commander.js in the {{projectName}} CLI. I ensure commands follow project conventions and best practices.

## Target Files
\`scripts/modules/commands.js\`

## Knowledge

### Command Structure Standards

\`\`\`javascript
// Standard template for all commands
programInstance
  .command('command-name')
  .description('Clear, concise description of what the command does')
  .option('-s, --short-option <value>', 'Option description', 'default value')
  .option('--long-option <value>', 'Option description')
  .action(async (options) => {
    // Command implementation
  });
\`\`\`

### Naming Conventions

- **Command Names**:
  - Use kebab-case for command names (\`analyze-complexity\`)
  - Don't use camelCase for command names
  - Use descriptive, action-oriented names

- **Option Names**:
  - Use kebab-case for long-form option names (\`--output-format\`)
  - Provide single-letter shortcuts when appropriate (\`-f, --file\`)
  - Use consistent option names across similar commands`,
    variables: {
      projectName: "Task Master"
    }
  },
  
  testing: {
    title: "Testing Expert",
    content: `# Testing Expert

## Description
I understand the testing guidelines and best practices for the {{projectName}} CLI. I help ensure proper test organization, module mocking, and testing strategies for ES modules.

## Target Files
\`**/*.test.js\`, \`tests/**/*\`

## Knowledge

### Test Organization Structure

- **Unit Tests**
  - Located in \`tests/unit/\`
  - Test individual functions in isolation
  - Mock all external dependencies
  - Example naming: \`utils.test.js\`, \`task-manager.test.js\`

- **Integration Tests**
  - Located in \`tests/integration/\`
  - Test interactions between modules
  - Example naming: \`task-workflow.test.js\`

- **End-to-End Tests**
  - Located in \`tests/e2e/\`
  - Test complete workflows from user perspective
  - Example naming: \`create-task.e2e.test.js\`

- **Test Fixtures**
  - Located in \`tests/fixtures/\`
  - Provide reusable test data`,
    variables: {
      projectName: "Task Master"
    }
  }
};

/**
 * Boomerangs - Templates for implementing specific functionality
 */
export const boomerangs = {
  expandTask: {
    title: "Expand Task Boomerang",
    content: `# Expand Task Boomerang

## Description
This boomerang helps you implement task expansion functionality in the {{projectName}} CLI.

## Target Pattern
Task expansion implementation

## Guidance

### Task Expansion Command Template

\`\`\`javascript
programInstance
  .command('expand-task')
  .description('Expand a task into subtasks using AI')
  .option('-f, --file <path>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <id>', 'ID of the task to expand (required)')
  .option('-n, --num-subtasks <number>', 'Number of subtasks to generate', '{{numSubtasks}}')
  .option('-r, --research', 'Use research to improve subtask generation', false)
  .option('-p, --prompt <text>', 'Custom prompt for the AI')
  .option('--force', 'Force regeneration of subtasks', false)
  .action(async (options) => {
    try {
      // Validate required parameters
      if (!options.id) {
        console.error(chalk.red('Error: --id parameter is required. Please provide a task ID.'));
        process.exit(1);
      }

      // Convert parameters
      const numSubtasks = parseInt(options.numSubtasks, 10);
      if (isNaN(numSubtasks) || numSubtasks <= 0) {
        console.error(chalk.red('Error: --num-subtasks must be a positive number'));
        process.exit(1);
      }

      // Show operation status
      console.log(chalk.blue(\`Expanding task \${options.id} into \${numSubtasks} subtasks...\`));

      // Call the core function
      await expandTask(
        options.file,
        options.id,
        numSubtasks,
        options.research,
        options.prompt,
        options.force
      );

      console.log(chalk.green('Successfully expanded task into subtasks'));
    } catch (error) {
      console.error(chalk.red(\`Error: \${error.message}\`));
      if (CONFIG.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });
\`\`\``,
    variables: {
      projectName: "Task Master",
      numSubtasks: 5
    }
  },
  
  addTask: {
    title: "Add Task Boomerang",
    content: `# Add Task Boomerang

## Description
This boomerang helps you implement functionality to add new tasks in the {{projectName}} CLI.

## Target Pattern
Task creation implementation

## Guidance

### Add Task Command Template

\`\`\`javascript
programInstance
  .command('add-task')
  .description('Add a new task using AI')
  .option('-f, --file <path>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-p, --prompt <text>', 'Description of the new task (required)')
  .option('-d, --dependencies <ids>', 'Comma-separated list of task IDs this task depends on')
  .option('--priority <level>', 'Task priority (high, medium, low)', 'medium')
  .action(async (options) => {
    try {
      // Validate required parameters
      if (!options.prompt) {
        console.error(chalk.red('Error: --prompt parameter is required. Please provide a task description.'));
        process.exit(1);
      }

      // Parse dependencies if provided
      let dependencies = [];
      if (options.dependencies) {
        dependencies = options.dependencies.split(',').map(id => id.trim());
      }

      // Validate priority
      const validPriorities = ['high', 'medium', 'low'];
      if (!validPriorities.includes(options.priority)) {
        console.error(chalk.red(\`Error: Invalid priority. Must be one of: \${validPriorities.join(', ')}\`));
        process.exit(1);
      }

      // Show operation status
      console.log(chalk.blue('Adding new task...'));

      // Call the core function
      const newTask = await addTask(
        options.file,
        options.prompt,
        dependencies,
        options.priority
      );

      console.log(chalk.green(\`Successfully added task with ID: \${newTask.id}\`));
    } catch (error) {
      console.error(chalk.red(\`Error: \${error.message}\`));
      if (CONFIG.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });
\`\`\``,
    variables: {
      projectName: "Task Master"
    }
  }
};

/**
 * Process variables in content
 * @param {string} content - The content with variables to process
 * @param {Object} variables - The variables to replace in the content
 * @param {Object} options - Additional options for processing
 * @returns {string} - The processed content with variables replaced
 */
export function processVariables(content, variables = {}, options = {}) {
  let processedContent = content;
  
  // Combine variables from parameters and options
  const allVariables = { ...variables, ...options };
  
  // Replace variables in content
  for (const [key, value] of Object.entries(allVariables)) {
    // Handle different types of values
    if (Array.isArray(value)) {
      // For arrays, join with newlines or other separator
      const replacement = value.map(item => `- ${item}`).join('\n');
      processedContent = processedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacement);
    } else if (typeof value === 'object' && value !== null) {
      // For objects, stringify or handle specially
      processedContent = processedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), JSON.stringify(value, null, 2));
    } else if (value !== undefined && value !== null) {
      // For simple values
      processedContent = processedContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }
  
  return processedContent;
}