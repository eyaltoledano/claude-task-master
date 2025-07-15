/**
 * Fallback Text-Based Monitor
 * Simple console-based monitoring when terminal is too small
 */

import chalk from 'chalk';
import { loadTaskData } from './monitor.command.js'; // Assuming we can reuse this

/**
 * Launch the fallback text-based monitor
 */
export function launchFallbackMonitor() {
  console.log(chalk.cyan('🖥️  Task Master Flow Text Monitor'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(chalk.yellow('Note: Full dashboard requires larger terminal'));
  console.log(chalk.gray('Press Ctrl+C to exit\n'));

  // Initial display
  displayTaskSummary();

  // Refresh every 5 seconds
  const interval = setInterval(displayTaskSummary, 5000);

  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(chalk.green('\n👋 Text monitor closed'));
    process.exit(0);
  });
}

/**
 * Display task summary in text format
 */
function displayTaskSummary() {
  const taskData = loadTaskData(); // Need projectRoot? Assume it's handled in loadTaskData
  const stats = taskData.stats || {};
  
  console.clear();
  console.log(chalk.cyan(`📊 Task Summary - ${new Date().toLocaleTimeString()}`));
  console.log(chalk.gray('━'.repeat(50)));
  
  console.log(chalk.bold('Overall Progress:'));
  console.log(`  Total Tasks: ${stats.total || 0}`);
  console.log(`  Completed: ${stats.completed || 0} (${stats.completionPercentage || 0}%)`);
  console.log(`  In Progress: ${stats.inProgress || 0}`);
  console.log(`  Pending: ${stats.pending || 0}`);
  console.log(`  Blocked: ${stats.blocked || 0}`);
  
  console.log(chalk.bold('\nPriority Breakdown:'));
  // Add priority counts here if available
  
  console.log(chalk.bold('\nNext Task:'));
  // Add next task info
  
  console.log(chalk.gray('\nRefreshing in 5 seconds...'));
} 