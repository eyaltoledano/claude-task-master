// Task Master Module

function initTaskMaster() {
  console.log('Task Master module initialized');
  return {
    version: '1.0.0',
    status: 'ready'
  };
}


// Task Master Module

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import {
  parsePRD,
  updateTasks,
  generateTaskFiles,
  setTaskStatus,
  updateSingleTaskStatus,
  expandTask,
  expandAllTasks,
  clearSubtasks,
  addTask,
  findNextTask,
  analyzeTaskComplexity,
  generateSubtasks,
  generateSubtasksWithPerplexity
} from '../../../scripts/modules/task-manager.js';

// Task data structure
export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'done' | 'deferred';
  dependencies: number[];
  priority: 'high' | 'medium' | 'low';
  details: string;
  testStrategy: string;
  subtasks: Task[];
}

const TASKS_PATH = path.join(__dirname, '..', '..', '..', 'tasks', 'tasks.json');

// Task management functions
// @ts-ignore
import { readJSON, writeJSON } from '../../../scripts/modules/utils.js';

async function createTask(task: Task): Promise<void> {
  try {
    // Read existing tasks
    let tasks = [];
    try {
      const tasksData = await parsePRD("your_prd_file.txt", TASKS_PATH, 5);
      if (tasksData && Array.isArray(tasksData.tasks)) {
        tasks = tasksData.tasks;
      }
    } catch (error) {
      console.log('Error reading tasks.json, creating a new one.');
    }

    // Add new task
    tasks.push(task);

    // Write updated tasks
    await writeJSON(TASKS_PATH, { tasks });

    console.log('Task created successfully:', task.title);
  } catch (error) {
    console.error('Error creating task:', error);
  }
}

async function readTask(taskId: number): Promise<Task | null> {
  try {
    // Read existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      console.log('No tasks found.');
      return null;
    }

    // Find task with specified ID
    const task = tasksData.tasks.find((task: Task) => task.id === taskId);
    if (!task) {
      console.log(`Task with ID ${taskId} not found.`);
      return null;
    }

    return task;
  } catch (error) {
    console.error('Error reading task:', error);
    return null;
  }
}

async function updateTask(task: Task): Promise<void> {
  try {
    // Read existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      console.log('No tasks found.');
      return;
    }

    // Find task with specified ID
    const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === task.id);
    if (taskIndex === -1) {
      console.log(`Task with ID ${task.id} not found.`);
      return;
    }

    // Update task
    tasksData.tasks[taskIndex] = task;

    // Write updated tasks
    await writeJSON(TASKS_PATH, tasksData);

    console.log('Task updated successfully:', task.title);
  } catch (error) {
    console.error('Error updating task:', error);
  }
}

async function deleteTask(taskId: number): Promise<void> {
  try {
    // Read existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      console.log('No tasks found.');
      return;
    }

    // Find task with specified ID
    const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === taskId);
    if (taskIndex === -1) {
      console.log(`Task with ID ${taskId} not found.`);
      return;
    }

    // Delete task
    tasksData.tasks.splice(taskIndex, 1);

    // Write updated tasks
    await writeJSON(TASKS_PATH, tasksData);

    console.log('Task deleted successfully:', taskId);
  } catch (error) {
    console.error('Error deleting task:', error);
  }
}

async function listTasks(): Promise<Task[]> {
  try {
    // Read existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      console.log('No tasks found.');
      return [];
    }

    // Display tasks
    console.log('Tasks:');
    tasksData.tasks.forEach((task: Task) => {
      console.log(`- ID: ${task.id}, Title: ${task.title}, Status: ${task.status}`);
    });
    
    return tasksData.tasks;
  } catch (error) {
    console.error('Error listing tasks:', error);
    return [];
  }
}

async function expandTask(taskId: number, numSubtasks: number = 3): Promise<void> {
    try {
        // Read existing tasks
        const tasksData = await readJSON(TASKS_PATH);
        if (!tasksData || !Array.isArray(tasksData.tasks)) {
            console.log('No tasks found.');
            return;
        }

        // Find task with specified ID
        const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === taskId);
        if (taskIndex === -1) {
            console.log(`Task with ID ${taskId} not found.`);
            return;
        }

        const task = tasksData.tasks[taskIndex];

        // Generate subtasks (replace with your actual subtask generation logic)
        const subtasks = await generateSubtasks(task, numSubtasks, 1);

        // Add subtasks to the task
        task.subtasks = subtasks;

        // Write updated tasks
        await writeJSON(TASKS_PATH, tasksData);

        console.log(`Task ${taskId} expanded successfully with ${numSubtasks} subtasks.`);
    } catch (error) {
        console.error('Error expanding task:', error);
    }
}

async function generateTaskFiles(tasksPath: string, outputDir: string): Promise<void> {
    try {
        // Read existing tasks
        const tasksData = await readJSON(TASKS_PATH);
        if (!tasksData || !Array.isArray(tasksData.tasks)) {
            console.log('No tasks found.');
            return;
        }

        // Generate task files
        tasksData.tasks.forEach((task: Task) => {
            const taskFilePath = path.join(outputDir, `task_${task.id}.txt`);
            let taskContent = `ID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\n`;
            if (task.description) {
                taskContent += `Description: ${task.description}\n`;
            }
            if (task.details) {
                taskContent += `Details: ${task.details}\n`;
            }
            if (task.dependencies && task.dependencies.length > 0) {
                taskContent += `Dependencies: ${task.dependencies.join(',')}\n`;
            }
            if (task.subtasks && task.subtasks.length > 0) {
                taskContent += 'Subtasks:\n';
                task.subtasks.forEach(subtask => {
                    taskContent += `  - ID: ${subtask.id}, Title: ${subtask.title}, Status: ${subtask.status}\n`;
                });
            }
            fs.writeFileSync(taskFilePath, taskContent);
            console.log(`Task file generated: ${taskFilePath}`);
        });
    } catch (error) {
        console.error('Error generating task files:', error);
    }
}

async function setTaskStatus(taskId: number, status: 'pending' | 'in-progress' | 'done' | 'deferred'): Promise<void> {
  try {
    // Read existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
      console.log('No tasks found.');
      return;
    }

    // Find task with specified ID
    const taskIndex = tasksData.tasks.findIndex((t: Task) => t.id === taskId);
    if (taskIndex === -1) {
      console.log(`Task with ID ${taskId} not found.`);
      return;
    }

    // Update task status
    tasksData.tasks[taskIndex].status = status;

    // Write updated tasks
    await writeJSON(TASKS_PATH, tasksData);

    console.log(`Task ${taskId} status updated to: ${status}`);
  } catch (error) {
    console.error('Error setting task status:', error);
  }
}


async function updateSingleTaskStatus(tasksPath: string, taskIdInput: string, newStatus: 'pending' | 'in-progress' | 'done' | 'deferred', data: any): Promise<void> {
  // Check if it's a subtask (e.g., "1.2")
  if (taskIdInput.includes('.')) {
      const [parentId, subtaskId] = taskIdInput.split('.').map(id => parseInt(id, 10));

      // Find the parent task
      const parentTask = data.tasks.find((t: Task) => t.id === parentId);
      if (!parentTask) {
          throw new Error(`Parent task ${parentId} not found`);
      }

      // Find the subtask
      if (!parentTask.subtasks) {
          throw new Error(`Parent task ${parentId} has no subtasks`);
      }

      const subtask = parentTask.subtasks.find((st: Task) => st.id === subtaskId);
      if (!subtask) {
          throw new Error(`Subtask ${subtaskId} not found in parent task ${parentId}`);
      }

      // Update the subtask status
      const oldStatus = subtask.status || 'pending';
      subtask.status = newStatus;

      console.log(`Updated subtask ${parentId}.${subtaskId} status from '${oldStatus}' to '${newStatus}'`);

      // Check if all subtasks are done (if setting to 'done')
      if (newStatus === 'done') {
          const allSubtasksDone = parentTask.subtasks.every((st: Task) =>
              st.status === 'done');

          // Suggest updating parent task if all subtasks are done
          if (allSubtasksDone && parentTask.status !== 'done') {
              console.log(`All subtasks of parent task ${parentId} are now marked as done.`);
              console.log(`Consider updating the parent task status with: task-master set-status --id=${parentId} --status=done`);
          }
      }
  } else {
      // Handle regular task
      const taskId = parseInt(taskIdInput, 10);
      const task = data.tasks.find((t: Task) => t.id === taskId);

      if (!task) {
          throw new Error(`Task ${taskId} not found`);
      }

      // Update the task status
      const oldStatus = task.status || 'pending';
      task.status = newStatus;

      console.log(`Updated task ${taskId} status from '${oldStatus}' to '${newStatus}'`);

      // If marking as done, also mark all subtasks as done
      if (newStatus === 'done' && task.subtasks && task.subtasks.length > 0) {

          const pendingSubtasks = task.subtasks.filter((st: Task) =>
              st.status !== 'done');

          if (pendingSubtasks.length > 0) {
              console.log(`Also marking ${pendingSubtasks.length} subtasks as '${newStatus}'`);

              pendingSubtasks.forEach((subtask: Task) => {
                  subtask.status = newStatus;
              });
          }
      }
  }
}

async function expandAllTasks(numSubtasks: number = 3, useResearch: boolean = false, additionalContext: string = '', forceFlag: boolean = false): Promise<void> {
    try {
        // Read existing tasks
        const tasksData = await readJSON(TASKS_PATH);
        if (!tasksData || !Array.isArray(tasksData.tasks)) {
            console.log('No tasks found.');
            return;
        }

        // Filter tasks that are not done and don't have subtasks (unless forced)
        const pendingTasks = tasksData.tasks.filter((task: Task) =>
            task.status !== 'done' &&
            (forceFlag || !task.subtasks || task.subtasks.length === 0)
        );

        if (pendingTasks.length === 0) {
            console.log('No pending tasks found to expand');
            return;
        }

        // Expand each task
        for (const task of pendingTasks) {
            // Generate subtasks
            const subtasks = await generateSubtasks(task, numSubtasks, 1);

            // Add the subtasks to the task
            task.subtasks = subtasks;
        }

        // Write the updated tasks to the file
        await writeJSON(TASKS_PATH, tasksData);

        console.log(`Successfully expanded ${pendingTasks.length} tasks`);
    } catch (error) {
        console.error('Error expanding tasks:', error);
    }
}

async function addTask(prompt: string, dependencies: number[] = [], priority: 'medium' | 'high' | 'low' = 'medium'): Promise<number> {
    // Read the existing tasks
    const tasksData = await readJSON(TASKS_PATH);
    if (!tasksData || !Array.isArray(tasksData.tasks)) {
        throw new Error('Invalid or missing tasks.json.');
    }

    // Find the highest task ID to determine the next ID
    const highestId = tasksData.tasks.length > 0 ? Math.max(...tasksData.tasks.map((t: Task) => t.id)) : 0;
    const newTaskId = highestId + 1;

    // Validate dependencies before proceeding
    const invalidDeps = dependencies.filter(depId => {
        return !tasksData.tasks.some((t: Task) => t.id === depId);
    });

    if (invalidDeps.length > 0) {
        console.warn(`The following dependencies do not exist: ${invalidDeps.join(', ')}`);
        console.info('Removing invalid dependencies...');
        dependencies = dependencies.filter(depId => !invalidDeps.includes(depId));
    }

    // Create the system prompt for Claude
    const systemPrompt = "You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description.";

    // Create the user prompt with context from existing tasks
    let contextTasks = '';
    if (dependencies.length > 0) {
        // Provide context for the dependent tasks
        const dependentTasks = tasksData.tasks.filter((t: Task) => dependencies.includes(t.id));
        contextTasks = `\nThis task depends on the following tasks:\n${dependentTasks.map((t: Task) =>
            `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;
    } else {
        // Provide a few recent tasks as context
        const recentTasks = [...tasksData.tasks].sort((a, b) => b.id - a.id).slice(0, 3);
        contextTasks = `\nRecent tasks in the project:\n${recentTasks.map((t: Task) =>
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

    // Call Claude to generate the new task
    const newTaskResponse = await generateSubtasksWithPerplexity({
        id: newTaskId,
        title: '',
        description: prompt,
        status: 'pending',
        dependencies: dependencies,
        priority: priority,
        details: '',
        testStrategy: '',
    }, 1);

    // Extract the new task from the response
    const newTask = newTaskResponse[0];

    // Add the new task to the tasks array
    tasksData.tasks.push(newTask);

    // Write the updated tasks back to the file
    await writeJSON(TASKS_PATH, tasksData);

    console.log(chalk.green(`Successfully added new task #${newTaskId}:`), chalk.white.bold(newTask.title));

    return newTaskId;
}

async function findNextTask(tasks: Task[]): Promise<Task | null> {
    // Get all completed task IDs
    const completedTaskIds = new Set(
        tasks
            .filter(t => t.status === 'done')
            .map(t => t.id)
    );

    // Filter for pending tasks whose dependencies are all satisfied
    const eligibleTasks = tasks.filter(task =>
        task.status === 'pending' &&
        task.dependencies &&
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
        const priorityA = priorityValues[a.priority] || 2;
        const priorityB = priorityValues[b.priority] || 2;

        if (priorityB !== priorityA) {
            return priorityB - priorityA; // Higher priority first
        }

        // If priority is the same, sort by dependency count
        if (a.dependencies && b.dependencies && a.dependencies.length !== b.dependencies.length) {
            return a.dependencies.length - b.dependencies.length; // Fewer dependencies first
        }

        // If dependency count is the same, sort by ID
        return a.id - b.id; // Lower ID first
    })[0];

    return nextTask;
}
async function analyzeTaskComplexity(): Promise<void> {
    try {
        // Read existing tasks
        const tasksData = await readJSON(TASKS_PATH);
        if (!tasksData || !Array.isArray(tasksData.tasks)) {
            console.log('No tasks found to analyze.');
            return;
        }

        // Prepare complexity report
        const complexityReport = {
            timestamp: new Date().toISOString(),
            tasks: [] as any[],
            summary: {
                totalTasks: 0,
                highComplexity: 0,
                mediumComplexity: 0,
                lowComplexity: 0
            }
        };

        // Analyze each task
        for (const task of tasksData.tasks) {
            // Call Claude API to analyze task complexity
            const analysis = await generateSubtasksWithPerplexity(task, 1, 1);
            
            const taskAnalysis = {
                id: task.id,
                title: task.title,
                complexity: analysis[0].complexity || 'medium',
                estimatedHours: analysis[0].estimatedHours || 4,
                analysisDetails: analysis[0].analysisDetails || 'No detailed analysis available'
            };

            complexityReport.tasks.push(taskAnalysis);

            // Update summary counts
            complexityReport.summary.totalTasks++;
            if (taskAnalysis.complexity === 'high') complexityReport.summary.highComplexity++;
            else if (taskAnalysis.complexity === 'medium') complexityReport.summary.mediumComplexity++;
            else complexityReport.summary.lowComplexity++;
        }

        // Save complexity report
        const reportPath = path.join(__dirname, '..', '..', '..', 'tasks', 'complexity-report.json');
        await writeJSON(reportPath, complexityReport);

        console.log(chalk.green('Task complexity analysis completed successfully!'));
        console.log(`Report saved to: ${reportPath}`);
        
        // Print summary
        console.log(chalk.bold('\nComplexity Summary:'));
        console.log(`- Total tasks analyzed: ${complexityReport.summary.totalTasks}`);
        console.log(`- High complexity: ${complexityReport.summary.highComplexity}`);
        console.log(`- Medium complexity: ${complexityReport.summary.mediumComplexity}`);
        console.log(`- Low complexity: ${complexityReport.summary.lowComplexity}`);
    } catch (error) {
        console.error('Error analyzing task complexity:', error);
    }
}
export {
  initTaskMaster,
  parsePRD,
  createTask,
  readTask,
  updateTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateSingleTaskStatus,
  expandTask,
  expandAllTasks,
  addTask,
  findNextTask,
  analyzeTaskComplexity
};
console.log('Task Master module loaded');