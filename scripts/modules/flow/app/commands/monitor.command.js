/**
 * Monitor Command
 * Real-time monitoring dashboard using blessed-contrib
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { findProjectRoot, readJSON } from '../../../utils.js';
import { launchFallbackMonitor } from './monitor-fallback.js';
import { listTasks, findNextTask } from '../../../task-manager.js';
import TaskMasterMonitor from './monitor/index.js';

/**
 * Launch the monitoring dashboard
 * @param {Object} options - Command options
 */
export async function launchMonitor(options = {}) {
  try {
    const projectRoot = options.projectRoot || findProjectRoot() || process.cwd();
    
    // Check terminal size
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    
    if (termWidth < 100 || termHeight < 20) {
      console.log(chalk.yellow('⚠️  Terminal too small for full dashboard'));
      console.log(chalk.gray(`   Current: ${termWidth}x${termHeight}`));
      console.log(chalk.gray('   Switching to text-based monitor...\n'));
      launchFallbackMonitor();
      return;
    }
    
    if (termWidth < 120 || termHeight < 30) {
      console.log(chalk.yellow('⚠️  Terminal size warning:'));
      console.log(chalk.gray(`   Current: ${termWidth}x${termHeight}`));
      console.log(chalk.gray('   Recommended: 120x30 or larger'));
      console.log(chalk.gray('   Dashboard may not display properly\n'));
    }
    
    // Create the main screen
    const screen = blessed.screen({
      smartCSR: true,
      title: 'Task Master Flow Monitor',
      fullUnicode: true,
      dockBorders: true
    });

    // Create dashboard pages with error handling
    const pages = [
      (screen) => createTasksDashboardPage(screen, projectRoot),
      (screen) => createTaskProgressPage(screen),
      (screen) => createAgentActivityPage(screen),
      (screen) => createSystemStatsPage(screen),
      (screen) => createVibeKitMainDashboard(screen),
      (screen) => createAgentPerformanceDashboard(screen),
      (screen) => createSandboxOperationsDashboard(screen),
      (screen) => createGitOperationsDashboard(screen)
    ];

    // Set up exit handlers
    screen.key(['escape', 'q', 'C-c'], (ch, key) => {
      screen.destroy();
      console.log(chalk.green('\n👋 Monitoring dashboard closed'));
      process.exit(0);
    });

    // Create carousel with manual navigation only (no auto-rotation)
    const carousel = new contrib.carousel(
      pages,
      {
        screen: screen,
        interval: 0, // Disable auto-rotation
        controlKeys: true // Enable left/right arrow key navigation
      }
    );

    // Display instructions
    console.log(chalk.cyan('🖥️  Task Master Flow Monitor'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.yellow('⌨️  Navigation:'));
    console.log(chalk.gray('   • ←/→ arrows: Switch between dashboards'));
    console.log(chalk.gray('   • ↑/↓ arrows or J/K: Scroll through tasks table'));
    console.log(chalk.gray('   • PgUp/PgDn: Fast scroll | Home/End: Top/Bottom'));
    console.log(chalk.gray('   • F key: Filter tasks by status (Tasks dashboard)'));
    console.log(chalk.gray('   • q/ESC/Ctrl+C: Exit'));
    console.log('');

    // Start the carousel
    carousel.start();

  } catch (error) {
    console.error(chalk.red('❌ Failed to launch monitor:'), error.message);
    if (error.message.includes('out of range') || error.message.includes('size')) {
      console.log(chalk.yellow('💡 Tip: Try enlarging your terminal window and try again'));
      console.log(chalk.gray('   Recommended terminal size: 120x30 or larger'));
    }
    process.exit(1);
  }
}

/**
 * Load real task data from Task Master
 */
function loadTaskData(projectRoot) {
  try {
    // Find tasks.json file
    const tasksPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
    
    // Check if file exists first
    if (!fs.existsSync(tasksPath)) {
      console.log('No tasks.json found, using mock data');
      return getMockTaskData();
    }
    
    // Use listTasks to get comprehensive task data with statistics
    const result = listTasks(tasksPath, null, null, true, 'json', null, { projectRoot });
    
    // Ensure result has the expected structure
    if (!result || typeof result !== 'object') {
      console.log('Invalid task data structure, using mock data');
      return getMockTaskData();
    }
    
    return result;
  } catch (error) {
    // Return mock data if real data unavailable
    console.log('Failed to load task data:', error.message, '- using mock data');
    return getMockTaskData();
  }
}

export { loadTaskData }; // Add this export at the end

/**
 * Generate mock task data for testing/demo
 */
function getMockTaskData() {
  return {
    tasks: [
      {
        id: 1,
        title: 'Setup project structure',
        status: 'done',
        priority: 'high',
        dependencies: [],
        complexityScore: 3
      },
      {
        id: 2,
        title: 'Implement authentication',
        status: 'in-progress',
        priority: 'high',
        dependencies: [1],
        complexityScore: 8
      },
      {
        id: 3,
        title: 'Create dashboard UI',
        status: 'pending',
        priority: 'medium',
        dependencies: [1, 2],
        complexityScore: 6
      },
      {
        id: 4,
        title: 'Add monitoring features',
        status: 'pending',
        priority: 'low',
        dependencies: [3],
        complexityScore: 7
      }
    ],
    stats: {
      total: 4,
      completed: 1,
      inProgress: 1,
      pending: 2,
      blocked: 0,
      deferred: 0,
      cancelled: 0,
      completionPercentage: 25,
      subtasks: {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        blocked: 0,
        deferred: 0,
        cancelled: 0,
        completionPercentage: 0
      }
    }
  };
}

/**
 * Generate project dashboard content matching the screenshot
 */
function generateProjectDashboardContent(taskData) {
  const stats = taskData.stats;
  
  // Create progress bar for tasks
  const taskProgress = Math.round(stats.completionPercentage);
  const taskProgressBar = '█'.repeat(Math.floor(taskProgress / 3)) + '▓'.repeat(Math.floor((100 - taskProgress) / 6));
  
  // Create progress bar for subtasks
  const subtaskProgress = Math.round(stats.subtasks?.completionPercentage || 0);
  const subtaskProgressBar = '█'.repeat(Math.floor(subtaskProgress / 3)) + '▓'.repeat(Math.floor((100 - subtaskProgress) / 6));
  
  return `Tasks Progress: ${taskProgressBar} ${taskProgress}% ${taskProgress}%
Done: ${stats.completed}  In Progress: ${stats.inProgress}  Pending: ${stats.pending}  Blocked: ${stats.blocked}
Deferred: ${stats.deferred}  Cancelled: ${stats.cancelled || 0}

Subtasks Progress: ${subtaskProgressBar} ${subtaskProgress}% ${subtaskProgress}%
Completed: ${stats.subtasks?.completed || 0}/${stats.subtasks?.total || 0}  In Progress: ${stats.subtasks?.inProgress || 0}  Pending: ${stats.subtasks?.pending || 0}  Blocked: ${stats.subtasks?.blocked || 0}  Deferred: ${stats.subtasks?.deferred || 0}  Cancelled: ${stats.subtasks?.cancelled || 0}

Priority Breakdown:
• High priority: ${taskData.tasks?.filter(t => t.priority === 'high').length || 0}
• Medium priority: ${taskData.tasks?.filter(t => t.priority === 'medium').length || 0}
• Low priority: ${taskData.tasks?.filter(t => t.priority === 'low').length || 0}`;
}

/**
 * Generate dependency status content
 */
function generateDependencyStatusContent(taskData) {
  if (!taskData.tasks || taskData.tasks.length === 0) {
    return `Dependency Metrics:
• No tasks available
• Load your Task Master project to see real data

Next Task to Work On:
• Initialize project with 'task-master init'
• Add tasks with 'task-master add-task'`;
  }

  // Calculate dependency metrics
  const completedTaskIds = new Set(
    taskData.tasks.filter(t => t.status === 'done' || t.status === 'completed').map(t => t.id)
  );

  const tasksWithNoDeps = taskData.tasks.filter(t => 
    t.status !== 'done' && t.status !== 'completed' && 
    (!t.dependencies || t.dependencies.length === 0)
  ).length;

  const tasksReadyToWork = taskData.tasks.filter(t => 
    t.status !== 'done' && t.status !== 'completed' && 
    (!t.dependencies || t.dependencies.length === 0 || 
     t.dependencies.every(depId => completedTaskIds.has(depId)))
  ).length;

  const tasksBlocked = taskData.tasks.filter(t => 
    t.status !== 'done' && t.status !== 'completed' && 
    t.dependencies && t.dependencies.length > 0 && 
    !t.dependencies.every(depId => completedTaskIds.has(depId))
  ).length;

  // Calculate most depended-on task
  const dependencyCount = {};
  taskData.tasks.forEach(task => {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach(depId => {
        dependencyCount[depId] = (dependencyCount[depId] || 0) + 1;
      });
    }
  });

  let mostDependedOnTaskId = null;
  let maxDependents = 0;
  for (const [taskId, count] of Object.entries(dependencyCount)) {
    if (count > maxDependents) {
      maxDependents = count;
      mostDependedOnTaskId = parseInt(taskId);
    }
  }

  // Calculate average dependencies per task
  const totalDependencies = taskData.tasks.reduce(
    (sum, task) => sum + (task.dependencies ? task.dependencies.length : 0),
    0
  );
  const avgDependenciesPerTask = totalDependencies / taskData.tasks.length;

  // Use real findNextTask function
  const nextTaskItem = findNextTask(taskData.tasks);

  return `Dependency Metrics:
• Tasks with no dependencies: ${tasksWithNoDeps}
• Tasks ready to work on: ${tasksReadyToWork}
• Tasks blocked by dependencies: ${tasksBlocked}
• Most depended-on task: ${mostDependedOnTaskId ? `#${mostDependedOnTaskId} (${maxDependents} dependents)` : 'None'}
• Avg dependencies per task: ${avgDependenciesPerTask.toFixed(1)}

Next Task to Work On:
ID: ${nextTaskItem?.id || 'N/A'} - ${nextTaskItem?.title ? truncateText(nextTaskItem.title, 40) : 'No task available'}
Priority: ${nextTaskItem?.priority || 'N/A'}  Dependencies: ${nextTaskItem?.dependencies?.join(', ') || 'None'}
Complexity: ${nextTaskItem?.complexityScore ? `● ${nextTaskItem.complexityScore}` : 'N/A'}`;
}

/**
 * Create filterable task table
 */
function createFilterableTaskTable(grid, taskData, statusFilter) {
  const taskTable = grid.set(7, 0, 4, 12, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: true,
    label: `All Tasks (${statusFilter === 'all' ? taskData.tasks?.length || 0 : taskData.tasks?.filter(t => t.status === statusFilter).length || 0} shown)`,
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 1,
    columnWidth: [6, 30, 12, 10, 8, 8, 12],
    // Simple scrolling configuration
    scrollable: true
  });

  updateTaskTable(taskTable, taskData, statusFilter);
  
  return taskTable;
}

/**
 * Update task table with filtered data
 */
function updateTaskTable(taskTable, taskData, statusFilter) {
  let filteredTasks = taskData.tasks || [];
  
  if (statusFilter !== 'all') {
    filteredTasks = filteredTasks.filter(task => task.status === statusFilter);
  }

  // Include subtasks in the display
  const tableData = [];
  
  filteredTasks.forEach(task => {
    // Add main task
    tableData.push([
      task.id.toString(),
      truncateText(task.title || 'Untitled', 28),
      task.status || 'pending',
      task.priority || 'medium',
      task.dependencies?.length || 0,
      task.complexityScore || 'N/A',
      'N/A' // ETA placeholder
    ]);

    // Add subtasks if they exist and match filter
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(subtask => {
        if (statusFilter === 'all' || subtask.status === statusFilter) {
          tableData.push([
            `${task.id}.${subtask.id}`,
            `  └ ${truncateText(subtask.title || 'Untitled', 25)}`,
            subtask.status || 'pending',
            subtask.priority || task.priority || 'medium',
            subtask.dependencies?.length || 0,
            subtask.complexityScore || 'N/A',
            'N/A'
          ]);
        }
      });
    }
  });

  taskTable.setData({
    headers: ['ID', 'Task Description', 'Status', 'Priority', 'Deps', 'Complex', 'ETA'],
    data: tableData
  });

  // Update label with count
  taskTable.setLabel(`All Tasks (${tableData.length} shown)`);
}

/**
 * Helper function to truncate text
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create Task Progress Dashboard Page
 */
function createTaskProgressPage(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🚀 TASK PROGRESS MONITORING{/center}',
    style: {
      fg: 'white',
      bg: 'green',
      bold: true
    },
    tags: true
  });

  // Task Completion Progress Display
  const completionDisplay = grid.set(1, 0, 2, 12, blessed.box, {
    label: 'Overall Project Progress',
    content: '{center}Project: 67% Complete{/center}\n{center}██████████████████████████████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓{/center}\n{center}🚀 15 of 22 tasks completed{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  // Tasks by Category
  const tasksByCategory = grid.set(3, 0, 4, 6, contrib.bar, {
    label: 'Tasks by Category',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 0,
    maxHeight: 9
  });

  tasksByCategory.setData({
    titles: ['Frontend', 'Backend', 'Database', 'Testing', 'DevOps'],
    data: [8, 12, 5, 7, 3]
  });

  // Sprint Progress
  const sprintProgress = grid.set(3, 6, 4, 6, contrib.line, {
    style: {
      line: 'cyan',
      text: 'white',
      baseline: 'black'
    },
    xLabelPadding: 3,
    xPadding: 5,
    label: 'Sprint Burndown Chart'
  });

  const sprintData = [{
    title: 'Sprint 1',
    x: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    y: [35, 28, 22, 18, 12, 8, 3],
    style: { line: 'red' }
  }];
  sprintProgress.setData(sprintData);

  // Task Details Table
  const taskDetails = grid.set(7, 0, 5, 12, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Detailed Task Status',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 1,
    columnWidth: [6, 25, 12, 10, 8, 8, 12]
  });

  taskDetails.setData({
    headers: ['ID', 'Task Description', 'Agent', 'Status', 'Progress', 'Priority', 'ETA'],
    data: [
      ['1', 'Setup project structure', 'Claude', 'Done', '100%', 'High', '—'],
      ['2', 'Implement authentication', 'GPT-4', 'Done', '100%', 'High', '—'],
      ['3', 'Create API endpoints', 'Claude', 'Running', '75%', 'High', '15 min'],
      ['4', 'Database schema design', 'Gemini', 'Done', '100%', 'Medium', '—'],
      ['5.1', 'Setup API routes', 'Claude', 'Running', '60%', 'High', '8 min'],
      ['5.2', 'Add validation logic', 'Gemini', 'Queued', '0%', 'Medium', '20 min'],
      ['6', 'Frontend components', 'GPT-4', 'Pending', '0%', 'Medium', '45 min'],
      ['7', 'Database migration', 'Claude', 'Running', '30%', 'High', '25 min'],
      ['8', 'Unit tests', 'Gemini', 'Pending', '0%', 'Low', '60 min'],
      ['9', 'Integration tests', 'GPT-4', 'Pending', '0%', 'Low', '90 min']
    ]
  });

  screen.render();
}

/**
 * Create Agent Activity Dashboard Page
 */
function createAgentActivityPage(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🤖 AGENT ACTIVITY MONITORING{/center}',
    style: {
      fg: 'white',
      bg: 'magenta',
      bold: true
    },
    tags: true
  });

  // Agent Status Indicators
  const claudeStatus = grid.set(1, 0, 2, 4, blessed.box, {
    label: 'Claude Agent',
    content: '{center}🟢 ACTIVE{/center}\n{center}Task: 5.1{/center}\n{center}Uptime: 2h 34m{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  const geminiStatus = grid.set(1, 4, 2, 4, blessed.box, {
    label: 'Gemini Agent',
    content: '{center}🟡 IDLE{/center}\n{center}Task: Queued{/center}\n{center}Uptime: 1h 18m{/center}',
    border: { type: 'line', fg: 'yellow' },
    style: { fg: 'yellow', bold: true },
    tags: true
  });

  const gpt4Status = grid.set(1, 8, 2, 4, blessed.box, {
    label: 'GPT-4 Agent',
    content: '{center}🟢 ACTIVE{/center}\n{center}Task: 7{/center}\n{center}Uptime: 45m{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  // Agent Performance Metrics
  const agentMetrics = grid.set(3, 0, 3, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Agent Performance Metrics',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [12, 10, 12, 10, 10]
  });

  agentMetrics.setData({
    headers: ['Agent', 'Tasks', 'Success Rate', 'Avg Time', 'Status'],
    data: [
      ['Claude', '15', '94%', '3.2 min', 'Active'],
      ['Gemini', '8', '89%', '4.1 min', 'Idle'],
      ['GPT-4', '12', '91%', '3.8 min', 'Active'],
      ['Codex', '3', '100%', '2.9 min', 'Offline']
    ]
  });

  // Request Rate Chart
  const requestRate = grid.set(3, 6, 3, 6, contrib.line, {
    style: {
      line: 'yellow',
      text: 'green',
      baseline: 'black'
    },
    xLabelPadding: 3,
    xPadding: 5,
    label: 'API Request Rate (req/min)'
  });

  const requestData = [{
    title: 'Requests',
    x: ['15:25', '15:26', '15:27', '15:28', '15:29', '15:30', '15:31', '15:32'],
    y: [12, 15, 18, 14, 22, 19, 16, 20],
    style: { line: 'red' }
  }];
  requestRate.setData(requestData);

  // Error Rate Display
  const errorRateDisplay = grid.set(6, 0, 3, 4, blessed.box, {
    label: 'Error Rate',
    content: '{center}5%{/center}\n{center}🟢 Low{/center}\n{center}7 errors{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  // Response Time Display
  const responseTimeDisplay = grid.set(6, 4, 3, 4, blessed.box, {
    label: 'Avg Response Time',
    content: '{center}2.3s{/center}\n{center}🟡 Normal{/center}\n{center}Target: <3s{/center}',
    border: { type: 'line', fg: 'yellow' },
    style: { fg: 'yellow', bold: true },
    tags: true
  });

  // Token Usage Display
  const tokenUsageDisplay = grid.set(6, 8, 3, 4, blessed.box, {
    label: 'Token Usage',
    content: '{center}45%{/center}\n{center}🟢 Normal{/center}\n{center}45K tokens{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  // Agent Activity Log
  const agentLog = grid.set(9, 0, 3, 12, contrib.log, {
    fg: 'cyan',
    selectedFg: 'cyan',
    label: 'Agent Activity Log'
  });

  const agentLogEntries = [
    '15:32:28 - Claude: Completed code generation for task 5.1',
    '15:32:15 - GPT-4: Started processing task 7 (database migration)',
    '15:31:52 - Claude: Token usage: 1,247 tokens (code), 523 tokens (response)',
    '15:31:33 - Gemini: Entered idle state, waiting for next task',
    '15:31:18 - Claude: Performance metrics updated (+2% efficiency)',
    '15:30:55 - GPT-4: Connected successfully, ready for tasks',
    '15:30:42 - Claude: Error rate decreased to 3% (from 7%)',
    '15:30:21 - Gemini: Completed task 4 successfully',
    '15:29:58 - System: Agent health check completed - all agents healthy'
  ];

  agentLogEntries.forEach(entry => agentLog.log(entry));

  screen.render();
}

/**
 * Create System Stats Dashboard Page
 */
function createSystemStatsPage(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}⚙️ SYSTEM PERFORMANCE MONITORING{/center}',
    style: {
      fg: 'white',
      bg: 'red',
      bold: true
    },
    tags: true
  });

  // System Resource Status Displays
  const cpuDisplay = grid.set(1, 0, 3, 3, blessed.box, {
    label: 'CPU Usage',
    content: '{center}65%{/center}\n{center}🟡 Normal{/center}\n{center}4 cores{/center}',
    border: { type: 'line', fg: 'yellow' },
    style: { fg: 'yellow', bold: true },
    tags: true
  });

  const memoryDisplay = grid.set(1, 3, 3, 3, blessed.box, {
    label: 'Memory',
    content: '{center}8.2/16 GB{/center}\n{center}🟢 Good{/center}\n{center}51% used{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  const diskDisplay = grid.set(1, 6, 3, 3, blessed.box, {
    label: 'Disk Space',
    content: '{center}245/500 GB{/center}\n{center}🟢 Good{/center}\n{center}49% used{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  const networkDisplay = grid.set(1, 9, 3, 3, blessed.box, {
    label: 'Network I/O',
    content: '{center}78 MB/s{/center}\n{center}🔴 High{/center}\n{center}Active{/center}',
    border: { type: 'line', fg: 'red' },
    style: { fg: 'red', bold: true },
    tags: true
  });

  // System Load Chart
  const systemLoad = grid.set(4, 0, 4, 6, contrib.line, {
    style: {
      line: 'yellow',
      text: 'green',
      baseline: 'black'
    },
    xLabelPadding: 3,
    xPadding: 5,
    label: 'System Load Average'
  });

  const loadData = [
    {
      title: '1min',
      x: ['15:27', '15:28', '15:29', '15:30', '15:31', '15:32'],
      y: [1.2, 1.5, 1.8, 1.4, 1.6, 1.3],
      style: { line: 'red' }
    },
    {
      title: '5min',
      x: ['15:27', '15:28', '15:29', '15:30', '15:31', '15:32'],
      y: [1.1, 1.3, 1.4, 1.2, 1.3, 1.2],
      style: { line: 'green' }
    },
    {
      title: '15min',
      x: ['15:27', '15:28', '15:29', '15:30', '15:31', '15:32'],
      y: [0.8, 0.9, 1.0, 0.9, 1.0, 0.9],
      style: { line: 'blue' }
    }
  ];
  systemLoad.setData(loadData);

  // Process Information
  const processInfo = grid.set(4, 6, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Top Processes',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 1,
    columnWidth: [8, 15, 8, 8, 8]
  });

  processInfo.setData({
    headers: ['PID', 'Process', 'CPU%', 'MEM%', 'Time'],
    data: [
      ['1234', 'node (flow)', '12.5', '8.2', '0:23:45'],
      ['5678', 'claude-agent', '8.1', '6.4', '0:15:32'],
      ['9012', 'gemini-agent', '3.2', '4.1', '0:08:17'],
      ['3456', 'gpt4-agent', '5.7', '5.8', '0:12:29'],
      ['7890', 'blessed-tui', '2.1', '1.9', '0:05:43']
    ]
  });

  // System Information
  const systemInfo = grid.set(8, 0, 4, 6, blessed.box, {
    label: 'System Information',
    content: [
      'Hostname: taskmaster-dev',
      'OS: macOS 14.5.0 (Darwin)',
      'Architecture: arm64',
      'Node.js: v20.10.0',
      'npm: v10.2.3',
      '',
      'Task Master Flow: v2.1.0',
      'blessed-contrib: v4.11.0',
      'Uptime: 2 days, 14 hours',
      '',
      'Active Connections: 3',
      'Cache Size: 124 MB',
      'Queue Size: 7 tasks'
    ].join('\n'),
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green' },
    scrollable: true,
    alwaysScroll: true
  });

  // API Statistics
  const apiStats = grid.set(8, 6, 4, 6, blessed.box, {
    label: 'API Statistics',
    content: [
      'Total Requests: 1,247',
      'Successful: 1,186 (95.1%)',
      'Failed: 61 (4.9%)',
      '',
      'Average Response Time: 2.3s',
      'Peak Response Time: 8.7s',
      'Min Response Time: 0.8s',
      '',
      'Tokens Used Today: 45,321',
      'Estimated Cost: $2.15',
      '',
      'Rate Limit: 60/min',
      'Current Rate: 18/min',
      'Next Reset: 15:35:00'
    ].join('\n'),
    border: { type: 'line', fg: 'blue' },
    style: { fg: 'blue' },
    scrollable: true,
    alwaysScroll: true
  });

  screen.render();
} 

/**
 * Create Tasks Dashboard Page (Main view)
 */
function createTasksDashboardPage(screen, projectRoot) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  // Get real task data
  const taskData = loadTaskData(projectRoot);
  
  // Create grid layout
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Status filter state
  let currentStatusFilter = 'all';
  const statusFilters = ['all', 'pending', 'in-progress', 'done', 'blocked', 'deferred'];
  let currentFilterIndex = 0;

  // Title with current filter
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: `{center}📊 TASK MASTER - TASKS DASHBOARD (Filter: ${currentStatusFilter.toUpperCase()}){/center}`,
    style: {
      fg: 'white',
      bg: 'blue',
      bold: true
    },
    tags: true
  });

  // Project Dashboard (Left side)
  const projectDashboard = grid.set(1, 0, 4, 6, blessed.box, {
    label: 'Project Dashboard',
    content: generateProjectDashboardContent(taskData),
    border: { type: 'line', fg: 'blue' },
    style: { fg: 'white' },
    tags: true,
    scrollable: true
  });

  // Dependency Status & Next Task (Right side)
  const dependencyStatus = grid.set(1, 6, 4, 6, blessed.box, {
    label: 'Dependency Status & Next Task',
    content: generateDependencyStatusContent(taskData),
    border: { type: 'line', fg: 'magenta' },
    style: { fg: 'white' },
    tags: true,
    scrollable: true
  });

  // Create task status bar chart (simplified, avoiding potential stackedBar issues)
  const taskStatusChart = grid.set(5, 0, 2, 12, contrib.bar, {
    label: 'Task Status Distribution',
    barWidth: 6,
    barSpacing: 8,
    xOffset: 0,
    maxHeight: 9
  });

  // Update bar chart with real data
  try {
    taskStatusChart.setData({
      titles: ['Done', 'Progress', 'Pending', 'Blocked', 'Deferred'],
      data: [
        taskData.stats?.completed || 0, 
        taskData.stats?.inProgress || 0, 
        taskData.stats?.pending || 0, 
        taskData.stats?.blocked || 0, 
        taskData.stats?.deferred || 0
      ]
    });
  } catch (error) {
    console.error('Error setting chart data:', error.message);
  }

  // Create filterable task table
  const taskTable = createFilterableTaskTable(grid, taskData, currentStatusFilter);

  // Add keyboard controls for table navigation and filtering
  // Use table's built-in key handling instead of screen-level handlers
  taskTable.key(['up', 'k'], () => {
    try {
      taskTable.up();
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  taskTable.key(['down', 'j'], () => {
    try {
      taskTable.down();
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  taskTable.key(['pageup'], () => {
    try {
      taskTable.scroll(-5);
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  taskTable.key(['pagedown'], () => {
    try {
      taskTable.scroll(5);
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  taskTable.key(['home'], () => {
    try {
      taskTable.scrollTo(0);
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  taskTable.key(['end'], () => {
    try {
      const tableData = taskTable.data || [];
      if (tableData.length > 0) {
        taskTable.scrollTo(tableData.length - 1);
      }
      screen.render();
    } catch (error) {
      // Silently handle errors to prevent spam
    }
  });

  // Add keyboard controls for status filtering
  screen.key(['f', 'F'], () => {
    try {
      // Cycle through status filters
      currentFilterIndex = (currentFilterIndex + 1) % statusFilters.length;
      currentStatusFilter = statusFilters[currentFilterIndex];
      
      // Update title
      title.setContent(`{center}📊 TASK MASTER - TASKS DASHBOARD (Filter: ${currentStatusFilter.toUpperCase()}){/center}`);
      
      // Update task table
      updateTaskTable(taskTable, taskData, currentStatusFilter);
      
      screen.render();
    } catch (error) {
      console.error('Error in filter toggle:', error.message);
    }
  });

  // Add help text with timestamp
  const timestamp = new Date().toLocaleTimeString();
  const helpBox = grid.set(11, 0, 1, 12, blessed.box, {
    content: `{center}↑/↓/J/K: Scroll tasks | PgUp/PgDn: Fast scroll | Home/End: Top/Bottom | F: Filter | ←/→: Pages | Q/ESC: Exit | Updated: ${timestamp}{/center}`,
    style: { fg: 'gray' },
    tags: true
  });

  screen.render();

  // Set up auto-refresh for real-time monitoring
  const refreshInterval = setInterval(() => {
    try {
      const newTaskData = loadTaskData(projectRoot);
      projectDashboard.setContent(generateProjectDashboardContent(newTaskData));
      dependencyStatus.setContent(generateDependencyStatusContent(newTaskData));
      updateTaskTable(taskTable, newTaskData, currentStatusFilter);
      
      // Update bar chart
      try {
        taskStatusChart.setData({
          titles: ['Done', 'Progress', 'Pending', 'Blocked', 'Deferred'],
          data: [
            newTaskData.stats?.completed || 0, 
            newTaskData.stats?.inProgress || 0, 
            newTaskData.stats?.pending || 0, 
            newTaskData.stats?.blocked || 0, 
            newTaskData.stats?.deferred || 0
          ]
        });
      } catch (error) {
        console.error('Error updating chart:', error.message);
      }
      
      // Update timestamp
      const newTimestamp = new Date().toLocaleTimeString();
      helpBox.setContent(`{center}↑/↓/J/K: Scroll tasks | PgUp/PgDn: Fast scroll | Home/End: Top/Bottom | F: Filter | ←/→: Pages | Q/ESC: Exit | Updated: ${newTimestamp}{/center}`);
      
      screen.render();
    } catch (error) {
      // Silently handle refresh errors
      console.error('Refresh error:', error.message);
    }
  }, 5000); // Refresh every 5 seconds

  // Cleanup interval when screen is destroyed or when page changes
  const cleanup = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  };
  
  screen.on('destroy', cleanup);
  screen.on('detach', cleanup);

  // Return references for updates
  return {
    projectDashboard,
    dependencyStatus,
    taskTable,
    taskStatusChart,
    title,
    helpBox,
    refreshInterval,
    refreshData: () => {
      const newTaskData = loadTaskData(projectRoot);
      projectDashboard.setContent(generateProjectDashboardContent(newTaskData));
      dependencyStatus.setContent(generateDependencyStatusContent(newTaskData));
      updateTaskTable(taskTable, newTaskData, currentStatusFilter);
      
      // Update bar chart
      try {
        taskStatusChart.setData({
          titles: ['Done', 'Progress', 'Pending', 'Blocked', 'Deferred'],
          data: [
            newTaskData.stats?.completed || 0, 
            newTaskData.stats?.inProgress || 0, 
            newTaskData.stats?.pending || 0, 
            newTaskData.stats?.blocked || 0, 
            newTaskData.stats?.deferred || 0
          ]
        });
      } catch (error) {
        console.error('Error updating chart in refreshData:', error.message);
      }
      
      screen.render();
    }
  };
} 

/**
 * Create VibeKit Main Dashboard Page (5th screen)
 */
function createVibeKitMainDashboard(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🎯 VIBEKIT MAIN DASHBOARD{/center}',
    style: {
      fg: 'white',
      bg: 'cyan',
      bold: true
    },
    tags: true
  });

  // Agent Activity Line Chart (top left)
  const agentActivity = grid.set(1, 0, 4, 6, contrib.line, {
    style: {
      line: "yellow",
      text: "green",
      baseline: "black"
    },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: true,
    wholeNumbersOnly: false,
    label: 'Agent Activity (Requests/min)'
  });

  // Sandbox Status Donut (top right)
  const sandboxStatus = grid.set(1, 6, 4, 3, contrib.donut, {
    label: 'Sandbox Status',
    radius: 8,
    arcWidth: 3,
    remainColor: 'black',
    yPadding: 2,
    data: [
      {percent: 60, label: 'Active', color: 'green'},
      {percent: 25, label: 'Starting', color: 'yellow'},
      {percent: 10, label: 'Stopping', color: 'blue'},
      {percent: 5, label: 'Failed', color: 'red'}
    ]
  });

  // Git Operations Bar Chart (top right)
  const gitOps = grid.set(1, 9, 4, 3, contrib.bar, {
    label: 'Git Operations (Last Hour)',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 0,
    maxHeight: 9
  });

  // Live Request Log (middle)
  const requestLog = grid.set(5, 0, 4, 8, contrib.log, {
    fg: "green",
    selectedFg: "green",
    label: 'Live Agent Requests',
    height: "100%",
    tags: true,
    border: {type: "line", fg: "cyan"}
  });

  // Metrics Table (middle right)
  const metricsTable = grid.set(5, 8, 4, 4, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: true,
    label: 'Key Metrics',
    width: '30%',
    height: '30%',
    border: {type: "line", fg: "cyan"},
    columnSpacing: 3,
    columnWidth: [20, 12]
  });

  // Error Rate Gauge (bottom left)
  const errorGauge = grid.set(9, 0, 3, 3, contrib.gauge, {
    label: 'Error Rate %',
    stroke: 'green',
    fill: 'white',
    width: '100%',
    height: '100%',
    percent: 0
  });

  // Response Time Sparkline (bottom middle)
  const responseTime = grid.set(9, 3, 2, 6, contrib.sparkline, {
    label: 'Response Time (ms)',
    tags: true,
    style: {fg: 'blue'}
  });

  // Environment Health LCD (bottom middle)
  const envHealth = grid.set(11, 3, 1, 6, contrib.lcd, {
    segmentWidth: 0.06,
    segmentInterval: 0.11,
    strokeWidth: 0.11,
    elements: 4,
    display: 3254,
    elementSpacing: 4,
    elementPadding: 2,
    color: 'green',
    label: 'Healthy Environments'
  });

  // Status Map (bottom right)
  const statusMap = grid.set(9, 9, 3, 3, contrib.map, {
    label: 'Regional Status'
  });

  // Initialize with sample data
  const sampleTelemetryData = {
    timestamps: ['00:00', '00:05', '00:10', '00:15', '00:20'],
    codexRequests: [12, 15, 18, 14, 20],
    claudeRequests: [8, 10, 12, 11, 15],
    gitCommits: 45,
    gitPRs: 12,
    gitBranches: 8,
    totalRequests: '1,234',
    avgResponse: 342,
    activeSandboxes: '12',
    successRate: 98.5,
    cacheHitRate: 76.2,
    errorRate: 1.5,
    responseTimes: [320, 345, 310, 380, 342, 325, 360],
    healthyEnvironments: 12,
    latestRequest: `{green-fg}[${new Date().toISOString()}]{/green-fg} Agent: Codex | Action: Generate | Status: Success | Duration: 342ms`
  };

  // Update function
  const updateDashboard = (telemetryData = sampleTelemetryData) => {
    // Update agent activity line chart
    const activityData = {
      title: 'Codex',
      x: telemetryData.timestamps,
      y: telemetryData.codexRequests,
      style: {line: 'yellow'}
    };
    const claudeData = {
      title: 'Claude',
      x: telemetryData.timestamps,
      y: telemetryData.claudeRequests,
      style: {line: 'cyan'}
    };
    agentActivity.setData([activityData, claudeData]);

    // Update git operations
    gitOps.setData({
      titles: ['Commits', 'PRs', 'Branches'],
      data: [
        telemetryData.gitCommits || 0,
        telemetryData.gitPRs || 0,
        telemetryData.gitBranches || 0
      ]
    });

    // Update metrics table
    metricsTable.setData({
      headers: ['Metric', 'Value'],
      data: [
        ['Total Requests', telemetryData.totalRequests || '0'],
        ['Avg Response', `${telemetryData.avgResponse || 0}ms`],
        ['Active Sandboxes', telemetryData.activeSandboxes || '0'],
        ['Success Rate', `${telemetryData.successRate || 0}%`],
        ['Cache Hit Rate', `${telemetryData.cacheHitRate || 0}%`]
      ]
    });

    // Update error gauge
    errorGauge.setPercent(telemetryData.errorRate || 0);

    // Update response time sparkline
    try {
      responseTime.setData(['Avg Response Time'], [telemetryData.responseTimes || []]);
    } catch (error) {
      // Handle sparkline data format issues
      console.error('Error updating sparkline:', error.message);
    }

    // Update environment health LCD
    envHealth.setDisplay(telemetryData.healthyEnvironments || 0);

    // Add to request log
    if (telemetryData.latestRequest) {
      requestLog.log(telemetryData.latestRequest);
    }

    screen.render();
  };

  // Initial update
  updateDashboard();

  // Auto-refresh every 2 seconds
  const refreshInterval = setInterval(() => {
    // Generate some dynamic sample data
    const dynamicData = {
      ...sampleTelemetryData,
      codexRequests: sampleTelemetryData.codexRequests.map(v => v + Math.floor(Math.random() * 5) - 2),
      claudeRequests: sampleTelemetryData.claudeRequests.map(v => v + Math.floor(Math.random() * 3) - 1),
      errorRate: Math.random() * 10,
      avgResponse: 300 + Math.floor(Math.random() * 100),
      latestRequest: `{green-fg}[${new Date().toISOString()}]{/green-fg} Agent: ${['Codex', 'Claude', 'GPT-4'][Math.floor(Math.random() * 3)]} | Action: Generate | Status: Success | Duration: ${Math.floor(Math.random() * 500) + 200}ms`
    };
    updateDashboard(dynamicData);
  }, 2000);

  // Cleanup
  const cleanup = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  };
  
  screen.on('destroy', cleanup);
  screen.on('detach', cleanup);

  return {
    updateDashboard,
    refreshInterval,
    components: {
      agentActivity,
      sandboxStatus,
      gitOps,
      requestLog,
      metricsTable,
      errorGauge,
      responseTime,
      envHealth,
      statusMap
    }
  };
} 

/**
 * Create Agent Performance Dashboard Page (6th screen)
 */
function createAgentPerformanceDashboard(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🤖 AGENT PERFORMANCE DASHBOARD{/center}',
    style: {
      fg: 'white',
      bg: 'magenta',
      bold: true
    },
    tags: true
  });

  // Token Usage Stacked Bar (top left)
  const tokenUsage = grid.set(1, 0, 4, 6, contrib.stackedBar, {
    label: 'Token Usage by Agent',
    barWidth: 6,
    barSpacing: 4,
    xOffset: 0,
    height: "40%",
    barBgColor: ['red', 'blue', 'green']
  });

  // Agent Performance Comparison (top right)
  const agentComparison = grid.set(1, 6, 4, 6, contrib.bar, {
    label: 'Agent Performance Metrics',
    barWidth: 4,
    barSpacing: 2,
    xOffset: 0,
    maxHeight: 9
  });

  // Code Generation Success Rate (middle left)
  const successRateChart = grid.set(5, 0, 3, 6, contrib.line, {
    style: {
      line: "green",
      text: "white",
      baseline: "black"
    },
    label: 'Code Generation Success Rate (%)',
    showLegend: true,
    wholeNumbersOnly: false
  });

  // Agent Response Time Distribution (middle right)
  const responseDistribution = grid.set(5, 6, 3, 6, contrib.bar, {
    label: 'Response Time Distribution (ms)',
    barWidth: 3,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 9
  });

  // Error Analysis Table (bottom left)
  const errorTable = grid.set(8, 0, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'red',
    interactive: true,
    label: 'Recent Agent Errors',
    width: '30%',
    height: '30%',
    border: {type: "line", fg: "red"},
    columnSpacing: 2,
    columnWidth: [20, 15, 30]
  });

  // Agent Activity Feed (bottom right)
  const activityFeed = grid.set(8, 6, 4, 6, contrib.log, {
    fg: "cyan",
    selectedFg: "cyan",
    label: 'Agent Activity Feed',
    height: "100%",
    tags: true,
    border: {type: "line", fg: "cyan"}
  });

  // Get sample agent data
  const agentData = getAgentTelemetryData();

  // Update all components with data
  tokenUsage.setData({
    barCategory: ['Input', 'Output', 'Total'],
    stackedCategory: ['Codex', 'Claude'],
    data: [
      [agentData.codexInputTokens || 0, agentData.claudeInputTokens || 0],
      [agentData.codexOutputTokens || 0, agentData.claudeOutputTokens || 0],
      [agentData.codexTotalTokens || 0, agentData.claudeTotalTokens || 0]
    ]
  });

  agentComparison.setData({
    titles: ['Avg Time', 'Success %', 'Complexity'],
    data: [
      agentData.avgResponseTime || 0,
      agentData.successRate || 0,
      agentData.avgComplexity || 0
    ]
  });

  const codexSuccess = {
    title: 'Codex',
    x: agentData.timeLabels,
    y: agentData.codexSuccessRates,
    style: {line: 'yellow'}
  };
  const claudeSuccess = {
    title: 'Claude',
    x: agentData.timeLabels,
    y: agentData.claudeSuccessRates,
    style: {line: 'cyan'}
  };
  successRateChart.setData([codexSuccess, claudeSuccess]);

  responseDistribution.setData({
    titles: ['0-100', '100-300', '300-500', '500-1000', '1000+'],
    data: agentData.responseTimeBuckets || [0, 0, 0, 0, 0]
  });

  errorTable.setData({
    headers: ['Time', 'Agent', 'Error'],
    data: agentData.recentErrors || []
  });

  if (agentData.activities) {
    agentData.activities.forEach(activity => {
      activityFeed.log(activity);
    });
  }

  screen.render();
  
  return {
    screen,
    components: {
      tokenUsage,
      agentComparison,
      successRateChart,
      responseDistribution,
      errorTable,
      activityFeed
    }
  };
}

/**
 * Get agent telemetry data (sample data for now)
 */
function getAgentTelemetryData() {
  return {
    codexInputTokens: 15000,
    claudeInputTokens: 12000,
    codexOutputTokens: 8000,
    claudeOutputTokens: 9000,
    codexTotalTokens: 23000,
    claudeTotalTokens: 21000,
    avgResponseTime: 450,
    successRate: 96.5,
    avgComplexity: 7.2,
    timeLabels: ['00:00', '00:05', '00:10', '00:15', '00:20'],
    codexSuccessRates: [95, 96, 97, 95, 98],
    claudeSuccessRates: [94, 95, 96, 97, 96],
    responseTimeBuckets: [20, 45, 25, 8, 2],
    recentErrors: [
      ['10:23:45', 'Codex', 'Timeout: Generation exceeded 30s'],
      ['10:21:12', 'Claude', 'Rate limit exceeded'],
      ['10:19:33', 'Codex', 'Invalid syntax in response'],
      ['10:15:21', 'Claude', 'Context length exceeded']
    ],
    activities: [
      `{green-fg}[${new Date().toISOString()}]{/green-fg} Codex: Generated React component (450ms)`,
      `{yellow-fg}[${new Date().toISOString()}]{/yellow-fg} Claude: Code review completed (320ms)`,
      `{cyan-fg}[${new Date().toISOString()}]{/cyan-fg} Codex: Unit tests generated (680ms)`
    ]
  };
} 

/**
 * Create Sandbox Operations Dashboard Page (7th screen)
 */
function createSandboxOperationsDashboard(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🏗️ SANDBOX OPERATIONS DASHBOARD{/center}',
    style: {
      fg: 'white',
      bg: 'yellow',
      bold: true
    },
    tags: true
  });

  // Sandbox Lifecycle Chart (top left)
  const lifecycleChart = grid.set(1, 0, 4, 8, contrib.line, {
    style: {
      line: "yellow",
      text: "green",
      baseline: "black"
    },
    label: 'Sandbox Lifecycle (Create/Teardown per minute)',
    showLegend: true,
    wholeNumbersOnly: true,
    xLabelPadding: 3
  });

  // Sandbox Provider Distribution (top right)
  const providerDonut = grid.set(1, 8, 4, 4, contrib.donut, {
    label: 'Sandbox Providers',
    radius: 8,
    arcWidth: 3,
    remainColor: 'black',
    yPadding: 2,
    data: [
      {percent: 45, label: 'E2B', color: 'green'},
      {percent: 30, label: 'Daytona', color: 'blue'},
      {percent: 15, label: 'Modal', color: 'yellow'},
      {percent: 10, label: 'Fly.io', color: 'magenta'}
    ]
  });

  // Resource Usage Gauges (middle)
  const cpuGauge = grid.set(5, 0, 3, 3, contrib.gauge, {
    label: 'CPU Usage %',
    stroke: 'green',
    fill: 'white',
    percent: 0
  });

  const memoryGauge = grid.set(5, 3, 3, 3, contrib.gauge, {
    label: 'Memory Usage %',
    stroke: 'yellow',
    fill: 'white',
    percent: 0
  });

  const diskGauge = grid.set(5, 6, 3, 3, contrib.gauge, {
    label: 'Disk Usage %',
    stroke: 'red',
    fill: 'white',
    percent: 0
  });

  // Active Sandboxes List (middle right)
  const activeSandboxes = grid.set(5, 9, 3, 3, blessed.list, {
    label: 'Active Sandboxes',
    align: 'left',
    height: '100%',
    width: '100%',
    selectedBg: 'blue',
    selectedFg: 'white',
    fg: 'green',
    keys: true,
    vi: true,
    border: {type: "line", fg: "cyan"}
  });

  // Sandbox Performance Metrics (bottom left)
  const performanceTable = grid.set(8, 0, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: true,
    label: 'Sandbox Performance Metrics',
    width: '30%',
    height: '30%',
    border: {type: "line", fg: "cyan"},
    columnSpacing: 3,
    columnWidth: [20, 10, 10, 10]
  });

  // Sandbox Event Log (bottom right)
  const eventLog = grid.set(8, 6, 4, 6, contrib.log, {
    fg: "green",
    selectedFg: "green",
    label: 'Sandbox Events',
    height: "100%",
    tags: true,
    border: {type: "line", fg: "cyan"}
  });

  // Get sample sandbox data
  const sandboxData = getSandboxTelemetryData();

  // Update all components with data - add error handling
  try {
    const createData = {
      title: 'Created',
      x: sandboxData.timeLabels,
      y: sandboxData.sandboxesCreated,
      style: {line: 'green'}
    };
    const teardownData = {
      title: 'Teardown',
      x: sandboxData.timeLabels,
      y: sandboxData.sandboxesTeardown,
      style: {line: 'red'}
    };
    const activeData = {
      title: 'Active',
      x: sandboxData.timeLabels,
      y: sandboxData.activeSandboxCount,
      style: {line: 'yellow'}
    };
    
    // Only set data if the component exists and screen is ready
    if (lifecycleChart && screen.width) {
      lifecycleChart.setData([createData, teardownData, activeData]);
    }

    // Update resource gauges
    cpuGauge.setPercent(sandboxData.avgCpuUsage || 0);
    memoryGauge.setPercent(sandboxData.avgMemoryUsage || 0);
    diskGauge.setPercent(sandboxData.avgDiskUsage || 0);

    // Update active sandboxes list
    activeSandboxes.setItems(sandboxData.activeSandboxList || []);

    // Update performance table
    performanceTable.setData({
      headers: ['Metric', 'Min', 'Avg', 'Max'],
      data: [
        ['Startup Time (s)', '1.2', '2.5', '5.8'],
        ['Teardown Time (s)', '0.5', '1.1', '2.3'],
        ['Exec Time (ms)', '50', '150', '800'],
        ['Memory (MB)', '128', '256', '512'],
        ['Network I/O (KB/s)', '10', '45', '120']
      ]
    });

    // Update event log
    if (sandboxData.events) {
      sandboxData.events.forEach(event => {
        eventLog.log(event);
      });
    }
  } catch (error) {
    // If there's an error updating components, just continue without crashing
    console.error('Error updating sandbox dashboard:', error.message);
  }

  screen.render();
  
  return {
    screen,
    components: {
      lifecycleChart,
      providerDonut,
      cpuGauge,
      memoryGauge,
      diskGauge,
      activeSandboxes,
      performanceTable,
      eventLog
    }
  };
}

/**
 * Get sandbox telemetry data (sample data for now)
 */
function getSandboxTelemetryData() {
  return {
    timeLabels: ['00:00', '00:05', '00:10', '00:15', '00:20'],
    sandboxesCreated: [5, 8, 12, 6, 10],
    sandboxesTeardown: [3, 6, 10, 8, 7],
    activeSandboxCount: [10, 12, 14, 12, 15],
    avgCpuUsage: 65,
    avgMemoryUsage: 72,
    avgDiskUsage: 45,
    activeSandboxList: [
      'sandbox-001 (E2B) - 2m 15s',
      'sandbox-002 (Daytona) - 1m 42s',
      'sandbox-003 (Modal) - 45s',
      'sandbox-004 (E2B) - 3m 21s',
      'sandbox-005 (Fly.io) - 1m 08s'
    ],
    events: [
      `{green-fg}[${new Date().toISOString()}]{/green-fg} Sandbox created: ID=sandbox-006, Provider=E2B`,
      `{yellow-fg}[${new Date().toISOString()}]{/yellow-fg} Resource limit warning: sandbox-003 approaching memory limit`,
      `{red-fg}[${new Date().toISOString()}]{/red-fg} Sandbox teardown: ID=sandbox-001, Duration=5m 32s`,
      `{cyan-fg}[${new Date().toISOString()}]{/cyan-fg} Code execution: sandbox-004, File=test.py, Status=Success`
    ]
  };
} 

/**
 * Create Git Operations Dashboard Page (8th screen)
 */
function createGitOperationsDashboard(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}🌿 GIT OPERATIONS DASHBOARD{/center}',
    style: {
      fg: 'white',
      bg: 'green',
      bold: true
    },
    tags: true
  });

  // Git Operations Timeline (top)
  const gitTimeline = grid.set(1, 0, 3, 12, contrib.line, {
    style: {
      line: "yellow",
      text: "green",
      baseline: "black"
    },
    label: 'Git Operations Over Time',
    showLegend: true,
    wholeNumbersOnly: true,
    xLabelPadding: 3
  });

  // Repository Activity Heatmap (middle left)
  const repoHeatmap = grid.set(4, 0, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: true,
    label: 'Repository Activity Heatmap',
    width: '30%',
    height: '30%',
    border: {type: "line", fg: "cyan"},
    columnSpacing: 2,
    columnWidth: [20, 8, 8, 8, 8]
  });

  // PR Status Distribution (middle right)
  const prStatus = grid.set(4, 6, 4, 3, contrib.donut, {
    label: 'Pull Request Status',
    radius: 8,
    arcWidth: 3,
    remainColor: 'black',
    yPadding: 2,
    data: [
      {percent: 40, label: 'Open', color: 'green'},
      {percent: 35, label: 'Merged', color: 'blue'},
      {percent: 15, label: 'Review', color: 'yellow'},
      {percent: 10, label: 'Closed', color: 'red'}
    ]
  });

  // Branch Operations (middle right)
  const branchOps = grid.set(4, 9, 4, 3, contrib.bar, {
    label: 'Branch Operations Today',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 0,
    maxHeight: 9
  });

  // Commit Analysis (bottom left)
  const commitAnalysis = grid.set(8, 0, 4, 6, contrib.stackedBar, {
    label: 'Commit Analysis by Type',
    barWidth: 6,
    barSpacing: 4,
    xOffset: 0,
    height: "40%",
    barBgColor: ['red', 'blue', 'green', 'yellow']
  });

  // Git Event Feed (bottom right)
  const gitEventFeed = grid.set(8, 6, 4, 6, contrib.log, {
    fg: "green",
    selectedFg: "green",
    label: 'Git Event Feed',
    height: "100%",
    tags: true,
    border: {type: "line", fg: "cyan"}
  });

  // Get sample git data
  const gitData = getGitTelemetryData();

  // Update all components with data - add error handling
  try {
    const commitsData = {
      title: 'Commits',
      x: gitData.timeLabels,
      y: gitData.commits,
      style: {line: 'green'}
    };
    const prsData = {
      title: 'PRs',
      x: gitData.timeLabels,
      y: gitData.pullRequests,
      style: {line: 'yellow'}
    };
    const branchesData = {
      title: 'Branches',
      x: gitData.timeLabels,
      y: gitData.branches,
      style: {line: 'cyan'}
    };
    
    // Only set data if the component exists and screen is ready
    if (gitTimeline && screen.width) {
      gitTimeline.setData([commitsData, prsData, branchesData]);
    }

    // Update repository heatmap
    repoHeatmap.setData({
      headers: ['Repository', 'Mon', 'Tue', 'Wed', 'Thu'],
      data: gitData.repoActivity || [
        ['main-app', '15', '22', '18', '25'],
        ['api-service', '8', '12', '10', '14'],
        ['frontend', '20', '25', '30', '28'],
        ['docs', '5', '3', '8', '6']
      ]
    });

    // Update branch operations
    branchOps.setData({
      titles: ['Create', 'Merge', 'Delete'],
      data: gitData.branchOperations || [8, 12, 5]
    });

    // Update commit analysis
    commitAnalysis.setData({
      barCategory: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      stackedCategory: ['Feature', 'Fix', 'Docs', 'Refactor'],
      data: gitData.commitTypes || [
        [5, 3, 2, 1],
        [6, 4, 1, 2],
        [8, 2, 3, 3],
        [4, 5, 2, 1],
        [7, 3, 1, 2]
      ]
    });

    // Update git event feed
    if (gitData.events) {
      gitData.events.forEach(event => {
        gitEventFeed.log(event);
      });
    }
  } catch (error) {
    // If there's an error updating components, just continue without crashing
    console.error('Error updating git dashboard:', error.message);
  }

  screen.render();
  
  return {
    screen,
    components: {
      gitTimeline,
      repoHeatmap,
      prStatus,
      branchOps,
      commitAnalysis,
      gitEventFeed
    }
  };
}

/**
 * Get git telemetry data (sample data for now)
 */
function getGitTelemetryData() {
  return {
    timeLabels: ['00:00', '00:15', '00:30', '00:45', '01:00'],
    commits: [12, 15, 8, 20, 18],
    pullRequests: [2, 3, 1, 4, 3],
    branches: [1, 2, 1, 3, 2],
    repoActivity: [
      ['vibekit-core', '15', '22', '18', '25'],
      ['vibekit-ui', '8', '12', '10', '14'],
      ['vibekit-docs', '5', '3', '8', '6'],
      ['vibekit-tests', '10', '15', '12', '18']
    ],
    branchOperations: [8, 12, 5],
    commitTypes: [
      [5, 3, 2, 1],
      [6, 4, 1, 2],
      [8, 2, 3, 3],
      [4, 5, 2, 1],
      [7, 3, 1, 2]
    ],
    events: [
      `{green-fg}[${new Date().toISOString()}]{/green-fg} Commit: feat(sandbox): Add timeout configuration`,
      `{yellow-fg}[${new Date().toISOString()}]{/yellow-fg} PR #123: Code review requested by @agent`,
      `{cyan-fg}[${new Date().toISOString()}]{/cyan-fg} Branch created: feature/telemetry-improvements`,
      `{blue-fg}[${new Date().toISOString()}]{/blue-fg} PR #121: Merged into main`,
      `{red-fg}[${new Date().toISOString()}]{/red-fg} Branch deleted: fix/memory-leak`
    ]
  };
} 