/**
 * task-manager.js
 * Task management functions for the Task Master CLI
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import readline from 'readline';
import { Anthropic } from '@anthropic-ai/sdk';

import { 
  CONFIG, 
  log, 
  readJSON, 
  writeJSON, 
  sanitizePrompt,
  findTaskById,
  readComplexityReport,
  findTaskInComplexityReport,
  truncate
} from './utils.js';

import {
  displayBanner,
  getStatusWithColor,
  formatDependenciesWithStatus,
  getComplexityWithColor,
  startLoadingIndicator,
  stopLoadingIndicator,
  createProgressBar
} from './ui.js';

import {
  callClaude,
  generateSubtasks,
  generateSubtasksWithPerplexity,
  generateComplexityAnalysisPrompt
} from './ai-services.js';

import {
  validateTaskDependencies,
  validateAndFixDependencies
} from './dependency-manager.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Import perplexity if available
let perplexity;

try {
  if (process.env.PERPLEXITY_API_KEY) {
    // Using the existing approach from ai-services.js
    const OpenAI = (await import('openai')).default;
    
    perplexity = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY, 
      baseURL: 'https://api.perplexity.ai',
    });
    
    log('info', `Initialized Perplexity client with OpenAI compatibility layer`);
  }
} catch (error) {
  log('warn', `Failed to initialize Perplexity client: ${error.message}`);
  log('warn', 'Research-backed features will not be available');
}

/**
 * Parse a PRD file and generate tasks
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 */
async function parsePRD(prdPath, tasksPath, numTasks) {
  try {
    log('info', `Parsing PRD file: ${prdPath}`);
    
    // Read the PRD content
    const prdContent = fs.readFileSync(prdPath, 'utf8');
    
    // Call Claude to generate tasks
    const tasksData = await callClaude(prdContent, prdPath, numTasks);
    
    // Create the directory if it doesn't exist
    const tasksDir = path.dirname(tasksPath);
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    
    // Write the tasks to the file
    writeJSON(tasksPath, tasksData);
    
    log('success', `Successfully generated ${tasksData.tasks.length} tasks from PRD`);
    log('info', `Tasks saved to: ${tasksPath}`);
    
    // Generate individual task files
    await generateTaskFiles(tasksPath, tasksDir);
    
    console.log(boxen(
      chalk.green(`Successfully generated ${tasksData.tasks.length} tasks from PRD`),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ));
    
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
  } catch (error) {
    log('error', `Error parsing PRD: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Update tasks based on new context
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} fromId - Task ID to start updating from
 * @param {string} prompt - Prompt with new context
 * @param {boolean} useResearch - Whether to use Perplexity AI for research
 */
async function updateTasks(tasksPath, fromId, prompt, useResearch = false) {
  try {
    log('info', `Updating tasks from ID ${fromId} with prompt: "${prompt}"`);
    
    // Validate research flag
    if (useResearch && (!perplexity || !process.env.PERPLEXITY_API_KEY)) {
      log('warn', 'Perplexity AI is not available. Falling back to Claude AI.');
      console.log(chalk.yellow('Perplexity AI is not available (API key may be missing). Falling back to Claude AI.'));
      useResearch = false;
    }
    
    // Read the tasks file
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Find tasks to update (ID >= fromId and not 'done')
    const tasksToUpdate = data.tasks.filter(task => task.id >= fromId && task.status !== 'done');
    if (tasksToUpdate.length === 0) {
      log('info', `No tasks to update (all tasks with ID >= ${fromId} are already marked as done)`);
      console.log(chalk.yellow(`No tasks to update (all tasks with ID >= ${fromId} are already marked as done)`));
      return;
    }
    
    // Show the tasks that will be updated
    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Status')
      ],
      colWidths: [5, 60, 10]
    });
    
    tasksToUpdate.forEach(task => {
      table.push([
        task.id,
        truncate(task.title, 57),
        getStatusWithColor(task.status)
      ]);
    });
    
    console.log(boxen(
      chalk.white.bold(`Updating ${tasksToUpdate.length} tasks`),
      { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 0 } }
    ));
    
    console.log(table.toString());
    
    // Build the system prompt
    const systemPrompt = `You are an AI assistant helping to update software development tasks based on new context.
You will be given a set of tasks and a prompt describing changes or new implementation details.
Your job is to update the tasks to reflect these changes, while preserving their basic structure.

Guidelines:
1. Maintain the same IDs, statuses, and dependencies unless specifically mentioned in the prompt
2. Update titles, descriptions, details, and test strategies to reflect the new information
3. Do not change anything unnecessarily - just adapt what needs to change based on the prompt
4. You should return ALL the tasks in order, not just the modified ones
5. Return a complete valid JSON object with the updated tasks array

The changes described in the prompt should be applied to ALL tasks in the list.`;

    const taskData = JSON.stringify(tasksToUpdate, null, 2);
    
    let updatedTasks;
    const loadingIndicator = startLoadingIndicator(useResearch 
      ? 'Updating tasks with Perplexity AI research...' 
      : 'Updating tasks with Claude AI...');
    
    try {
      if (useResearch) {
        log('info', 'Using Perplexity AI for research-backed task updates');
        
        // Call Perplexity AI using format consistent with ai-services.js
        const perplexityModel = process.env.PERPLEXITY_MODEL || 'sonar-small-online';
        const result = await perplexity.chat.completions.create({
          model: perplexityModel,
          messages: [
            {
              role: "system", 
              content: `${systemPrompt}\n\nAdditionally, please research the latest best practices, implementation details, and considerations when updating these tasks. Use your online search capabilities to gather relevant information.`
            },
            {
              role: "user",
              content: `Here are the tasks to update:
${taskData}

Please update these tasks based on the following new context:
${prompt}

Return only the updated tasks as a valid JSON array.`
            }
          ],
          temperature: parseFloat(process.env.TEMPERATURE || CONFIG.temperature),
          max_tokens: parseInt(process.env.MAX_TOKENS || CONFIG.maxTokens),
        });
        
        const responseText = result.choices[0].message.content;
        
        // Extract JSON from response
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("Could not find valid JSON array in Perplexity's response");
        }
        
        const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
        updatedTasks = JSON.parse(jsonText);
      } else {
        // Call Claude to update the tasks
        const message = await anthropic.messages.create({
          model: CONFIG.model,
          max_tokens: CONFIG.maxTokens,
          temperature: CONFIG.temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Here are the tasks to update:
${taskData}

Please update these tasks based on the following new context:
${prompt}

Return only the updated tasks as a valid JSON array.`
            }
          ]
        });
        
        const responseText = message.content[0].text;
        
        // Extract JSON from response
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("Could not find valid JSON array in Claude's response");
        }
        
        const jsonText = responseText.substring(jsonStart, jsonEnd + 1);
        updatedTasks = JSON.parse(jsonText);
      }
      
      // Replace the tasks in the original data
      updatedTasks.forEach(updatedTask => {
        const index = data.tasks.findIndex(t => t.id === updatedTask.id);
        if (index !== -1) {
          data.tasks[index] = updatedTask;
        }
      });
      
      // Write the updated tasks to the file
      writeJSON(tasksPath, data);
      
      log('success', `Successfully updated ${updatedTasks.length} tasks`);
      
      // Generate individual task files
      await generateTaskFiles(tasksPath, path.dirname(tasksPath));
      
      console.log(boxen(
        chalk.green(`Successfully updated ${updatedTasks.length} tasks`),
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      ));
    } finally {
      stopLoadingIndicator(loadingIndicator);
    }
  } catch (error) {
    log('error', `Error updating tasks: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Generate individual task files from tasks.json
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} outputDir - Output directory for task files
 */
function generateTaskFiles(tasksPath, outputDir) {
  try {
    log('info', `Reading tasks from ${tasksPath}...`);
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Create the output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    log('info', `Found ${data.tasks.length} tasks to generate files for.`);
    
    // Validate and fix dependencies before generating files
    log('info', `Validating and fixing dependencies before generating files...`);
    validateAndFixDependencies(data, tasksPath);
    
    // Generate task files
    log('info', 'Generating individual task files...');
    data.tasks.forEach(task => {
      const taskPath = path.join(outputDir, `task_${task.id.toString().padStart(3, '0')}.txt`);
      
      // Format the content
      let content = `# Task ID: ${task.id}\n`;
      content += `# Title: ${task.title}\n`;
      content += `# Status: ${task.status || 'pending'}\n`;
      
      // Format dependencies with their status
      if (task.dependencies && task.dependencies.length > 0) {
        content += `# Dependencies: ${formatDependenciesWithStatus(task.dependencies, data.tasks)}\n`;
      } else {
        content += '# Dependencies: None\n';
      }
      
      content += `# Priority: ${task.priority || 'medium'}\n`;
      content += `# Description: ${task.description || ''}\n`;
      
      // Add more detailed sections
      content += '# Details:\n';
      content += (task.details || '').split('\n').map(line => line).join('\n');
      content += '\n\n';
      
      content += '# Test Strategy:\n';
      content += (task.testStrategy || '').split('\n').map(line => line).join('\n');
      content += '\n';
      
      // Add subtasks if they exist
      if (task.subtasks && task.subtasks.length > 0) {
        content += '\n# Subtasks:\n';
        
        task.subtasks.forEach(subtask => {
          content += `## ${subtask.id}. ${subtask.title} [${subtask.status || 'pending'}]\n`;
          
          if (subtask.dependencies && subtask.dependencies.length > 0) {
            // Format subtask dependencies
            let subtaskDeps = subtask.dependencies.map(depId => {
              if (typeof depId === 'number') {
                // Handle numeric dependencies to other subtasks
                const foundSubtask = task.subtasks.find(st => st.id === depId);
                if (foundSubtask) {
                  return `${depId} (${foundSubtask.status || 'pending'})`;
                }
              }
              return depId.toString();
            }).join(', ');
            
            content += `### Dependencies: ${subtaskDeps}\n`;
          } else {
            content += '### Dependencies: None\n';
          }
          
          content += `### Description: ${subtask.description || ''}\n`;
          content += '### Details:\n';
          content += (subtask.details || '').split('\n').map(line => line).join('\n');
          content += '\n\n';
        });
      }
      
      // Write the file
      fs.writeFileSync(taskPath, content);
      log('info', `Generated: task_${task.id.toString().padStart(3, '0')}.txt`);
    });
    
    log('success', `All ${data.tasks.length} tasks have been generated into '${outputDir}'.`);
  } catch (error) {
    log('error', `Error generating task files: ${error.message}`);
    console.error(chalk.red(`Error generating task files: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Set the status of a task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to update
 * @param {string} newStatus - New status
 */
async function setTaskStatus(tasksPath, taskIdInput, newStatus) {
  try {
    displayBanner();
    
    console.log(boxen(
      chalk.white.bold(`Updating Task Status to: ${newStatus}`),
      { padding: 1, borderColor: 'blue', borderStyle: 'round' }
    ));
    
    log('info', `Reading tasks from ${tasksPath}...`);
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Handle multiple task IDs (comma-separated)
    const taskIds = taskIdInput.split(',').map(id => id.trim());
    const updatedTasks = [];
    
    // Update each task
    for (const id of taskIds) {
      await updateSingleTaskStatus(tasksPath, id, newStatus, data);
      updatedTasks.push(id);
    }
    
    // Write the updated tasks to the file
    writeJSON(tasksPath, data);
    
    // Validate dependencies after status update
    log('info', 'Validating dependencies after status update...');
    validateTaskDependencies(data.tasks);
    
    // Generate individual task files
    log('info', 'Regenerating task files...');
    await generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Display success message
    for (const id of updatedTasks) {
      const task = findTaskById(data.tasks, id);
      const taskName = task ? task.title : id;
      
      console.log(boxen(
        chalk.white.bold(`Successfully updated task ${id} status:`) + '\n' +
        `From: ${chalk.yellow(task ? task.status : 'unknown')}\n` +
        `To:   ${chalk.green(newStatus)}`,
        { padding: 1, borderColor: 'green', borderStyle: 'round' }
      ));
    }
  } catch (error) {
    log('error', `Error setting task status: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Update the status of a single task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID to update
 * @param {string} newStatus - New status
 * @param {Object} data - Tasks data
 */
async function updateSingleTaskStatus(tasksPath, taskIdInput, newStatus, data) {
  // Check if it's a subtask (e.g., "1.2")
  if (taskIdInput.includes('.')) {
    const [parentId, subtaskId] = taskIdInput.split('.').map(id => parseInt(id, 10));
    
    // Find the parent task
    const parentTask = data.tasks.find(t => t.id === parentId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentId} not found`);
    }
    
    // Find the subtask
    if (!parentTask.subtasks) {
      throw new Error(`Parent task ${parentId} has no subtasks`);
    }
    
    const subtask = parentTask.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask ${subtaskId} not found in parent task ${parentId}`);
    }
    
    // Update the subtask status
    const oldStatus = subtask.status || 'pending';
    subtask.status = newStatus;
    
    log('info', `Updated subtask ${parentId}.${subtaskId} status from '${oldStatus}' to '${newStatus}'`);
    
    // Check if all subtasks are done (if setting to 'done')
    if (newStatus.toLowerCase() === 'done' || newStatus.toLowerCase() === 'completed') {
      const allSubtasksDone = parentTask.subtasks.every(st => 
        st.status === 'done' || st.status === 'completed');
      
      // Suggest updating parent task if all subtasks are done
      if (allSubtasksDone && parentTask.status !== 'done' && parentTask.status !== 'completed') {
        console.log(chalk.yellow(`All subtasks of parent task ${parentId} are now marked as done.`));
        console.log(chalk.yellow(`Consider updating the parent task status with: task-master set-status --id=${parentId} --status=done`));
      }
    }
  } else {
    // Handle regular task
    const taskId = parseInt(taskIdInput, 10);
    const task = data.tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Update the task status
    const oldStatus = task.status || 'pending';
    task.status = newStatus;
    
    log('info', `Updated task ${taskId} status from '${oldStatus}' to '${newStatus}'`);
    
    // If marking as done, also mark all subtasks as done
    if ((newStatus.toLowerCase() === 'done' || newStatus.toLowerCase() === 'completed') && 
        task.subtasks && task.subtasks.length > 0) {
      
      const pendingSubtasks = task.subtasks.filter(st => 
        st.status !== 'done' && st.status !== 'completed');
      
      if (pendingSubtasks.length > 0) {
        log('info', `Also marking ${pendingSubtasks.length} subtasks as '${newStatus}'`);
        
        pendingSubtasks.forEach(subtask => {
          subtask.status = newStatus;
        });
      }
    }
  }
}

/**
 * List all tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} statusFilter - Filter by status
 * @param {boolean} withSubtasks - Whether to show subtasks
 */
function listTasks(tasksPath, statusFilter, withSubtasks = false) {
  try {
    displayBanner();
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Filter tasks by status if specified
    const filteredTasks = statusFilter 
      ? data.tasks.filter(task => 
          task.status && task.status.toLowerCase() === statusFilter.toLowerCase())
      : data.tasks;
    
    // Calculate completion statistics
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(task => 
      task.status === 'done' || task.status === 'completed').length;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    // Count statuses
    const doneCount = completedTasks;
    const inProgressCount = data.tasks.filter(task => task.status === 'in-progress').length;
    const pendingCount = data.tasks.filter(task => task.status === 'pending').length;
    const blockedCount = data.tasks.filter(task => task.status === 'blocked').length;
    const deferredCount = data.tasks.filter(task => task.status === 'deferred').length;
    
    // Count subtasks
    let totalSubtasks = 0;
    let completedSubtasks = 0;
    
    data.tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        totalSubtasks += task.subtasks.length;
        completedSubtasks += task.subtasks.filter(st => 
          st.status === 'done' || st.status === 'completed').length;
      }
    });
    
    const subtaskCompletionPercentage = totalSubtasks > 0 ? 
      (completedSubtasks / totalSubtasks) * 100 : 0;
      
    // Create progress bars
    const taskProgressBar = createProgressBar(completionPercentage, 30);
    const subtaskProgressBar = createProgressBar(subtaskCompletionPercentage, 30);
    
    // Calculate dependency statistics
    const completedTaskIds = new Set(data.tasks.filter(t => 
      t.status === 'done' || t.status === 'completed').map(t => t.id));
      
    const tasksWithNoDeps = data.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'completed' && 
      (!t.dependencies || t.dependencies.length === 0)).length;
      
    const tasksWithAllDepsSatisfied = data.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'completed' && 
      t.dependencies && 
      t.dependencies.length > 0 && 
      t.dependencies.every(depId => completedTaskIds.has(depId))).length;
      
    const tasksWithUnsatisfiedDeps = data.tasks.filter(t => 
      t.status !== 'done' && 
      t.status !== 'completed' && 
      t.dependencies && 
      t.dependencies.length > 0 && 
      !t.dependencies.every(depId => completedTaskIds.has(depId))).length;
    
    // Calculate total tasks ready to work on (no deps + satisfied deps)
    const tasksReadyToWork = tasksWithNoDeps + tasksWithAllDepsSatisfied;
    
    // Calculate most depended-on tasks
    const dependencyCount = {};
    data.tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach(depId => {
          dependencyCount[depId] = (dependencyCount[depId] || 0) + 1;
        });
      }
    });
    
    // Find the most depended-on task
    let mostDependedOnTaskId = null;
    let maxDependents = 0;
    
    for (const [taskId, count] of Object.entries(dependencyCount)) {
      if (count > maxDependents) {
        maxDependents = count;
        mostDependedOnTaskId = parseInt(taskId);
      }
    }
    
    // Get the most depended-on task
    const mostDependedOnTask = mostDependedOnTaskId !== null 
      ? data.tasks.find(t => t.id === mostDependedOnTaskId) 
      : null;
    
    // Calculate average dependencies per task
    const totalDependencies = data.tasks.reduce((sum, task) => 
      sum + (task.dependencies ? task.dependencies.length : 0), 0);
    const avgDependenciesPerTask = totalDependencies / data.tasks.length;
    
    // Find next task to work on
    const nextTask = findNextTask(data.tasks);
    const nextTaskInfo = nextTask ? 
      `ID: ${chalk.cyan(nextTask.id)} - ${chalk.white.bold(truncate(nextTask.title, 40))}\n` +
      `Priority: ${chalk.white(nextTask.priority || 'medium')}  Dependencies: ${formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)}` : 
      chalk.yellow('No eligible tasks found. All tasks are either completed or have unsatisfied dependencies.');
    
    // Get terminal width
    const terminalWidth = process.stdout.columns || 80;
    
    // Create dashboard content
    const projectDashboardContent = 
      chalk.white.bold('Project Dashboard') + '\n' +
      `Tasks Progress: ${chalk.greenBright(taskProgressBar)} ${completionPercentage.toFixed(0)}%\n` +
      `Done: ${chalk.green(doneCount)}  In Progress: ${chalk.blue(inProgressCount)}  Pending: ${chalk.yellow(pendingCount)}  Blocked: ${chalk.red(blockedCount)}  Deferred: ${chalk.gray(deferredCount)}\n\n` +
      `Subtasks Progress: ${chalk.cyan(subtaskProgressBar)} ${subtaskCompletionPercentage.toFixed(0)}%\n` +
      `Completed: ${chalk.green(completedSubtasks)}/${totalSubtasks}  Remaining: ${chalk.yellow(totalSubtasks - completedSubtasks)}\n\n` +
      chalk.cyan.bold('Priority Breakdown:') + '\n' +
      `${chalk.red('•')} ${chalk.white('High priority:')} ${data.tasks.filter(t => t.priority === 'high').length}\n` +
      `${chalk.yellow('•')} ${chalk.white('Medium priority:')} ${data.tasks.filter(t => t.priority === 'medium').length}\n` +
      `${chalk.green('•')} ${chalk.white('Low priority:')} ${data.tasks.filter(t => t.priority === 'low').length}`;
    
    const dependencyDashboardContent =  
      chalk.white.bold('Dependency Status & Next Task') + '\n' +
      chalk.cyan.bold('Dependency Metrics:') + '\n' +
      `${chalk.green('•')} ${chalk.white('Tasks with no dependencies:')} ${tasksWithNoDeps}\n` +
      `${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${tasksReadyToWork}\n` +
      `${chalk.yellow('•')} ${chalk.white('Tasks blocked by dependencies:')} ${tasksWithUnsatisfiedDeps}\n` +
      `${chalk.magenta('•')} ${chalk.white('Most depended-on task:')} ${mostDependedOnTask ? chalk.cyan(`#${mostDependedOnTaskId} (${maxDependents} dependents)`) : chalk.gray('None')}\n` +
      `${chalk.blue('•')} ${chalk.white('Avg dependencies per task:')} ${avgDependenciesPerTask.toFixed(1)}\n\n` +
      chalk.cyan.bold('Next Task to Work On:') + '\n' +
      `ID: ${chalk.cyan(nextTask ? nextTask.id : 'N/A')} - ${nextTask ? chalk.white.bold(truncate(nextTask.title, 40)) : chalk.yellow('No task available')}\n` +
      `Priority: ${nextTask ? chalk.white(nextTask.priority || 'medium') : ''}  Dependencies: ${nextTask ? formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true) : ''}`;
    
    // Calculate width for side-by-side display
    // Box borders, padding take approximately 4 chars on each side
    const minDashboardWidth = 50; // Minimum width for dashboard
    const minDependencyWidth = 50; // Minimum width for dependency dashboard
    const totalMinWidth = minDashboardWidth + minDependencyWidth + 4; // Extra 4 chars for spacing
    
    // If terminal is wide enough, show boxes side by side with responsive widths
    if (terminalWidth >= totalMinWidth) {
      // Calculate widths proportionally for each box - use exact 50% width each
      const availableWidth = terminalWidth;
      const halfWidth = Math.floor(availableWidth / 2);
      
      // Account for border characters (2 chars on each side)
      const boxContentWidth = halfWidth - 4;
      
      // Create boxen options with precise widths
      const dashboardBox = boxen(
        projectDashboardContent,
        { 
          padding: 1, 
          borderColor: 'blue', 
          borderStyle: 'round', 
          width: boxContentWidth,
          dimBorder: false
        }
      );
      
      const dependencyBox = boxen(
        dependencyDashboardContent,
        { 
          padding: 1, 
          borderColor: 'magenta', 
          borderStyle: 'round', 
          width: boxContentWidth,
          dimBorder: false
        }
      );
      
      // Create a better side-by-side layout with exact spacing
      const dashboardLines = dashboardBox.split('\n');
      const dependencyLines = dependencyBox.split('\n');
      
      // Make sure both boxes have the same height
      const maxHeight = Math.max(dashboardLines.length, dependencyLines.length);
      
      // For each line of output, pad the dashboard line to exactly halfWidth chars
      // This ensures the dependency box starts at exactly the right position
      const combinedLines = [];
      for (let i = 0; i < maxHeight; i++) {
        // Get the dashboard line (or empty string if we've run out of lines)
        const dashLine = i < dashboardLines.length ? dashboardLines[i] : '';
        // Get the dependency line (or empty string if we've run out of lines)
        const depLine = i < dependencyLines.length ? dependencyLines[i] : '';
        
        // Remove any trailing spaces from dashLine before padding to exact width
        const trimmedDashLine = dashLine.trimEnd();
        // Pad the dashboard line to exactly halfWidth chars with no extra spaces
        const paddedDashLine = trimmedDashLine.padEnd(halfWidth, ' ');
        
        // Join the lines with no space in between
        combinedLines.push(paddedDashLine + depLine);
      }
      
      // Join all lines and output
      console.log(combinedLines.join('\n'));
    } else {
      // Terminal too narrow, show boxes stacked vertically
      const dashboardBox = boxen(
        projectDashboardContent,
        { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 0, bottom: 1 } }
      );
      
      const dependencyBox = boxen(
        dependencyDashboardContent,
        { padding: 1, borderColor: 'magenta', borderStyle: 'round', margin: { top: 0, bottom: 1 } }
      );
      
      // Display stacked vertically
      console.log(dashboardBox);
      console.log(dependencyBox);
    }
    
    if (filteredTasks.length === 0) {
      console.log(boxen(
        statusFilter 
          ? chalk.yellow(`No tasks with status '${statusFilter}' found`) 
          : chalk.yellow('No tasks found'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      return;
    }
    
    // Use the previously defined terminalWidth for responsive table
    
    // Define column widths based on percentage of available space
    // Reserve minimum widths for ID, Status, Priority and Dependencies
    const minIdWidth = 4;
    const minStatusWidth = 12;
    const minPriorityWidth = 8;
    const minDepsWidth = 15;
    
    // Calculate available space for the title column
    const minFixedColumnsWidth = minIdWidth + minStatusWidth + minPriorityWidth + minDepsWidth;
    const tableMargin = 10; // Account for table borders and padding
    const availableTitleWidth = Math.max(30, terminalWidth - minFixedColumnsWidth - tableMargin);
    
    // Scale column widths proportionally
    const colWidths = [
      minIdWidth,
      availableTitleWidth,
      minStatusWidth,
      minPriorityWidth,
      minDepsWidth
    ];
    
    // Create a table for tasks
    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Priority'),
        chalk.cyan.bold('Dependencies')
      ],
      colWidths: colWidths,
      wordWrap: true
    });
    
    // Add tasks to the table
    filteredTasks.forEach(task => {
      // Get a list of task dependencies
      const formattedDeps = formatDependenciesWithStatus(task.dependencies, data.tasks, true);
      
      table.push([
        task.id,
        truncate(task.title, availableTitleWidth - 3), // -3 for table cell padding
        getStatusWithColor(task.status),
        chalk.white(task.priority || 'medium'),
        formattedDeps
      ]);
      
      // Add subtasks if requested
      if (withSubtasks && task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(subtask => {
          // Format subtask dependencies
          let subtaskDeps = '';
          
          if (subtask.dependencies && subtask.dependencies.length > 0) {
            subtaskDeps = subtask.dependencies.map(depId => {
              // Check if it's a dependency on another subtask
              const foundSubtask = task.subtasks.find(st => st.id === depId);
              
              if (foundSubtask) {
                const isDone = foundSubtask.status === 'done' || foundSubtask.status === 'completed';
                const statusIcon = isDone ? 
                  chalk.green('✅') : 
                  chalk.yellow('⏱️');
                
                return `${statusIcon} ${chalk.cyan(`${task.id}.${depId}`)}`;
              }
              
              return chalk.cyan(depId.toString());
            }).join(', ');
          } else {
            subtaskDeps = chalk.gray('None');
          }
          
          table.push([
            `${task.id}.${subtask.id}`,
            chalk.dim(`└─ ${truncate(subtask.title, availableTitleWidth - 5)}`), // -5 for the "└─ " prefix
            getStatusWithColor(subtask.status),
            chalk.dim('-'),
            subtaskDeps
          ]);
        });
      }
    });
    
    console.log(table.toString());
    
    // Show filter info if applied
    if (statusFilter) {
      console.log(chalk.yellow(`\nFiltered by status: ${statusFilter}`));
      console.log(chalk.yellow(`Showing ${filteredTasks.length} of ${totalTasks} tasks`));
    }
    
    // Define priority colors
    const priorityColors = {
      'high': chalk.red.bold,
      'medium': chalk.yellow,
      'low': chalk.gray
    };
    
    // Show next task box in a prominent color
    if (nextTask) {
      // Prepare subtasks section if they exist
      let subtasksSection = '';
      if (nextTask.subtasks && nextTask.subtasks.length > 0) {
        subtasksSection = `\n\n${chalk.white.bold('Subtasks:')}\n`;
        subtasksSection += nextTask.subtasks.map(subtask => {
          const subtaskStatus = getStatusWithColor(subtask.status || 'pending');
          return `${chalk.cyan(`${nextTask.id}.${subtask.id}`)} ${subtaskStatus} ${subtask.title}`;
        }).join('\n');
      }
      
      console.log(boxen(
        chalk.hex('#FF8800').bold(`🔥 Next Task to Work On: #${nextTask.id} - ${nextTask.title}`) + '\n\n' +
        `${chalk.white('Priority:')} ${priorityColors[nextTask.priority || 'medium'](nextTask.priority || 'medium')}   ${chalk.white('Status:')} ${getStatusWithColor(nextTask.status)}\n` +
        `${chalk.white('Dependencies:')} ${formatDependenciesWithStatus(nextTask.dependencies, data.tasks, true)}\n\n` +
        `${chalk.white('Description:')} ${nextTask.description}` +
        subtasksSection + '\n\n' +
        `${chalk.cyan('Start working:')} ${chalk.yellow(`task-master set-status --id=${nextTask.id} --status=in-progress`)}\n` +
        `${chalk.cyan('View details:')} ${chalk.yellow(`task-master show ${nextTask.id}`)}`,
        { 
          padding: 1, 
          borderColor: '#FF8800', 
          borderStyle: 'round', 
          margin: { top: 1, bottom: 1 },
          title: '⚡ RECOMMENDED NEXT ACTION ⚡',
          titleAlignment: 'center',
          width: terminalWidth - 4, // Use full terminal width minus a small margin
          fullscreen: false // Keep it expandable but not literally fullscreen
        }
      ));
    } else {
      console.log(boxen(
        chalk.hex('#FF8800').bold('No eligible next task found') + '\n\n' +
        'All pending tasks have dependencies that are not yet completed, or all tasks are done.',
        { 
          padding: 1, 
          borderColor: '#FF8800', 
          borderStyle: 'round', 
          margin: { top: 1, bottom: 1 },
          title: '⚡ NEXT ACTION ⚡',
          titleAlignment: 'center',
          width: terminalWidth - 4, // Use full terminal width minus a small margin
        }
      ));
    }
    
    // Show next steps
    console.log(boxen(
      chalk.white.bold('Suggested Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('task-master next')} to see what to work on next\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks\n` +
      `${chalk.cyan('3.')} Run ${chalk.yellow('task-master set-status --id=<id> --status=done')} to mark a task as complete`,
      { padding: 1, borderColor: 'gray', borderStyle: 'round', margin: { top: 1 } }
    ));
  } catch (error) {
    log('error', `Error listing tasks: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Expand a task with subtasks
 * @param {number} taskId - Task ID to expand
 * @param {number} numSubtasks - Number of subtasks to generate
 * @param {boolean} useResearch - Whether to use research (Perplexity)
 * @param {string} additionalContext - Additional context
 */
async function expandTask(taskId, numSubtasks = CONFIG.defaultSubtasks, useResearch = false, additionalContext = '') {
  try {
    displayBanner();
    
    // Load tasks
    const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
    log('info', `Loading tasks from ${tasksPath}...`);
    
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Find the task
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Check if the task is already completed
    if (task.status === 'done' || task.status === 'completed') {
      log('warn', `Task ${taskId} is already marked as "${task.status}". Skipping expansion.`);
      console.log(chalk.yellow(`Task ${taskId} is already marked as "${task.status}". Skipping expansion.`));
      return;
    }
    
    // Check for complexity report
    log('info', 'Checking for complexity analysis...');
    const complexityReport = readComplexityReport();
    let taskAnalysis = null;
    
    if (complexityReport) {
      taskAnalysis = findTaskInComplexityReport(complexityReport, taskId);
      
      if (taskAnalysis) {
        log('info', `Found complexity analysis for task ${taskId}: Score ${taskAnalysis.complexityScore}/10`);
        
        // Use recommended number of subtasks if available and not overridden
        if (taskAnalysis.recommendedSubtasks && numSubtasks === CONFIG.defaultSubtasks) {
          numSubtasks = taskAnalysis.recommendedSubtasks;
          log('info', `Using recommended number of subtasks: ${numSubtasks}`);
        }
        
        // Use expansion prompt from analysis as additional context if available
        if (taskAnalysis.expansionPrompt && !additionalContext) {
          additionalContext = taskAnalysis.expansionPrompt;
          log('info', 'Using expansion prompt from complexity analysis');
        }
      } else {
        log('info', `No complexity analysis found for task ${taskId}`);
      }
    }
    
    console.log(boxen(
      chalk.white.bold(`Expanding Task: #${taskId} - ${task.title}`),
      { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 0, bottom: 1 } }
    ));
    
    // Check if the task already has subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      log('warn', `Task ${taskId} already has ${task.subtasks.length} subtasks. Appending new subtasks.`);
      console.log(chalk.yellow(`Task ${taskId} already has ${task.subtasks.length} subtasks. New subtasks will be appended.`));
    }
    
    // Initialize subtasks array if it doesn't exist
    if (!task.subtasks) {
      task.subtasks = [];
    }
    
    // Determine the next subtask ID
    const nextSubtaskId = task.subtasks.length > 0 ? 
      Math.max(...task.subtasks.map(st => st.id)) + 1 : 1;
    
    // Generate subtasks
    let subtasks;
    if (useResearch) {
      log('info', 'Using Perplexity AI for research-backed subtask generation');
      subtasks = await generateSubtasksWithPerplexity(task, numSubtasks, nextSubtaskId, additionalContext);
    } else {
      log('info', 'Generating subtasks with Claude only');
      subtasks = await generateSubtasks(task, numSubtasks, nextSubtaskId, additionalContext);
    }
    
    // Add the subtasks to the task
    task.subtasks = [...task.subtasks, ...subtasks];
    
    // Write the updated tasks to the file
    writeJSON(tasksPath, data);
    
    // Generate individual task files
    await generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Display success message
    console.log(boxen(
      chalk.green(`Successfully added ${subtasks.length} subtasks to task ${taskId}`),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ));
    
    // Show the subtasks table
    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Dependencies'),
        chalk.cyan.bold('Status')
      ],
      colWidths: [8, 50, 15, 15]
    });
    
    subtasks.forEach(subtask => {
      const deps = subtask.dependencies && subtask.dependencies.length > 0 ? 
        subtask.dependencies.map(d => `${taskId}.${d}`).join(', ') : 
        chalk.gray('None');
      
      table.push([
        `${taskId}.${subtask.id}`,
        truncate(subtask.title, 47),
        deps,
        getStatusWithColor(subtask.status)
      ]);
    });
    
    console.log(table.toString());
    
    // Show next steps
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow(`task-master show ${taskId}`)} to see the full task with subtasks\n` +
      `${chalk.cyan('2.')} Start working on subtask: ${chalk.yellow(`task-master set-status --id=${taskId}.1 --status=in-progress`)}\n` +
      `${chalk.cyan('3.')} Mark subtask as done: ${chalk.yellow(`task-master set-status --id=${taskId}.1 --status=done`)}`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
  } catch (error) {
    log('error', `Error expanding task: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Expand all pending tasks with subtasks
 * @param {number} numSubtasks - Number of subtasks per task
 * @param {boolean} useResearch - Whether to use research (Perplexity)
 * @param {string} additionalContext - Additional context
 * @param {boolean} forceFlag - Force regeneration for tasks with subtasks
 */
async function expandAllTasks(numSubtasks = CONFIG.defaultSubtasks, useResearch = false, additionalContext = '', forceFlag = false) {
  try {
    displayBanner();
    
    // Load tasks
    const tasksPath = path.join(process.cwd(), 'tasks', 'tasks.json');
    log('info', `Loading tasks from ${tasksPath}...`);
    
    const data = readJSON(tasksPath);
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Get complexity report if it exists
    log('info', 'Checking for complexity analysis...');
    const complexityReport = readComplexityReport();
    
    // Filter tasks that are not done and don't have subtasks (unless forced)
    const pendingTasks = data.tasks.filter(task => 
      task.status !== 'done' && 
      task.status !== 'completed' && 
      (forceFlag || !task.subtasks || task.subtasks.length === 0)
    );
    
    if (pendingTasks.length === 0) {
      log('info', 'No pending tasks found to expand');
      console.log(boxen(
        chalk.yellow('No pending tasks found to expand'),
        { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
      ));
      return;
    }
    
    // Sort tasks by complexity if report exists, otherwise by ID
    let tasksToExpand = [...pendingTasks];
    
    if (complexityReport && complexityReport.complexityAnalysis) {
      log('info', 'Sorting tasks by complexity...');
      
      // Create a map of task IDs to complexity scores
      const complexityMap = new Map();
      complexityReport.complexityAnalysis.forEach(analysis => {
        complexityMap.set(analysis.taskId, analysis.complexityScore);
      });
      
      // Sort tasks by complexity score (high to low)
      tasksToExpand.sort((a, b) => {
        const scoreA = complexityMap.get(a.id) || 0;
        const scoreB = complexityMap.get(b.id) || 0;
        return scoreB - scoreA;
      });
    } else {
      // Sort by ID if no complexity report
      tasksToExpand.sort((a, b) => a.id - b.id);
    }
    
    console.log(boxen(
      chalk.white.bold(`Expanding ${tasksToExpand.length} Pending Tasks`),
      { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 0, bottom: 1 } }
    ));
    
    // Show tasks to be expanded
    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Complexity')
      ],
      colWidths: [5, 50, 15, 15]
    });
    
    tasksToExpand.forEach(task => {
      const taskAnalysis = complexityReport ? 
        findTaskInComplexityReport(complexityReport, task.id) : null;
      
      const complexity = taskAnalysis ? 
        getComplexityWithColor(taskAnalysis.complexityScore) + '/10' : 
        chalk.gray('Unknown');
      
      table.push([
        task.id,
        truncate(task.title, 47),
        getStatusWithColor(task.status),
        complexity
      ]);
    });
    
    console.log(table.toString());
    
    // Confirm expansion
    console.log(chalk.yellow(`\nThis will expand ${tasksToExpand.length} tasks with ${numSubtasks} subtasks each.`));
    console.log(chalk.yellow(`Research-backed generation: ${useResearch ? 'Yes' : 'No'}`));
    console.log(chalk.yellow(`Force regeneration: ${forceFlag ? 'Yes' : 'No'}`));
    
    // Expand each task
    let expandedCount = 0;
    for (const task of tasksToExpand) {
      try {
        log('info', `Expanding task ${task.id}: ${task.title}`);
        
        // Get task-specific parameters from complexity report
        let taskSubtasks = numSubtasks;
        let taskContext = additionalContext;
        
        if (complexityReport) {
          const taskAnalysis = findTaskInComplexityReport(complexityReport, task.id);
          if (taskAnalysis) {
            // Use recommended subtasks if default wasn't overridden
            if (taskAnalysis.recommendedSubtasks && numSubtasks === CONFIG.defaultSubtasks) {
              taskSubtasks = taskAnalysis.recommendedSubtasks;
              log('info', `Using recommended subtasks for task ${task.id}: ${taskSubtasks}`);
            }
            
            // Add expansion prompt if no user context was provided
            if (taskAnalysis.expansionPrompt && !additionalContext) {
              taskContext = taskAnalysis.expansionPrompt;
              log('info', `Using complexity analysis prompt for task ${task.id}`);
            }
          }
        }
        
        // Check if the task already has subtasks
        if (task.subtasks && task.subtasks.length > 0) {
          if (forceFlag) {
            log('info', `Task ${task.id} already has ${task.subtasks.length} subtasks. Clearing them due to --force flag.`);
            task.subtasks = []; // Clear existing subtasks
          } else {
            log('warn', `Task ${task.id} already has subtasks. Skipping (use --force to regenerate).`);
            continue;
          }
        }
        
        // Initialize subtasks array if it doesn't exist
        if (!task.subtasks) {
          task.subtasks = [];
        }
        
        // Determine the next subtask ID
        const nextSubtaskId = task.subtasks.length > 0 ? 
          Math.max(...task.subtasks.map(st => st.id)) + 1 : 1;
        
        // Generate subtasks
        let subtasks;
        if (useResearch) {
          subtasks = await generateSubtasksWithPerplexity(task, taskSubtasks, nextSubtaskId, taskContext);
        } else {
          subtasks = await generateSubtasks(task, taskSubtasks, nextSubtaskId, taskContext);
        }
        
        // Add the subtasks to the task
        task.subtasks = [...task.subtasks, ...subtasks];
        expandedCount++;
      } catch (error) {
        log('error', `Error expanding task ${task.id}: ${error.message}`);
        console.error(chalk.red(`Error expanding task ${task.id}: ${error.message}`));
        continue;
      }
    }
    
    // Write the updated tasks to the file
    writeJSON(tasksPath, data);
    
    // Generate individual task files
    await generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Display success message
    console.log(boxen(
      chalk.green(`Successfully expanded ${expandedCount} of ${tasksToExpand.length} tasks`),
      { padding: 1, borderColor: 'green', borderStyle: 'round' }
    ));
    
    // Show next steps
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('task-master list --with-subtasks')} to see all tasks with subtasks\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('task-master next')} to see what to work on next`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
  } catch (error) {
    log('error', `Error expanding tasks: ${error.message}`);
    console.error(chalk.red(`Error: ${error.message}`));
    
    if (CONFIG.debug) {
      console.error(error);
    }
    
    process.exit(1);
  }
}

/**
 * Clear subtasks from specified tasks
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIds - Task IDs to clear subtasks from
 */
function clearSubtasks(tasksPath, taskIds) {
  displayBanner();
  
  log('info', `Reading tasks from ${tasksPath}...`);
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "No valid tasks found.");
    process.exit(1);
  }

  console.log(boxen(
    chalk.white.bold('Clearing Subtasks'), 
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));

  // Handle multiple task IDs (comma-separated)
  const taskIdArray = taskIds.split(',').map(id => id.trim());
  let clearedCount = 0;
  
  // Create a summary table for the cleared subtasks
  const summaryTable = new Table({
    head: [
      chalk.cyan.bold('Task ID'), 
      chalk.cyan.bold('Task Title'), 
      chalk.cyan.bold('Subtasks Cleared')
    ],
    colWidths: [10, 50, 20],
    style: { head: [], border: [] }
  });

  taskIdArray.forEach(taskId => {
    const id = parseInt(taskId, 10);
    if (isNaN(id)) {
      log('error', `Invalid task ID: ${taskId}`);
      return;
    }

    const task = data.tasks.find(t => t.id === id);
    if (!task) {
      log('error', `Task ${id} not found`);
      return;
    }

    if (!task.subtasks || task.subtasks.length === 0) {
      log('info', `Task ${id} has no subtasks to clear`);
      summaryTable.push([
        id.toString(),
        truncate(task.title, 47),
        chalk.yellow('No subtasks')
      ]);
      return;
    }

    const subtaskCount = task.subtasks.length;
    task.subtasks = [];
    clearedCount++;
    log('info', `Cleared ${subtaskCount} subtasks from task ${id}`);
    
    summaryTable.push([
      id.toString(),
      truncate(task.title, 47),
      chalk.green(`${subtaskCount} subtasks cleared`)
    ]);
  });

  if (clearedCount > 0) {
    writeJSON(tasksPath, data);
    
    // Show summary table
    console.log(boxen(
      chalk.white.bold('Subtask Clearing Summary:'),
      { padding: { left: 2, right: 2, top: 0, bottom: 0 }, margin: { top: 1, bottom: 0 }, borderColor: 'blue', borderStyle: 'round' }
    ));
    console.log(summaryTable.toString());
    
    // Regenerate task files to reflect changes
    log('info', "Regenerating task files...");
    generateTaskFiles(tasksPath, path.dirname(tasksPath));
    
    // Success message
    console.log(boxen(
      chalk.green(`Successfully cleared subtasks from ${chalk.bold(clearedCount)} task(s)`),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    // Next steps suggestion
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('task-master expand --id=<id>')} to generate new subtasks\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('task-master list --with-subtasks')} to verify changes`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
    
  } else {
    console.log(boxen(
      chalk.yellow('No subtasks were cleared'),
      { padding: 1, borderColor: 'yellow', borderStyle: 'round', margin: { top: 1 } }
    ));
  }
}

/**
 * Add a new task using AI
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} prompt - Description of the task to add
 * @param {Array} dependencies - Task dependencies
 * @param {string} priority - Task priority
 * @returns {number} The new task ID
 */
async function addTask(tasksPath, prompt, dependencies = [], priority = 'medium') {
  // Handle placeholder API key case
  if (process.env.ANTHROPIC_API_KEY === 'placeholder-api-key') {
    const data = readJSON(tasksPath) || { tasks: [] };
    const newTaskId = data.tasks.length > 0 ? Math.max(...data.tasks.map(t => t.id)) + 1 : 1;
    
    const newTask = {
      id: newTaskId,
      title: prompt,
      description: prompt,
      status: 'pending',
      priority: priority,
      dependencies: dependencies,
      createdAt: new Date().toISOString()
    };
    
    data.tasks.push(newTask);
    writeJSON(tasksPath, data);
    return newTaskId;
  }

  // Normal AI-powered processing

  // Normal AI-powered task creation
  displayBanner();
  
  // Read the existing tasks
  const data = readJSON(tasksPath);
  if (!data || !data.tasks) {
    log('error', "Invalid or missing tasks.json.");
    process.exit(1);
  }
  
  // Find the highest task ID to determine the next ID
  const highestId = data.tasks.length > 0 ? Math.max(...data.tasks.map(t => t.id)) : 0;
  const newTaskId = highestId + 1;
    const newTask = {
      id: newTaskId,
      title: prompt,
      description: prompt,
      status: 'pending',
      priority: priority,
      dependencies: dependencies,
      createdAt: new Date().toISOString()
    };
    data.tasks.push(newTask);
    writeJSON(tasksPath, data);
    log('success', `Created task #${newTaskId} (placeholder mode)`);
    return newTaskId;
  }
  
  console.log(boxen(
    chalk.white.bold(`Creating New Task #${newTaskId}`),
    { padding: 1, borderColor: 'blue', borderStyle: 'round', margin: { top: 1, bottom: 1 } }
  ));
  
  // Validate dependencies before proceeding
  const invalidDeps = dependencies.filter(depId => {
    return !data.tasks.some(t => t.id === depId);
  });
  
  if (invalidDeps.length > 0) {
    log('warn', `The following dependencies do not exist: ${invalidDeps.join(', ')}`);
    log('info', 'Removing invalid dependencies...');
    dependencies = dependencies.filter(depId => !invalidDeps.includes(depId));
  }
  
  // Create the system prompt for Claude
  const systemPrompt = "You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description.";
  
  // Create the user prompt with context from existing tasks
  let contextTasks = '';
  if (dependencies.length > 0) {
    // Provide context for the dependent tasks
    const dependentTasks = data.tasks.filter(t => dependencies.includes(t.id));
    contextTasks = `\nThis task depends on the following tasks:\n${dependentTasks.map(t => 
      `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;
  } else {
    // Provide a few recent tasks as context
    const recentTasks = [...data.tasks].sort((a, b) => b.id - a.id).slice(0, 3);
    contextTasks = `\nRecent tasks in the project:\n${recentTasks.map(t => 
      `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;
  }
  
  const taskStructure = `
  {
    "title": "Task title goes here",
    "description": "A concise one or two sentence description of what the task involves",
    "details": "In-depth details including specifics on implementation, considerations, and anything important for the developer to know. This should be detailed enough to guide implementation.",
    "testStrategy": "A detailed approach for verifying the task has been correctly implemented. Include specific test cases or validation methods."
  }`;
  
  const userPrompt = `Create a comprehensive new task (Task #${newTaskId}) for a software development project based on this description: "${prompt}"
  
  ${contextTasks}
  
  Return your answer as a single JSON object with the following structure:
  ${taskStructure}
  
  Don't include the task ID, status, dependencies, or priority as those will be added automatically.
  Make sure the details and test strategy are thorough and specific.
  
  IMPORTANT: Return ONLY the JSON object, nothing else.`;
  
  // Start the loading indicator
  const loadingIndicator = startLoadingIndicator('Generating new task with Claude AI...');
  
  let fullResponse = '';
  let streamingInterval = null;

  try {
    // Call Claude with streaming enabled
    const stream = await anthropic.messages.create({
      max_tokens: CONFIG.maxTokens,
      model: CONFIG.model,
      temperature: CONFIG.temperature,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
      stream: true
    });
    
    // Update loading indicator to show streaming progress
    let dotCount = 0;
    streamingInterval = setInterval(() => {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
      dotCount = (dotCount + 1) % 4;
    }, 500);
    
    // Process the stream
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.text) {
        fullResponse += chunk.delta.text;
      }
    }
    
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    
    log('info', "Completed streaming response from Claude API!");
    log('debug', `Streaming response length: ${fullResponse.length} characters`);
    
    // Parse the response - handle potential JSON formatting issues
    let taskData;
    try {
      // Check if the response is wrapped in a code block
      const jsonMatch = fullResponse.match(/```(?:json)?([^`]+)```/);
      const jsonContent = jsonMatch ? jsonMatch[1] : fullResponse;
      
      // Parse the JSON
      taskData = JSON.parse(jsonContent);
      
      // Check that we have the required fields
      if (!taskData.title || !taskData.description) {
        throw new Error("Missing required fields in the generated task");
      }
    } catch (error) {
      log('error', "Failed to parse Claude's response as valid task JSON:", error);
      log('debug', "Response content:", fullResponse);
      process.exit(1);
    }
    
    // Create the new task object
    const newTask = {
      id: newTaskId,
      title: taskData.title,
      description: taskData.description,
      status: "pending",
      dependencies: dependencies,
      priority: priority,
      details: taskData.details || "",
      testStrategy: taskData.testStrategy || "Manually verify the implementation works as expected."
    };
    
    // Add the new task to the tasks array
    data.tasks.push(newTask);
    
    // Validate dependencies in the entire task set
    log('info', "Validating dependencies after adding new task...");
    validateAndFixDependencies(data, null);
    
    // Write the updated tasks back to the file
    writeJSON(tasksPath, data);
    
    // Show success message
    const successBox = boxen(
      chalk.green(`Successfully added new task #${newTaskId}:\n`) +
      chalk.white.bold(newTask.title) + "\n\n" +
      chalk.white(newTask.description),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    );
    console.log(successBox);
    
    // Next steps suggestion
    console.log(boxen(
      chalk.white.bold('Next Steps:') + '\n\n' +
      `${chalk.cyan('1.')} Run ${chalk.yellow('task-master generate')} to update task files\n` +
      `${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=' + newTaskId)} to break it down into subtasks\n` +
      `${chalk.cyan('3.')} Run ${chalk.yellow('task-master list --with-subtasks')} to see all tasks`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    return newTaskId;
  } catch (error) {
    if (streamingInterval) clearInterval(streamingInterval);
    stopLoadingIndicator(loadingIndicator);
    log('error', "Error generating task:", error.message);
    process.exit(1);
  }
}

/**
 * Analyzes task complexity and generates expansion recommendations
 * @param {Object} options Command options
 */
async function analyzeTaskComplexity(options) {
  const tasksPath = options.file || 'tasks/tasks.json';
  const outputPath = options.output || 'scripts/task-complexity-report.json';
  const modelOverride = options.model;
  const thresholdScore = parseFloat(options.threshold || '5');
  const useResearch = options.research || false;
  
  console.log(chalk.blue(`Analyzing task complexity and generating expansion recommendations...`));
  
  try {
    // Read tasks.json
    console.log(chalk.blue(`Reading tasks from ${tasksPath}...`));
    const tasksData = readJSON(tasksPath);
    
    if (!tasksData || !tasksData.tasks || !Array.isArray(tasksData.tasks) || tasksData.tasks.length === 0) {
      throw new Error('No tasks found in the tasks file');
    }
    
    console.log(chalk.blue(`Found ${tasksData.tasks.length} tasks to analyze.`));
    
    // Prepare the prompt for the LLM
    const prompt = generateComplexityAnalysisPrompt(tasksData);
    
    // Start loading indicator
    const loadingIndicator = startLoadingIndicator('Calling AI to analyze task complexity...');
    
    let fullResponse = '';
    let streamingInterval = null;
    
    try {
      // If research flag is set, use Perplexity first
      if (useResearch) {
        try {
          console.log(chalk.blue('Using Perplexity AI for research-backed complexity analysis...'));
          
          // Modify prompt to include more context for Perplexity and explicitly request JSON
          const researchPrompt = `You are conducting a detailed analysis of software development tasks to determine their complexity and how they should be broken down into subtasks.

Please research each task thoroughly, considering best practices, industry standards, and potential implementation challenges before providing your analysis.

CRITICAL: You MUST respond ONLY with a valid JSON array. Do not include ANY explanatory text, markdown formatting, or code block markers.

${prompt}

Your response must be a clean JSON array only, following exactly this format:
[
  {
    "taskId": 1,
    "taskTitle": "Example Task",
    "complexityScore": 7,
    "recommendedSubtasks": 4,
    "expansionPrompt": "Detailed prompt for expansion",
    "reasoning": "Explanation of complexity assessment"
  },
  // more tasks...
]

DO NOT include any text before or after the JSON array. No explanations, no markdown formatting.`;
          
          const result = await perplexity.chat.completions.create({
            model: PERPLEXITY_MODEL,
            messages: [
              {
                role: "system", 
                content: "You are a technical analysis AI that only responds with clean, valid JSON. Never include explanatory text or markdown formatting in your response."
              },
              {
                role: "user",
                content: researchPrompt
              }
            ],
            temperature: TEMPERATURE,
            max_tokens: MAX_TOKENS,
          });
          
          // Extract the response text
          fullResponse = result.choices[0].message.content;
          console.log(chalk.green('Successfully generated complexity analysis with Perplexity AI'));
          
          if (streamingInterval) clearInterval(streamingInterval);
          stopLoadingIndicator(loadingIndicator);
          
          // ALWAYS log the first part of the response for debugging
          console.log(chalk.gray('Response first 200 chars:'));
          console.log(chalk.gray(fullResponse.substring(0, 200)));
        } catch (perplexityError) {
          console.log(chalk.yellow('Falling back to Claude for complexity analysis...'));
          console.log(chalk.gray('Perplexity error:'), perplexityError.message);
          
          // Continue to Claude as fallback
          await useClaudeForComplexityAnalysis();
        }
      } else {
        // Use Claude directly if research flag is not set
        await useClaudeForComplexityAnalysis();
      }
      
      // Helper function to use Claude for complexity analysis
      async function useClaudeForComplexityAnalysis() {
        // Call the LLM API with streaming
        const stream = await anthropic.messages.create({
          max_tokens: CONFIG.maxTokens,
          model: modelOverride || CONFIG.model,
          temperature: CONFIG.temperature,
          messages: [{ role: "user", content: prompt }],
          system: "You are an expert software architect and project manager analyzing task complexity. Respond only with valid JSON.",
          stream: true
        });
        
        // Update loading indicator to show streaming progress
        let dotCount = 0;
        streamingInterval = setInterval(() => {
          readline.cursorTo(process.stdout, 0);
          process.stdout.write(`Receiving streaming response from Claude${'.'.repeat(dotCount)}`);
          dotCount = (dotCount + 1) % 4;
        }, 500);
        
        // Process the stream
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.text) {
            fullResponse += chunk.delta.text;
          }
        }
        
        clearInterval(streamingInterval);
        stopLoadingIndicator(loadingIndicator);
        
        console.log(chalk.green("Completed streaming response from Claude API!"));
      }
      
      // Parse the JSON response
      console.log(chalk.blue(`Parsing complexity analysis...`));
      let complexityAnalysis;
      try {
        // Clean up the response to ensure it's valid JSON
        let cleanedResponse = fullResponse;
        
        // First check for JSON code blocks (common in markdown responses)
        const codeBlockMatch = fullResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          cleanedResponse = codeBlockMatch[1];
          console.log(chalk.blue("Extracted JSON from code block"));
        } else {
          // Look for a complete JSON array pattern
          // This regex looks for an array of objects starting with [ and ending with ]
          const jsonArrayMatch = fullResponse.match(/(\[\s*\{\s*"[^"]*"\s*:[\s\S]*\}\s*\])/);
          if (jsonArrayMatch) {
            cleanedResponse = jsonArrayMatch[1];
            console.log(chalk.blue("Extracted JSON array pattern"));
          } else {
            // Try to find the start of a JSON array and capture to the end
            const jsonStartMatch = fullResponse.match(/(\[\s*\{[\s\S]*)/);
            if (jsonStartMatch) {
              cleanedResponse = jsonStartMatch[1];
              // Try to find a proper closing to the array
              const properEndMatch = cleanedResponse.match(/([\s\S]*\}\s*\])/);
              if (properEndMatch) {
                cleanedResponse = properEndMatch[1];
              }
              console.log(chalk.blue("Extracted JSON from start of array to end"));
            }
          }
        }
        
        // Log the cleaned response for debugging
        console.log(chalk.gray("Attempting to parse cleaned JSON..."));
        console.log(chalk.gray("Cleaned response (first 100 chars):"));
        console.log(chalk.gray(cleanedResponse.substring(0, 100)));
        console.log(chalk.gray("Last 100 chars:"));
        console.log(chalk.gray(cleanedResponse.substring(cleanedResponse.length - 100)));
        
        // More aggressive cleaning - strip any non-JSON content at the beginning or end
        const strictArrayMatch = cleanedResponse.match(/(\[\s*\{[\s\S]*\}\s*\])/);
        if (strictArrayMatch) {
          cleanedResponse = strictArrayMatch[1];
          console.log(chalk.blue("Applied strict JSON array extraction"));
        }
        
        try {
          complexityAnalysis = JSON.parse(cleanedResponse);
        } catch (jsonError) {
          console.log(chalk.yellow("Initial JSON parsing failed, attempting to fix common JSON issues..."));
          
          // Try to fix common JSON issues
          // 1. Remove any trailing commas in arrays or objects
          cleanedResponse = cleanedResponse.replace(/,(\s*[\]}])/g, '$1');
          
          // 2. Ensure property names are double-quoted
          cleanedResponse = cleanedResponse.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
          
          // 3. Replace single quotes with double quotes for property values
          cleanedResponse = cleanedResponse.replace(/:(\s*)'([^']*)'(\s*[,}])/g, ':$1"$2"$3');
          
          // 4. Add a special fallback option if we're still having issues
          try {
            complexityAnalysis = JSON.parse(cleanedResponse);
            console.log(chalk.green("Successfully parsed JSON after fixing common issues"));
          } catch (fixedJsonError) {
            console.log(chalk.red("Failed to parse JSON even after fixes, attempting more aggressive cleanup..."));
            
            // Try to extract and process each task individually
            try {
              const taskMatches = cleanedResponse.match(/\{\s*"taskId"\s*:\s*(\d+)[^}]*\}/g);
              if (taskMatches && taskMatches.length > 0) {
                console.log(chalk.yellow(`Found ${taskMatches.length} task objects, attempting to process individually`));
                
                complexityAnalysis = [];
                for (const taskMatch of taskMatches) {
                  try {
                    // Try to parse each task object individually
                    const fixedTask = taskMatch.replace(/,\s*$/, ''); // Remove trailing commas
                    const taskObj = JSON.parse(`${fixedTask}`);
                    if (taskObj && taskObj.taskId) {
                      complexityAnalysis.push(taskObj);
                    }
                  } catch (taskParseError) {
                    console.log(chalk.yellow(`Could not parse individual task: ${taskMatch.substring(0, 30)}...`));
                  }
                }
                
                if (complexityAnalysis.length > 0) {
                  console.log(chalk.green(`Successfully parsed ${complexityAnalysis.length} tasks individually`));
                } else {
                  throw new Error("Could not parse any tasks individually");
                }
              } else {
                throw fixedJsonError;
              }
            } catch (individualError) {
              console.log(chalk.red("All parsing attempts failed"));
              throw jsonError; // throw the original error
            }
          }
        }
        
        // Ensure complexityAnalysis is an array
        if (!Array.isArray(complexityAnalysis)) {
          console.log(chalk.yellow('Response is not an array, checking if it contains an array property...'));
          
          // Handle the case where the response might be an object with an array property
          if (complexityAnalysis.tasks || complexityAnalysis.analysis || complexityAnalysis.results) {
            complexityAnalysis = complexityAnalysis.tasks || complexityAnalysis.analysis || complexityAnalysis.results;
          } else {
            // If no recognizable array property, wrap it as an array if it's an object
            if (typeof complexityAnalysis === 'object' && complexityAnalysis !== null) {
              console.log(chalk.yellow('Converting object to array...'));
              complexityAnalysis = [complexityAnalysis];
            } else {
              throw new Error('Response does not contain a valid array or object');
            }
          }
        }
        
        // Final check to ensure we have an array
        if (!Array.isArray(complexityAnalysis)) {
          throw new Error('Failed to extract an array from the response');
        }
        
        // Check that we have an analysis for each task in the input file
        const taskIds = tasksData.tasks.map(t => t.id);
        const analysisTaskIds = complexityAnalysis.map(a => a.taskId);
        const missingTaskIds = taskIds.filter(id => !analysisTaskIds.includes(id));

        if (missingTaskIds.length > 0) {
          console.log(chalk.yellow(`Missing analysis for ${missingTaskIds.length} tasks: ${missingTaskIds.join(', ')}`));
          console.log(chalk.blue(`Attempting to analyze missing tasks...`));
          
          // Create a subset of tasksData with just the missing tasks
          const missingTasks = {
            meta: tasksData.meta,
            tasks: tasksData.tasks.filter(t => missingTaskIds.includes(t.id))
          };
          
          // Generate a prompt for just the missing tasks
          const missingTasksPrompt = generateComplexityAnalysisPrompt(missingTasks);
          
          // Call the same AI model to analyze the missing tasks
          let missingAnalysisResponse = '';
          
          try {
            // Start a new loading indicator
            const missingTasksLoadingIndicator = startLoadingIndicator('Analyzing missing tasks...');
            
            // Use the same AI model as the original analysis
            if (useResearch) {
              // Create the same research prompt but for missing tasks
              const missingTasksResearchPrompt = `You are conducting a detailed analysis of software development tasks to determine their complexity and how they should be broken down into subtasks.

Please research each task thoroughly, considering best practices, industry standards, and potential implementation challenges before providing your analysis.

CRITICAL: You MUST respond ONLY with a valid JSON array. Do not include ANY explanatory text, markdown formatting, or code block markers.

${missingTasksPrompt}

Your response must be a clean JSON array only, following exactly this format:
[
  {
    "taskId": 1,
    "taskTitle": "Example Task",
    "complexityScore": 7,
    "recommendedSubtasks": 4,
    "expansionPrompt": "Detailed prompt for expansion",
    "reasoning": "Explanation of complexity assessment"
  },
  // more tasks...
]

DO NOT include any text before or after the JSON array. No explanations, no markdown formatting.`;

              const result = await perplexity.chat.completions.create({
                model: PERPLEXITY_MODEL,
                messages: [
                  {
                    role: "system", 
                    content: "You are a technical analysis AI that only responds with clean, valid JSON. Never include explanatory text or markdown formatting in your response."
                  },
                  {
                    role: "user",
                    content: missingTasksResearchPrompt
                  }
                ],
                temperature: TEMPERATURE,
                max_tokens: MAX_TOKENS,
              });
              
              // Extract the response
              missingAnalysisResponse = result.choices[0].message.content;
            } else {
              // Use Claude
              const stream = await anthropic.messages.create({
                max_tokens: CONFIG.maxTokens,
                model: modelOverride || CONFIG.model,
                temperature: CONFIG.temperature,
                messages: [{ role: "user", content: missingTasksPrompt }],
                system: "You are an expert software architect and project manager analyzing task complexity. Respond only with valid JSON.",
                stream: true
              });
              
              // Process the stream
              for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.text) {
                  missingAnalysisResponse += chunk.delta.text;
                }
              }
            }
            
            // Stop the loading indicator
            stopLoadingIndicator(missingTasksLoadingIndicator);
            
            // Parse the response using the same parsing logic as before
            let missingAnalysis;
            try {
              // Clean up the response to ensure it's valid JSON (using same logic as above)
              let cleanedResponse = missingAnalysisResponse;
              
              // Use the same JSON extraction logic as before
              // ... (code omitted for brevity, it would be the same as the original parsing)
              
              // First check for JSON code blocks
              const codeBlockMatch = missingAnalysisResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (codeBlockMatch) {
                cleanedResponse = codeBlockMatch[1];
                console.log(chalk.blue("Extracted JSON from code block for missing tasks"));
              } else {
                // Look for a complete JSON array pattern
                const jsonArrayMatch = missingAnalysisResponse.match(/(\[\s*\{\s*"[^"]*"\s*:[\s\S]*\}\s*\])/);
                if (jsonArrayMatch) {
                  cleanedResponse = jsonArrayMatch[1];
                  console.log(chalk.blue("Extracted JSON array pattern for missing tasks"));
                } else {
                  // Try to find the start of a JSON array and capture to the end
                  const jsonStartMatch = missingAnalysisResponse.match(/(\[\s*\{[\s\S]*)/);
                  if (jsonStartMatch) {
                    cleanedResponse = jsonStartMatch[1];
                    // Try to find a proper closing to the array
                    const properEndMatch = cleanedResponse.match(/([\s\S]*\}\s*\])/);
                    if (properEndMatch) {
                      cleanedResponse = properEndMatch[1];
                    }
                    console.log(chalk.blue("Extracted JSON from start of array to end for missing tasks"));
                  }
                }
              }
              
              // More aggressive cleaning if needed
              const strictArrayMatch = cleanedResponse.match(/(\[\s*\{[\s\S]*\}\s*\])/);
              if (strictArrayMatch) {
                cleanedResponse = strictArrayMatch[1];
                console.log(chalk.blue("Applied strict JSON array extraction for missing tasks"));
              }
              
              try {
                missingAnalysis = JSON.parse(cleanedResponse);
              } catch (jsonError) {
                // Try to fix common JSON issues (same as before)
                cleanedResponse = cleanedResponse.replace(/,(\s*[\]}])/g, '$1');
                cleanedResponse = cleanedResponse.replace(/(\s*)(\w+)(\s*):(\s*)/g, '$1"$2"$3:$4');
                cleanedResponse = cleanedResponse.replace(/:(\s*)'([^']*)'(\s*[,}])/g, ':$1"$2"$3');
                
                try {
                  missingAnalysis = JSON.parse(cleanedResponse);
                  console.log(chalk.green("Successfully parsed JSON for missing tasks after fixing common issues"));
                } catch (fixedJsonError) {
                  // Try the individual task extraction as a last resort
                  console.log(chalk.red("Failed to parse JSON for missing tasks, attempting individual extraction..."));
                  
                  const taskMatches = cleanedResponse.match(/\{\s*"taskId"\s*:\s*(\d+)[^}]*\}/g);
                  if (taskMatches && taskMatches.length > 0) {
                    console.log(chalk.yellow(`Found ${taskMatches.length} task objects, attempting to process individually`));
                    
                    missingAnalysis = [];
                    for (const taskMatch of taskMatches) {
                      try {
                        const fixedTask = taskMatch.replace(/,\s*$/, '');
                        const taskObj = JSON.parse(`${fixedTask}`);
                        if (taskObj && taskObj.taskId) {
                          missingAnalysis.push(taskObj);
                        }
                      } catch (taskParseError) {
                        console.log(chalk.yellow(`Could not parse individual task: ${taskMatch.substring(0, 30)}...`));
                      }
                    }
                    
                    if (missingAnalysis.length === 0) {
                      throw new Error("Could not parse any missing tasks");
                    }
                  } else {
                    throw fixedJsonError;
                  }
                }
              }
              
              // Ensure it's an array
              if (!Array.isArray(missingAnalysis)) {
                if (missingAnalysis && typeof missingAnalysis === 'object') {
                  missingAnalysis = [missingAnalysis];
                } else {
                  throw new Error("Missing tasks analysis is not an array or object");
                }
              }
              
              // Add the missing analyses to the main analysis array
              console.log(chalk.green(`Successfully analyzed ${missingAnalysis.length} missing tasks`));
              complexityAnalysis = [...complexityAnalysis, ...missingAnalysis];
              
              // Re-check for missing tasks
              const updatedAnalysisTaskIds = complexityAnalysis.map(a => a.taskId);
              const stillMissingTaskIds = taskIds.filter(id => !updatedAnalysisTaskIds.includes(id));
              
              if (stillMissingTaskIds.length > 0) {
                console.log(chalk.yellow(`Warning: Still missing analysis for ${stillMissingTaskIds.length} tasks: ${stillMissingTaskIds.join(', ')}`));
              } else {
                console.log(chalk.green(`All tasks now have complexity analysis!`));
              }
            } catch (error) {
              console.error(chalk.red(`Error analyzing missing tasks: ${error.message}`));
              console.log(chalk.yellow(`Continuing with partial analysis...`));
            }
          } catch (error) {
            console.error(chalk.red(`Error during retry for missing tasks: ${error.message}`));
            console.log(chalk.yellow(`Continuing with partial analysis...`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`Failed to parse LLM response as JSON: ${error.message}`));
        if (CONFIG.debug) {
          console.debug(chalk.gray(`Raw response: ${fullResponse}`));
        }
        throw new Error('Invalid response format from LLM. Expected JSON.');
      }
      
      // Create the final report
      const report = {
        meta: {
          generatedAt: new Date().toISOString(),
          tasksAnalyzed: tasksData.tasks.length,
          thresholdScore: thresholdScore,
          projectName: tasksData.meta?.projectName || 'Your Project Name',
          usedResearch: useResearch
        },
        complexityAnalysis: complexityAnalysis
      };
      
      // Write the report to file
      console.log(chalk.blue(`Writing complexity report to ${outputPath}...`));
      writeJSON(outputPath, report);
      
      console.log(chalk.green(`Task complexity analysis complete. Report written to ${outputPath}`));
      
      // Display a summary of findings
      const highComplexity = complexityAnalysis.filter(t => t.complexityScore >= 8).length;
      const mediumComplexity = complexityAnalysis.filter(t => t.complexityScore >= 5 && t.complexityScore < 8).length;
      const lowComplexity = complexityAnalysis.filter(t => t.complexityScore < 5).length;
      const totalAnalyzed = complexityAnalysis.length;
      
      console.log('\nComplexity Analysis Summary:');
      console.log('----------------------------');
      console.log(`Tasks in input file: ${tasksData.tasks.length}`);
      console.log(`Tasks successfully analyzed: ${totalAnalyzed}`);
      console.log(`High complexity tasks: ${highComplexity}`);
      console.log(`Medium complexity tasks: ${mediumComplexity}`);
      console.log(`Low complexity tasks: ${lowComplexity}`);
      console.log(`Sum verification: ${highComplexity + mediumComplexity + lowComplexity} (should equal ${totalAnalyzed})`);
      console.log(`Research-backed analysis: ${useResearch ? 'Yes' : 'No'}`);
      console.log(`\nSee ${outputPath} for the full report and expansion commands.`);
      
    } catch (error) {
      if (streamingInterval) clearInterval(streamingInterval);
      stopLoadingIndicator(loadingIndicator);
      throw error;
    }
  } catch (error) {
    console.error(chalk.red(`Error analyzing task complexity: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Find the next pending task based on dependencies
 * @param {Object[]} tasks - The array of tasks
 * @returns {Object|null} The next task to work on or null if no eligible tasks
 */
function findNextTask(tasks) {
  // Get all completed task IDs
  const completedTaskIds = new Set(
    tasks
      .filter(t => t.status === 'done' || t.status === 'completed')
      .map(t => t.id)
  );
  
  // Filter for pending tasks whose dependencies are all satisfied
  const eligibleTasks = tasks.filter(task => 
    (task.status === 'pending' || task.status === 'in-progress') && 
    task.dependencies && // Make sure dependencies array exists
    task.dependencies.every(depId => completedTaskIds.has(depId))
  );
  
  if (eligibleTasks.length === 0) {
    return null;
  }
  
  // Sort eligible tasks by:
  // 1. Priority (high > medium > low)
  // 2. Dependencies count (fewer dependencies first)
  // 3. ID (lower ID first)
  const priorityValues = { 'high': 3, 'medium': 2, 'low': 1 };
  
  const nextTask = eligibleTasks.sort((a, b) => {
    // Sort by priority first
    const priorityA = priorityValues[a.priority || 'medium'] || 2;
    const priorityB = priorityValues[b.priority || 'medium'] || 2;
    
    if (priorityB !== priorityA) {
      return priorityB - priorityA; // Higher priority first
    }
    
    // If priority is the same, sort by dependency count
    if (a.dependencies && b.dependencies && a.dependencies.length !== b.dependencies.length) {
      return a.dependencies.length - b.dependencies.length; // Fewer dependencies first
    }
    
    // If dependency count is the same, sort by ID
    return a.id - b.id; // Lower ID first
  })[0]; // Return the first (highest priority) task
  
  return nextTask;
}


// Export task manager functions
export {
  parsePRD,
  updateTasks,
  generateTaskFiles,
  setTaskStatus,
  updateSingleTaskStatus,
  listTasks,
  expandTask,
  expandAllTasks,
  clearSubtasks,
  addTask,
  findNextTask,
  analyzeTaskComplexity,
}; 