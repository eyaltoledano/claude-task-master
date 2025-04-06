# Expand Task Boomerang

## Description
This boomerang helps you implement task expansion functionality in the Task Master CLI.

## Target Pattern
Task expansion implementation

## Guidance

### Task Expansion Command Template

```javascript
programInstance
  .command('expand-task')
  .description('Expand a task into subtasks using AI')
  .option('-f, --file <path>', 'Path to the tasks file', 'tasks/tasks.json')
  .option('-i, --id <id>', 'ID of the task to expand (required)')
  .option('-n, --num-subtasks <number>', 'Number of subtasks to generate', '5')
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
      console.log(chalk.blue(`Expanding task ${options.id} into ${numSubtasks} subtasks...`));

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
      console.error(chalk.red(`Error: ${error.message}`));
      if (CONFIG.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });
```