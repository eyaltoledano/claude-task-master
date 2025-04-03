/**
 * ui.js
 * User interface functions for the Task Master CLI
 */

import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import ora from 'ora';
import Table from 'cli-table3';
import gradient from 'gradient-string';
import { CONFIG, log, findTaskById, readJSON, readComplexityReport, truncate } from './utils.js';
import path from 'path';
import fs from 'fs';
import { findNextTask, analyzeTaskComplexity } from './task-manager.js';

// Create a color gradient for the banner
const coolGradient = gradient(['#00b4d8', '#0077b6', '#03045e']);
const warmGradient = gradient(['#fb8b24', '#e36414', '#9a031e']);

/**
 * Display a fancy banner for the CLI
 */
function displayBanner() {
  console.clear();
  const bannerText = figlet.textSync('Task Master', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  
  console.log(coolGradient(bannerText));
  
  // Add creator credit line below the banner
  console.log(chalk.dim('by ') + chalk.cyan.underline('https://x.com/eyaltoledano'));
  
  // Read version directly from package.json
  let version = CONFIG.projectVersion; // Default fallback
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      version = packageJson.version;
    }
  } catch (error) {
    // Silently fall back to default version
  }
  
  console.log(boxen(chalk.white(`${chalk.bold('Version:')} ${version}   ${chalk.bold('Project:')} ${CONFIG.projectName}`), {
    padding: 1,
    margin: { top: 0, bottom: 1 },
    borderStyle: 'round',
    borderColor: 'cyan'
  }));
}

/**
 * Start a loading indicator with an animated spinner
 * @param {string} message - Message to display next to the spinner
 * @returns {Object} Spinner object
 */
function startLoadingIndicator(message) {
  const spinner = ora({
    text: message,
    color: 'cyan'
  }).start();
  
  return spinner;
}

/**
 * Stop a loading indicator
 * @param {Object} spinner - Spinner object to stop
 */
function stopLoadingIndicator(spinner) {
  if (spinner && spinner.stop) {
    spinner.stop();
  }
}

/**
 * Create a colored progress bar
 * @param {number} percent - The completion percentage
 * @param {number} length - The total length of the progress bar in characters
 * @param {Object} statusBreakdown - Optional breakdown of non-complete statuses (e.g., {pending: 20, 'in-progress': 10})
 * @returns {string} The formatted progress bar
 */
function createProgressBar(percent, length = 30, statusBreakdown = null) {
  // Adjust the percent to treat deferred and cancelled as complete
  const effectivePercent = statusBreakdown ? 
    Math.min(100, percent + (statusBreakdown.deferred || 0) + (statusBreakdown.cancelled || 0)) : 
    percent;
    
  // Calculate how many characters to fill for "true completion"
  const trueCompletedFilled = Math.round(percent * length / 100);
  
  // Calculate how many characters to fill for "effective completion" (including deferred/cancelled)
  const effectiveCompletedFilled = Math.round(effectivePercent * length / 100);
  
  // The "deferred/cancelled" section (difference between true and effective)
  const deferredCancelledFilled = effectiveCompletedFilled - trueCompletedFilled;
  
  // Set the empty section (remaining after effective completion)
  const empty = length - effectiveCompletedFilled;
  
  // Determine color based on percentage for the completed section
  let completedColor;
  if (percent < 25) {
    completedColor = chalk.red;
  } else if (percent < 50) {
    completedColor = chalk.hex('#FFA500'); // Orange
  } else if (percent < 75) {
    completedColor = chalk.yellow;
  } else if (percent < 100) {
    completedColor = chalk.green;
  } else {
    completedColor = chalk.hex('#006400'); // Dark green
  }
  
  // Create colored sections
  const completedSection = completedColor('█'.repeat(trueCompletedFilled));
  
  // Gray section for deferred/cancelled items
  const deferredCancelledSection = chalk.gray('█'.repeat(deferredCancelledFilled));
  
  // If we have a status breakdown, create a multi-colored remaining section
  let remainingSection = '';
  
  if (statusBreakdown && empty > 0) {
    // Status colors (matching the statusConfig colors in getStatusWithColor)
    const statusColors = {
      'pending': chalk.yellow,
      'in-progress': chalk.hex('#FFA500'), // Orange
      'blocked': chalk.red,
      'review': chalk.magenta,
      // Deferred and cancelled are treated as part of the completed section
    };
    
    // Calculate proportions for each status
    const totalRemaining = Object.entries(statusBreakdown)
      .filter(([status]) => !['deferred', 'cancelled', 'done', 'completed'].includes(status))
      .reduce((sum, [_, val]) => sum + val, 0);
    
    // If no remaining tasks with tracked statuses, just use gray
    if (totalRemaining <= 0) {
      remainingSection = chalk.gray('░'.repeat(empty));
    } else {
      // Track how many characters we've added
      let addedChars = 0;
      
      // Add each status section proportionally
      for (const [status, percentage] of Object.entries(statusBreakdown)) {
        // Skip statuses that are considered complete
        if (['deferred', 'cancelled', 'done', 'completed'].includes(status)) continue;
        
        // Calculate how many characters this status should fill
        const statusChars = Math.round((percentage / totalRemaining) * empty);
        
        // Make sure we don't exceed the total length due to rounding
        const actualChars = Math.min(statusChars, empty - addedChars);
        
        // Add colored section for this status
        const colorFn = statusColors[status] || chalk.gray;
        remainingSection += colorFn('░'.repeat(actualChars));
        
        addedChars += actualChars;
      }
      
      // If we have any remaining space due to rounding, fill with gray
      if (addedChars < empty) {
        remainingSection += chalk.gray('░'.repeat(empty - addedChars));
      }
    }
  } else {
    // Default to gray for the empty section if no breakdown provided
    remainingSection = chalk.gray('░'.repeat(empty));
  }
  
  // Effective percentage text color should reflect the highest category
  const percentTextColor = percent === 100 ? 
    chalk.hex('#006400') : // Dark green for 100%
    (effectivePercent === 100 ? 
      chalk.gray : // Gray for 100% with deferred/cancelled
      completedColor); // Otherwise match the completed color
  
  // Build the complete progress bar
  return `${completedSection}${deferredCancelledSection}${remainingSection} ${percentTextColor(`${effectivePercent.toFixed(0)}%`)}`;
}

/**
 * Get a colored status string based on the status value
 * @param {string} status - Task status (e.g., "done", "pending", "in-progress")
 * @param {boolean} forTable - Whether the status is being displayed in a table
 * @returns {string} Colored status string
 */
function getStatusWithColor(status, forTable = false) {
  if (!status) {
    return chalk.gray('❓ unknown');
  }
  
  const statusConfig = {
    'done': { color: chalk.green, icon: '✅', tableIcon: '✓' },
    'completed': { color: chalk.green, icon: '✅', tableIcon: '✓' },
    'pending': { color: chalk.yellow, icon: '⏱️', tableIcon: '⏱' },
    'in-progress': { color: chalk.hex('#FFA500'), icon: '🔄', tableIcon: '►' },
    'deferred': { color: chalk.gray, icon: '⏱️', tableIcon: '⏱' },
    'blocked': { color: chalk.red, icon: '❌', tableIcon: '✗' },
    'review': { color: chalk.magenta, icon: '👀', tableIcon: '👁' },
    'cancelled': { color: chalk.gray, icon: '❌', tableIcon: '✗' }
  };
  
  const config = statusConfig[status.toLowerCase()] || { color: chalk.red, icon: '❌', tableIcon: '✗' };
  
  // Use simpler icons for table display to prevent border issues
  if (forTable) {
    // Use ASCII characters instead of Unicode for completely stable display
    const simpleIcons = {
      'done': '✓',
      'completed': '✓', 
      'pending': '○',
      'in-progress': '►',
      'deferred': 'x',
      'blocked': '!', // Using plain x character for better compatibility
      'review': '?' // Using circled dot symbol
    };
    const simpleIcon = simpleIcons[status.toLowerCase()] || 'x';
    return config.color(`${simpleIcon} ${status}`);
  }
  
  return config.color(`${config.icon} ${status}`);
}

/**
 * Format dependencies list with status indicators
 * @param {Array} dependencies - Array of dependency IDs
 * @param {Array} allTasks - Array of all tasks
 * @param {boolean} forConsole - Whether the output is for console display
 * @returns {string} Formatted dependencies string
 */
function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
    return forConsole ? chalk.gray('None') : 'None';
  }
  
  const formattedDeps = dependencies.map(depId => {
    const depIdStr = depId.toString(); // Ensure string format for display
    
    // Check if it's already a fully qualified subtask ID (like "22.1")
    if (depIdStr.includes('.')) {
      const [parentId, subtaskId] = depIdStr.split('.').map(id => parseInt(id, 10));
      
      // Find the parent task
      const parentTask = allTasks.find(t => t.id === parentId);
      if (!parentTask || !parentTask.subtasks) {
        return forConsole ? 
          chalk.red(`${depIdStr} (Not found)`) : 
          `${depIdStr} (Not found)`;
      }
      
      // Find the subtask
      const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
      if (!subtask) {
        return forConsole ? 
          chalk.red(`${depIdStr} (Not found)`) : 
          `${depIdStr} (Not found)`;
      }
      
      // Format with status
      const status = subtask.status || 'pending';
      const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
      const isInProgress = status.toLowerCase() === 'in-progress';
      
      if (forConsole) {
        if (isDone) {
          return chalk.green.bold(depIdStr);
        } else if (isInProgress) {
          return chalk.hex('#FFA500').bold(depIdStr);
        } else {
          return chalk.red.bold(depIdStr);
        }
      }
      
      // For plain text output (task files), return just the ID without any formatting or emoji
      return depIdStr;
    }
    
    // If depId is a number less than 100, it's likely a reference to a subtask ID in the current task
    // This case is typically handled elsewhere (in task-specific code) before calling this function
    
    // For regular task dependencies (not subtasks)
    // Convert string depId to number if needed
    const numericDepId = typeof depId === 'string' ? parseInt(depId, 10) : depId;
    
    // Look up the task using the numeric ID
    const depTask = findTaskById(allTasks, numericDepId);
    
    if (!depTask) {
      return forConsole ? 
        chalk.red(`${depIdStr} (Not found)`) : 
        `${depIdStr} (Not found)`;
    }
    
    // Format with status
    const status = depTask.status || 'pending';
    const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
    const isInProgress = status.toLowerCase() === 'in-progress';
    
    if (forConsole) {
      if (isDone) {
        return chalk.green.bold(depIdStr);
      } else if (isInProgress) {
        return chalk.yellow.bold(depIdStr);
      } else {
        return chalk.red.bold(depIdStr);
      }
    }
    
    // For plain text output (task files), return just the ID without any formatting or emoji
    return depIdStr;
  });
  
  return formattedDeps.join(', ');
}

/**
 * Display a comprehensive help guide
 */
function displayHelp() {
  displayBanner();
  
  console.log(boxen(
    chalk.white.bold('Task Master CLI'),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Command categories
  const commandCategories = [
    {
      title: 'Task Generation',
      color: 'cyan',
      commands: [
        { name: 'parse-prd', args: '--input=<file.txt> [--tasks=10]', 
          desc: 'Generate tasks from a PRD document' },
        { name: 'generate', args: '', 
          desc: 'Create individual task files from tasks.json' }
      ]
    },
    {
      title: 'Task Management',
      color: 'green',
      commands: [
        { name: 'list', args: '[--status=<status>] [--with-subtasks]', 
          desc: 'List all tasks with their status' },
        { name: 'set-status', args: '--id=<id> --status=<status>', 
          desc: 'Update task status (done, pending, etc.)' },
        { name: 'update', args: '--from=<id> --prompt="<context>"', 
          desc: 'Update tasks based on new requirements' },
        { name: 'add-task', args: '--prompt="<text>" [--dependencies=<ids>] [--priority=<priority>]',
          desc: 'Add a new task using AI' },
        { name: 'add-dependency', args: '--id=<id> --depends-on=<id>', 
          desc: 'Add a dependency to a task' },
        { name: 'remove-dependency', args: '--id=<id> --depends-on=<id>', 
          desc: 'Remove a dependency from a task' }
      ]
    },
    {
      title: 'Task Analysis & Detail',
      color: 'yellow',
      commands: [
        { name: 'analyze-complexity', args: '[--research] [--threshold=5]', 
          desc: 'Analyze tasks and generate expansion recommendations' },
        { name: 'complexity-report', args: '[--file=<path>]',
          desc: 'Display the complexity analysis report' },
        { name: 'expand', args: '--id=<id> [--num=5] [--research] [--prompt="<context>"]', 
          desc: 'Break down tasks into detailed subtasks' },
        { name: 'expand --all', args: '[--force] [--research]', 
          desc: 'Expand all pending tasks with subtasks' },
        { name: 'clear-subtasks', args: '--id=<id>', 
          desc: 'Remove subtasks from specified tasks' }
      ]
    },
    {
      title: 'Task Navigation & Viewing',
      color: 'magenta',
      commands: [
        { name: 'next', args: '', 
          desc: 'Show the next task to work on based on dependencies' },
        { name: 'show', args: '<id>', 
          desc: 'Display detailed information about a specific task' }
      ]
    },
    {
      title: 'Dependency Management',
      color: 'blue',
      commands: [
        { name: 'validate-dependencies', args: '', 
          desc: 'Identify invalid dependencies without fixing them' },
        { name: 'fix-dependencies', args: '', 
          desc: 'Fix invalid dependencies automatically' }
      ]
    }
  ];
  
  // Display each category
  commandCategories.forEach(category => {
    console.log(boxen(
      chalk[category.color].bold(category.title),
      { 
        padding: { left: 2, right: 2, top: 0, bottom: 0 }, 
        margin: { top: 1, bottom: 0 }, 
        borderColor: category.color, 
        borderStyle: 'round' 
      }
    ));
    
    const commandTable = new Table({
      colWidths: [25, 40, 45],
      chars: {
        'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
        'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
        'right': '', 'right-mid': '', 'middle': ' '
      },
      style: { border: [], 'padding-left': 4 }
    });
    
    category.commands.forEach((cmd, index) => {
      commandTable.push([
        `${chalk.yellow.bold(cmd.name)}${chalk.reset('')}`,
        `${chalk.white(cmd.args)}${chalk.reset('')}`,
        `${chalk.dim(cmd.desc)}${chalk.reset('')}`
      ]);
    });
    
    console.log(commandTable.toString());
    console.log('');
  });
  
  // Display environment variables section
  console.log(boxen(
    chalk.cyan.bold('Environment Variables'),
    { 
      padding: { left: 2, right: 2, top: 0, bottom: 0 }, 
      margin: { top: 1, bottom: 0 }, 
      borderColor: 'cyan', 
      borderStyle: 'round' 
    }
  ));
  
  const envTable = new Table({
    colWidths: [30, 50, 30],
    chars: {
      'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
      'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
      'right': '', 'right-mid': '', 'middle': ' '
    },
    style: { border: [], 'padding-left': 4 }
  });
  
  envTable.push(
    [`${chalk.yellow('ANTHROPIC_API_KEY')}${chalk.reset('')}`, 
     `${chalk.white('Your Anthropic API key')}${chalk.reset('')}`, 
     `${chalk.dim('Required')}${chalk.reset('')}`],
    [`${chalk.yellow('MODEL')}${chalk.reset('')}`, 
     `${chalk.white('Claude model to use')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.model}`)}${chalk.reset('')}`],
    [`${chalk.yellow('MAX_TOKENS')}${chalk.reset('')}`, 
     `${chalk.white('Maximum tokens for responses')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.maxTokens}`)}${chalk.reset('')}`],
    [`${chalk.yellow('TEMPERATURE')}${chalk.reset('')}`, 
     `${chalk.white('Temperature for model responses')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.temperature}`)}${chalk.reset('')}`],
    [`${chalk.yellow('PERPLEXITY_API_KEY')}${chalk.reset('')}`, 
     `${chalk.white('Perplexity API key for research')}${chalk.reset('')}`, 
     `${chalk.dim('Optional')}${chalk.reset('')}`],
    [`${chalk.yellow('PERPLEXITY_MODEL')}${chalk.reset('')}`, 
     `${chalk.white('Perplexity model to use')}${chalk.reset('')}`, 
     `${chalk.dim('Default: sonar-pro')}${chalk.reset('')}`],
    [`${chalk.yellow('DEBUG')}${chalk.reset('')}`, 
     `${chalk.white('Enable debug logging')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.debug}`)}${chalk.reset('')}`],
    [`${chalk.yellow('LOG_LEVEL')}${chalk.reset('')}`, 
     `${chalk.white('Console output level (debug,info,warn,error)')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.logLevel}`)}${chalk.reset('')}`],
    [`${chalk.yellow('DEFAULT_SUBTASKS')}${chalk.reset('')}`, 
     `${chalk.white('Default number of subtasks to generate')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.defaultSubtasks}`)}${chalk.reset('')}`],
    [`${chalk.yellow('DEFAULT_PRIORITY')}${chalk.reset('')}`, 
     `${chalk.white('Default task priority')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.defaultPriority}`)}${chalk.reset('')}`],
    [`${chalk.yellow('PROJECT_NAME')}${chalk.reset('')}`, 
     `${chalk.white('Project name displayed in UI')}${chalk.reset('')}`, 
     `${chalk.dim(`Default: ${CONFIG.projectName}`)}${chalk.reset('')}`]
  );
  
  console.log(envTable.toString());
  console.log('');
}

/**
 * Get colored complexity score
 * @param {number} score - Complexity score (1-10)
 * @returns {string} Colored complexity score
 */
function getComplexityWithColor(score) {
  if (score <= 3) return chalk.green(`🟢 ${score}`);
  if (score <= 6) return chalk.yellow(`🟡 ${score}`);
  return chalk.red(`🔴 ${score}`);
}

/**
 * Truncate a string to a maximum length and add ellipsis if needed
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Display the next task to work on
 * @param {string} tasksPath - Path to the tasks.json file
 */
async function displayNextTask(tasksPath) {
  displayBanner();
  
  // Read the tasks file
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }
  
  // Find the next task
  const nextTask = findNextTask(data.tasks);
  
  if (!nextTask) {
    console.log(boxen(
      chalk.yellow('No eligible tasks found!\n\n') +
      'All pending tasks have unsatisfied dependencies, or all tasks are completed.',
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    return;
  }
  
  // Display the task in a nice format
  console.log(boxen(
    chalk.white.bold(`Next Task: #${nextTask.id} - ${nextTask.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, Math.min(75, (process.stdout.columns - 20) || 60)],
    wordWrap: true
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[nextTask.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), nextTask.id.toString()],
    [chalk.cyan.bold('Title:'), nextTask.title],
    [chalk.cyan.bold('Priority:'), priorityColor(nextTask.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)],
    [chalk.cyan.bold('Description:'), nextTask.description]
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (nextTask.details && nextTask.details.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Implementation Details:') + '\n\n' + 
      nextTask.details,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (nextTask.subtasks && nextTask.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Calculate available width for the subtask table
    const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect
    
    // Define percentage-based column widths
    const idWidthPct = 8;
    const statusWidthPct = 15;
    const depsWidthPct = 25;
    const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;
    
    // Calculate actual column widths
    const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
    const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
    const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
    const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));
    
    // Create a table for subtasks with improved handling
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Title'),
        chalk.magenta.bold('Deps')
      ],
      colWidths: [idWidth, statusWidth, titleWidth, depsWidth],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      wordWrap: true
    });
    
    // Add subtasks to table
    nextTask.subtasks.forEach(st => {
      const statusColor = {
        'done': chalk.green,
        'completed': chalk.green,
        'pending': chalk.yellow,
        'in-progress': chalk.blue
      }[st.status || 'pending'] || chalk.white;
      
      // Format subtask dependencies
      let subtaskDeps = 'None';
      if (st.dependencies && st.dependencies.length > 0) {
        // Format dependencies with correct notation
        const formattedDeps = st.dependencies.map(depId => {
          if (typeof depId === 'number' && depId < 100) {
            const foundSubtask = nextTask.subtasks.find(st => st.id === depId);
            if (foundSubtask) {
              const isDone = foundSubtask.status === 'done' || foundSubtask.status === 'completed';
              const isInProgress = foundSubtask.status === 'in-progress';
              
              // Use consistent color formatting instead of emojis
              if (isDone) {
                return chalk.green.bold(`${nextTask.id}.${depId}`);
              } else if (isInProgress) {
                return chalk.hex('#FFA500').bold(`${nextTask.id}.${depId}`);
              } else {
                return chalk.red.bold(`${nextTask.id}.${depId}`);
              }
            }
            return chalk.red(`${nextTask.id}.${depId} (Not found)`);
          }
          return depId;
        });
        
        // Join the formatted dependencies directly instead of passing to formatDependenciesWithStatus again
        subtaskDeps = formattedDeps.length === 1 
          ? formattedDeps[0] 
          : formattedDeps.join(chalk.white(', '));
      }
      
      subtaskTable.push([
        `${nextTask.id}.${st.id}`,
        statusColor(st.status || 'pending'),
        st.title,
        subtaskDeps
      ]);
    });
    
    console.log(subtaskTable.toString());
  } else {
    // Suggest expanding if no subtasks
    console.log(boxen(
      chalk.yellow('No subtasks found. Consider breaking down this task:') + '\n' +
      chalk.white(`Run: ${chalk.cyan(`task-master expand --id=${nextTask.id}`)}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n' +
    `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
    `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=done`)}\n` +
    (nextTask.subtasks && nextTask.subtasks.length > 0 
      ? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${nextTask.id}.1 --status=done`)}`
      : `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${nextTask.id}`)}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Display a specific task by ID
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string|number} taskId - The ID of the task to display
 */
async function displayTaskById(tasksPath, taskId) {
  displayBanner();
  
  // Read the tasks file
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }
  
  // Find the task by ID
  const task = findTaskById(data.tasks, taskId);
  
  if (!task) {
    console.log(boxen(
      chalk.yellow(`Task with ID ${taskId} not found!`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    return;
  }
  
  // Handle subtask display specially
  if (task.isSubtask || task.parentTask) {
    console.log(boxen(
      chalk.white.bold(`Subtask: #${task.parentTask.id}.${task.id} - ${task.title}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'magenta', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
    
    // Create a table with subtask details
    const taskTable = new Table({
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      colWidths: [15, Math.min(75, (process.stdout.columns - 20) || 60)],
      wordWrap: true
    });
    
    // Add subtask details to table
    taskTable.push(
      [chalk.cyan.bold('ID:'), `${task.parentTask.id}.${task.id}`],
      [chalk.cyan.bold('Parent Task:'), `#${task.parentTask.id} - ${task.parentTask.title}`],
      [chalk.cyan.bold('Title:'), task.title],
      [chalk.cyan.bold('Status:'), getStatusWithColor(task.status || 'pending', true)],
      [chalk.cyan.bold('Description:'), task.description || 'No description provided.']
    );
    
    console.log(taskTable.toString());
    
    // Show details if they exist for subtasks
    if (task.details && task.details.trim().length > 0) {
      console.log(boxen(
        chalk.white.bold('Implementation Details:') + '\n\n' + 
        task.details,
        { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
      ));
    }
    
    // Show action suggestions for subtask
    console.log(boxen(
      chalk.white.bold('Suggested Actions:') + '\n' +
      `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.parentTask.id}.${task.id} --status=in-progress`)}\n` +
      `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${task.parentTask.id}.${task.id} --status=done`)}\n` +
      `${chalk.cyan('3.')} View parent task: ${chalk.yellow(`task-master show --id=${task.parentTask.id}`)}`,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    // Calculate and display subtask completion progress
    if (task.subtasks && task.subtasks.length > 0) {
      const totalSubtasks = task.subtasks.length;
      const completedSubtasks = task.subtasks.filter(st => 
        st.status === 'done' || st.status === 'completed'
      ).length;
      
      // Count other statuses for the subtasks
      const inProgressSubtasks = task.subtasks.filter(st => st.status === 'in-progress').length;
      const pendingSubtasks = task.subtasks.filter(st => st.status === 'pending').length;
      const blockedSubtasks = task.subtasks.filter(st => st.status === 'blocked').length;
      const deferredSubtasks = task.subtasks.filter(st => st.status === 'deferred').length;
      const cancelledSubtasks = task.subtasks.filter(st => st.status === 'cancelled').length;
      
      // Calculate status breakdown as percentages
      const statusBreakdown = {
        'in-progress': (inProgressSubtasks / totalSubtasks) * 100,
        'pending': (pendingSubtasks / totalSubtasks) * 100,
        'blocked': (blockedSubtasks / totalSubtasks) * 100,
        'deferred': (deferredSubtasks / totalSubtasks) * 100,
        'cancelled': (cancelledSubtasks / totalSubtasks) * 100
      };
      
      const completionPercentage = (completedSubtasks / totalSubtasks) * 100;
      
      // Calculate appropriate progress bar length based on terminal width
      // Subtract padding (2), borders (2), and the percentage text (~5)
      const availableWidth = process.stdout.columns || 80; // Default to 80 if can't detect
      const boxPadding = 2; // 1 on each side
      const boxBorders = 2; // 1 on each side
      const percentTextLength = 5; // ~5 chars for " 100%"
      // Reduce the length by adjusting the subtraction value from 20 to 35
      const progressBarLength = Math.max(20, Math.min(60, availableWidth - boxPadding - boxBorders - percentTextLength - 35)); // Min 20, Max 60
      
      // Status counts for display
      const statusCounts = 
        `${chalk.green('✓ Done:')} ${completedSubtasks}  ${chalk.hex('#FFA500')('► In Progress:')} ${inProgressSubtasks}  ${chalk.yellow('○ Pending:')} ${pendingSubtasks}\n` +
        `${chalk.red('! Blocked:')} ${blockedSubtasks}  ${chalk.gray('⏱ Deferred:')} ${deferredSubtasks}  ${chalk.gray('✗ Cancelled:')} ${cancelledSubtasks}`;
      
      console.log(boxen(
        chalk.white.bold('Subtask Progress:') + '\n\n' +
        `${chalk.cyan('Completed:')} ${completedSubtasks}/${totalSubtasks} (${completionPercentage.toFixed(1)}%)\n` +
        `${statusCounts}\n` +
        `${chalk.cyan('Progress:')} ${createProgressBar(completionPercentage, progressBarLength, statusBreakdown)}`,
        { 
          padding: { top: 0, bottom: 0, left: 1, right: 1 }, 
          borderColor: 'blue', 
          borderStyle: 'round', 
          margin: { top: 1, bottom: 0 },
          width: Math.min(availableWidth - 10, 100), // Add width constraint to limit the box width
          textAlignment: 'left'
        }
      ));
    }
    
    return;
  }
  
  // Display a regular task
  console.log(boxen(
    chalk.white.bold(`Task: #${task.id} - ${task.title}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
  ));
  
  // Create a table with task details with improved handling
  const taskTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [15, Math.min(75, (process.stdout.columns - 20) || 60)],
    wordWrap: true
  });
  
  // Priority with color
  const priorityColors = {
    'high': chalk.red.bold,
    'medium': chalk.yellow,
    'low': chalk.gray
  };
  const priorityColor = priorityColors[task.priority || 'medium'] || chalk.white;
  
  // Add task details to table
  taskTable.push(
    [chalk.cyan.bold('ID:'), task.id.toString()],
    [chalk.cyan.bold('Title:'), task.title],
    [chalk.cyan.bold('Status:'), getStatusWithColor(task.status || 'pending', true)],
    [chalk.cyan.bold('Priority:'), priorityColor(task.priority || 'medium')],
    [chalk.cyan.bold('Dependencies:'), formatDependenciesWithStatus(task.dependencies, data.tasks, true)],
    [chalk.cyan.bold('Description:'), task.description]
  );
  
  console.log(taskTable.toString());
  
  // If task has details, show them in a separate box
  if (task.details && task.details.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Implementation Details:') + '\n\n' + 
      task.details,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show test strategy if available
  if (task.testStrategy && task.testStrategy.trim().length > 0) {
    console.log(boxen(
      chalk.white.bold('Test Strategy:') + '\n\n' + 
      task.testStrategy,
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show subtasks if they exist
  if (task.subtasks && task.subtasks.length > 0) {
    console.log(boxen(
      chalk.white.bold('Subtasks'),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, margin: { top: 1, bottom: 0 }, borderColor: 'magenta', borderStyle: 'round' }
    ));
    
    // Calculate available width for the subtask table
    const availableWidth = process.stdout.columns - 10 || 100; // Default to 100 if can't detect
    
    // Define percentage-based column widths
    const idWidthPct = 10;
    const statusWidthPct = 15;
    const depsWidthPct = 25;
    const titleWidthPct = 100 - idWidthPct - statusWidthPct - depsWidthPct;
    
    // Calculate actual column widths
    const idWidth = Math.floor(availableWidth * (idWidthPct / 100));
    const statusWidth = Math.floor(availableWidth * (statusWidthPct / 100));
    const depsWidth = Math.floor(availableWidth * (depsWidthPct / 100));
    const titleWidth = Math.floor(availableWidth * (titleWidthPct / 100));
    
    // Create a table for subtasks with improved handling
    const subtaskTable = new Table({
      head: [
        chalk.magenta.bold('ID'), 
        chalk.magenta.bold('Status'), 
        chalk.magenta.bold('Title'),
        chalk.magenta.bold('Deps')
      ],
      colWidths: [idWidth, statusWidth, titleWidth, depsWidth],
      style: {
        head: [],
        border: [],
        'padding-top': 0,
        'padding-bottom': 0,
        compact: true
      },
      chars: {
        'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
      },
      wordWrap: true
    });
    
    // Add subtasks to table
    task.subtasks.forEach(st => {
      const statusColor = {
        'done': chalk.green,
        'completed': chalk.green,
        'pending': chalk.yellow,
        'in-progress': chalk.blue
      }[st.status || 'pending'] || chalk.white;
      
      // Format subtask dependencies
      let subtaskDeps = 'None';
      if (st.dependencies && st.dependencies.length > 0) {
        // Format dependencies with correct notation
        const formattedDeps = st.dependencies.map(depId => {
          if (typeof depId === 'number' && depId < 100) {
            const foundSubtask = task.subtasks.find(st => st.id === depId);
            if (foundSubtask) {
              const isDone = foundSubtask.status === 'done' || foundSubtask.status === 'completed';
              const isInProgress = foundSubtask.status === 'in-progress';
              
              // Use consistent color formatting instead of emojis
              if (isDone) {
                return chalk.green.bold(`${task.id}.${depId}`);
              } else if (isInProgress) {
                return chalk.hex('#FFA500').bold(`${task.id}.${depId}`);
              } else {
                return chalk.red.bold(`${task.id}.${depId}`);
              }
            }
            return chalk.red(`${task.id}.${depId} (Not found)`);
          }
          return depId;
        });
        
        // Join the formatted dependencies directly instead of passing to formatDependenciesWithStatus again
        subtaskDeps = formattedDeps.length === 1 
          ? formattedDeps[0] 
          : formattedDeps.join(chalk.white(', '));
      }
      
      subtaskTable.push([
        `${task.id}.${st.id}`,
        statusColor(st.status || 'pending'),
        st.title,
        subtaskDeps
      ]);
    });
    
    console.log(subtaskTable.toString());
    
    // Calculate and display subtask completion progress
    if (task.subtasks && task.subtasks.length > 0) {
      const totalSubtasks = task.subtasks.length;
      const completedSubtasks = task.subtasks.filter(st => 
        st.status === 'done' || st.status === 'completed'
      ).length;
      
      // Count other statuses for the subtasks
      const inProgressSubtasks = task.subtasks.filter(st => st.status === 'in-progress').length;
      const pendingSubtasks = task.subtasks.filter(st => st.status === 'pending').length;
      const blockedSubtasks = task.subtasks.filter(st => st.status === 'blocked').length;
      const deferredSubtasks = task.subtasks.filter(st => st.status === 'deferred').length;
      const cancelledSubtasks = task.subtasks.filter(st => st.status === 'cancelled').length;
      
      // Calculate status breakdown as percentages
      const statusBreakdown = {
        'in-progress': (inProgressSubtasks / totalSubtasks) * 100,
        'pending': (pendingSubtasks / totalSubtasks) * 100,
        'blocked': (blockedSubtasks / totalSubtasks) * 100,
        'deferred': (deferredSubtasks / totalSubtasks) * 100,
        'cancelled': (cancelledSubtasks / totalSubtasks) * 100
      };
      
      const completionPercentage = (completedSubtasks / totalSubtasks) * 100;
      
      // Calculate appropriate progress bar length based on terminal width
      // Subtract padding (2), borders (2), and the percentage text (~5)
      const availableWidth = process.stdout.columns || 80; // Default to 80 if can't detect
      const boxPadding = 2; // 1 on each side
      const boxBorders = 2; // 1 on each side
      const percentTextLength = 5; // ~5 chars for " 100%"
      // Reduce the length by adjusting the subtraction value from 20 to 35
      const progressBarLength = Math.max(20, Math.min(60, availableWidth - boxPadding - boxBorders - percentTextLength - 35)); // Min 20, Max 60
      
      // Status counts for display
      const statusCounts = 
        `${chalk.green('✓ Done:')} ${completedSubtasks}  ${chalk.hex('#FFA500')('► In Progress:')} ${inProgressSubtasks}  ${chalk.yellow('○ Pending:')} ${pendingSubtasks}\n` +
        `${chalk.red('! Blocked:')} ${blockedSubtasks}  ${chalk.gray('⏱ Deferred:')} ${deferredSubtasks}  ${chalk.gray('✗ Cancelled:')} ${cancelledSubtasks}`;
      
      console.log(boxen(
        chalk.white.bold('Subtask Progress:') + '\n\n' +
        `${chalk.cyan('Completed:')} ${completedSubtasks}/${totalSubtasks} (${completionPercentage.toFixed(1)}%)\n` +
        `${statusCounts}\n` +
        `${chalk.cyan('Progress:')} ${createProgressBar(completionPercentage, progressBarLength, statusBreakdown)}`,
        { 
          padding: { top: 0, bottom: 0, left: 1, right: 1 }, 
          borderColor: 'blue', 
          borderStyle: 'round', 
          margin: { top: 1, bottom: 0 },
          width: Math.min(availableWidth - 10, 100), // Add width constraint to limit the box width
          textAlignment: 'left'
        }
      ));
    }
  } else {
    // Suggest expanding if no subtasks
    console.log(boxen(
      chalk.yellow('No subtasks found. Consider breaking down this task:') + '\n' +
      chalk.white(`Run: ${chalk.cyan(`task-master expand --id=${task.id}`)}`),
      { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n' +
    `${chalk.cyan('1.')} Mark as in-progress: ${chalk.yellow(`task-master set-status --id=${task.id} --status=in-progress`)}\n` +
    `${chalk.cyan('2.')} Mark as done when completed: ${chalk.yellow(`task-master set-status --id=${task.id} --status=done`)}\n` +
    (task.subtasks && task.subtasks.length > 0 
      ? `${chalk.cyan('3.')} Update subtask status: ${chalk.yellow(`task-master set-status --id=${task.id}.1 --status=done`)}`
      : `${chalk.cyan('3.')} Break down into subtasks: ${chalk.yellow(`task-master expand --id=${task.id}`)}`),
    { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Display the complexity analysis report in a nice format
 * @param {string} reportPath - Path to the complexity report file
 */
async function displayComplexityReport(reportPath) {
  displayBanner();
  
  // Check if the report exists
  if (!fs.existsSync(reportPath)) {
    console.log(boxen(
      chalk.yellow(`No complexity report found at ${reportPath}\n\n`) +
      'Would you like to generate one now?',
      { padding: 1, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question(chalk.cyan('Generate complexity report? (y/n): '), resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      // Call the analyze-complexity command
      console.log(chalk.blue('Generating complexity report...'));
      await analyzeTaskComplexity({ 
        output: reportPath,
        research: false, // Default to no research for speed
        file: 'tasks/tasks.json'
      });
      // Read the newly generated report
      return displayComplexityReport(reportPath);
    } else {
      console.log(chalk.yellow('Report generation cancelled.'));
      return;
    }
  }
  
  // Read the report
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    log('error', `Error reading complexity report: ${error.message}`);
    return;
  }
  
  // Display report header
  console.log(boxen(
    chalk.white.bold('Task Complexity Analysis Report'),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Display metadata
  const metaTable = new Table({
    style: {
      head: [],
      border: [],
      'padding-top': 0,
      'padding-bottom': 0,
      compact: true
    },
    chars: {
      'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': ''
    },
    colWidths: [20, 50]
  });
  
  metaTable.push(
    [chalk.cyan.bold('Generated:'), new Date(report.meta.generatedAt).toLocaleString()],
    [chalk.cyan.bold('Tasks Analyzed:'), report.meta.tasksAnalyzed],
    [chalk.cyan.bold('Threshold Score:'), report.meta.thresholdScore],
    [chalk.cyan.bold('Project:'), report.meta.projectName],
    [chalk.cyan.bold('Research-backed:'), report.meta.usedResearch ? 'Yes' : 'No']
  );
  
  console.log(metaTable.toString());
  
  // Sort tasks by complexity score (highest first)
  const sortedTasks = [...report.complexityAnalysis].sort((a, b) => b.complexityScore - a.complexityScore);
  
  // Determine which tasks need expansion based on threshold
  const tasksNeedingExpansion = sortedTasks.filter(task => task.complexityScore >= report.meta.thresholdScore);
  const simpleTasks = sortedTasks.filter(task => task.complexityScore < report.meta.thresholdScore);
  
  // Create progress bar to show complexity distribution
  const complexityDistribution = [0, 0, 0]; // Low (0-4), Medium (5-7), High (8-10)
  sortedTasks.forEach(task => {
    if (task.complexityScore < 5) complexityDistribution[0]++;
    else if (task.complexityScore < 8) complexityDistribution[1]++;
    else complexityDistribution[2]++;
  });
  
  const percentLow = Math.round((complexityDistribution[0] / sortedTasks.length) * 100);
  const percentMedium = Math.round((complexityDistribution[1] / sortedTasks.length) * 100);
  const percentHigh = Math.round((complexityDistribution[2] / sortedTasks.length) * 100);
  
  console.log(boxen(
    chalk.white.bold('Complexity Distribution\n\n') +
    `${chalk.green.bold('Low (1-4):')} ${complexityDistribution[0]} tasks (${percentLow}%)\n` +
    `${chalk.yellow.bold('Medium (5-7):')} ${complexityDistribution[1]} tasks (${percentMedium}%)\n` +
    `${chalk.red.bold('High (8-10):')} ${complexityDistribution[2]} tasks (${percentHigh}%)`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Get terminal width
  const terminalWidth = process.stdout.columns || 100; // Default to 100 if can't detect

  // Calculate dynamic column widths
  const idWidth = 12;
  const titleWidth = Math.floor(terminalWidth * 0.25); // 25% of width
  const scoreWidth = 8;
  const subtasksWidth = 8;
  // Command column gets the remaining space (minus some buffer for borders)
  const commandWidth = terminalWidth - idWidth - titleWidth - scoreWidth - subtasksWidth - 10;

  // Create table with new column widths and word wrapping
  const complexTable = new Table({
    head: [
      chalk.yellow.bold('ID'), 
      chalk.yellow.bold('Title'), 
      chalk.yellow.bold('Score'),
      chalk.yellow.bold('Subtasks'),
      chalk.yellow.bold('Expansion Command')
    ],
    colWidths: [idWidth, titleWidth, scoreWidth, subtasksWidth, commandWidth],
    style: { head: [], border: [] },
    wordWrap: true,
    wrapOnWordBoundary: true
  });

  // When adding rows, don't truncate the expansion command
  tasksNeedingExpansion.forEach(task => {
    const expansionCommand = `task-master expand --id=${task.taskId} --num=${task.recommendedSubtasks}${task.expansionPrompt ? ` --prompt="${task.expansionPrompt}"` : ''}`;
    
    complexTable.push([
      task.taskId,
      truncate(task.taskTitle, titleWidth - 3), // Still truncate title for readability
      getComplexityWithColor(task.complexityScore),
      task.recommendedSubtasks,
      chalk.cyan(expansionCommand) // Don't truncate - allow wrapping
    ]);
  });
  
  console.log(complexTable.toString());
  
  // Create table for simple tasks
  if (simpleTasks.length > 0) {
    console.log(boxen(
      chalk.green.bold(`Simple Tasks (${simpleTasks.length})`),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'green', borderStyle: 'round' }
    ));
    
    const simpleTable = new Table({
      head: [
        chalk.green.bold('ID'), 
        chalk.green.bold('Title'), 
        chalk.green.bold('Score'),
        chalk.green.bold('Reasoning')
      ],
      colWidths: [5, 40, 8, 50],
      style: { head: [], border: [] }
    });
    
    simpleTasks.forEach(task => {
      simpleTable.push([
        task.taskId,
        truncate(task.taskTitle, 37),
        getComplexityWithColor(task.complexityScore),
        truncate(task.reasoning, 47)
      ]);
    });
    
    console.log(simpleTable.toString());
  }
  
  // Show action suggestions
  console.log(boxen(
    chalk.white.bold('Suggested Actions:') + '\n\n' +
    `${chalk.cyan('1.')} Expand all complex tasks: ${chalk.yellow(`task-master expand --all`)}\n` +
    `${chalk.cyan('2.')} Expand a specific task: ${chalk.yellow(`task-master expand --id=<id>`)}\n` +
    `${chalk.cyan('3.')} Regenerate with research: ${chalk.yellow(`task-master analyze-complexity --research`)}`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
  ));
}

/**
 * Confirm overwriting existing tasks.json file
 * @param {string} tasksPath - Path to the tasks.json file
 * @returns {Promise<boolean>} - Promise resolving to true if user confirms, false otherwise
 */
async function confirmTaskOverwrite(tasksPath) {
  console.log(boxen(
    chalk.yellow('It looks like you\'ve already generated tasks for this project.\n') +
    chalk.yellow('Executing this command will overwrite any existing tasks.'),
    { padding: 1, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
  ));
  
  // Use dynamic import to get the readline module
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise(resolve => {
    rl.question(chalk.cyan('Are you sure you wish to continue? (y/N): '), resolve);
  });
  rl.close();
  
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// Export UI functions
export {
  displayBanner,
  startLoadingIndicator,
  stopLoadingIndicator,
  createProgressBar,
  getStatusWithColor,
  formatDependenciesWithStatus,
  displayHelp,
  getComplexityWithColor,
  displayNextTask,
  displayTaskById,
  displayComplexityReport,
  confirmTaskOverwrite
}; 