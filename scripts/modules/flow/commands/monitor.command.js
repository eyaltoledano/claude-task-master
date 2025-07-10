/**
 * Monitor Command
 * Real-time monitoring dashboard using blessed-contrib
 */

import blessed from 'blessed';
import contrib from 'blessed-contrib';
import chalk from 'chalk';
import { findProjectRoot } from '../../utils.js';
import { launchFallbackMonitor } from './monitor-fallback.js';

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
      createOverviewPage,
      createTaskProgressPage,
      createAgentActivityPage,
      createSystemStatsPage
    ];

    // Set up exit handlers
    screen.key(['escape', 'q', 'C-c'], (ch, key) => {
      screen.destroy();
      console.log(chalk.green('\n👋 Monitoring dashboard closed'));
      process.exit(0);
    });

    // Create carousel with auto-rotation and keyboard controls
    const carousel = new contrib.carousel(
      pages,
      {
        screen: screen,
        interval: 10000, // Switch every 10 seconds
        controlKeys: true // Enable left/right arrow key navigation
      }
    );

    // Display instructions
    console.log(chalk.cyan('🖥️  Task Master Flow Monitor'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(chalk.yellow('⌨️  Navigation:'));
    console.log(chalk.gray('   • ←/→ arrows: Switch between dashboards'));
    console.log(chalk.gray('   • q/ESC/Ctrl+C: Exit'));
    console.log(chalk.gray('   • Auto-rotation: Every 10 seconds'));
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
 * Create Overview Dashboard Page
 */
function createOverviewPage(screen) {
  // Clear screen for this page
  screen.children.forEach(child => child.destroy());

  // Create grid layout
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // Title
  const title = grid.set(0, 0, 1, 12, blessed.box, {
    content: '{center}📊 TASK MASTER FLOW - OVERVIEW DASHBOARD{/center}',
    style: {
      fg: 'white',
      bg: 'blue',
      bold: true
    },
    tags: true
  });

  // Task Status Bar Chart (safer than donut for terminal compatibility)
  const taskStatusBar = grid.set(1, 0, 4, 4, contrib.bar, {
    label: 'Task Status Distribution',
    barWidth: 4,
    barSpacing: 6,
    xOffset: 0,
    maxHeight: 9
  });

  taskStatusBar.setData({
    titles: ['Done', 'In Progress', 'Pending', 'Blocked'],
    data: [45, 25, 20, 10]
  });

  // Agent Performance Line Chart
  const agentPerformance = grid.set(1, 4, 4, 8, contrib.line, {
    style: {
      line: 'yellow',
      text: 'green',
      baseline: 'black'
    },
    xLabelPadding: 3,
    xPadding: 5,
    label: 'Agent Performance Over Time',
    showNthLabel: 5
  });

  const lineData = [
    {
      title: 'Claude',
      x: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      y: [85, 92, 88, 95, 91, 89, 94],
      style: { line: 'red' }
    },
    {
      title: 'Gemini',
      x: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      y: [78, 85, 82, 88, 86, 90, 87],
      style: { line: 'blue' }
    },
    {
      title: 'GPT-4',
      x: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      y: [80, 87, 85, 90, 88, 91, 89],
      style: { line: 'green' }
    }
  ];
  agentPerformance.setData(lineData);

  // Active Tasks Table
  const activeTasks = grid.set(5, 0, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Active Tasks',
    width: '50%',
    height: '30%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [8, 20, 12, 10]
  });

  activeTasks.setData({
    headers: ['ID', 'Description', 'Agent', 'Status'],
    data: [
      ['5.1', 'Setup API routes', 'Claude', 'Running'],
      ['5.2', 'Add validation', 'Gemini', 'Queued'],
      ['7', 'Database migration', 'GPT-4', 'Running'],
      ['12.3', 'UI components', 'Claude', 'Queued'],
      ['15', 'Testing suite', 'Gemini', 'Pending']
    ]
  });

  // System Health Status Boxes (safer than gauges)
  const cpuStatus = grid.set(5, 6, 2, 3, blessed.box, {
    label: 'CPU Usage',
    content: '{center}65%{/center}\n{center}🟢 Normal{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  const memoryStatus = grid.set(7, 6, 2, 3, blessed.box, {
    label: 'Memory Usage',
    content: '{center}42%{/center}\n{center}🟢 Good{/center}',
    border: { type: 'line', fg: 'blue' },
    style: { fg: 'blue', bold: true },
    tags: true
  });

  const networkStatus = grid.set(5, 9, 2, 3, blessed.box, {
    label: 'Network I/O',
    content: '{center}78%{/center}\n{center}🟡 High{/center}',
    border: { type: 'line', fg: 'yellow' },
    style: { fg: 'yellow', bold: true },
    tags: true
  });

  const diskStatus = grid.set(7, 9, 2, 3, blessed.box, {
    label: 'Disk Usage',
    content: '{center}34%{/center}\n{center}🟢 Good{/center}',
    border: { type: 'line', fg: 'green' },
    style: { fg: 'green', bold: true },
    tags: true
  });

  // Recent Activity Log
  const activityLog = grid.set(9, 0, 3, 12, contrib.log, {
    fg: 'green',
    selectedFg: 'green',
    label: 'Recent Activity'
  });

  // Add some sample log entries
  const logEntries = [
    '15:32:15 - Task 5.1 completed successfully (Claude)',
    '15:31:42 - Task 7 started execution (GPT-4)',
    '15:30:18 - Code generated for task 12.3 (Claude)',
    '15:29:55 - Subtask 5.2 queued for execution',
    '15:28:33 - Agent Claude: Performance improved +5%',
    '15:27:12 - Network optimization completed',
    '15:26:48 - Memory usage optimized (-12MB)',
    '15:25:21 - New task batch started (3 tasks)',
    '15:24:07 - Agent Gemini: Connected and ready'
  ];

  logEntries.forEach(entry => activityLog.log(entry));

  screen.render();
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