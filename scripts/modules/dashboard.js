/**
 * dashboard.js
 * Functions for launching the Task Master dashboard
 */

import { spawn } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Launch the Task Master dashboard
 * @param {Object} options - Command options
 * @param {number} options.port - Port to run the dashboard on (default: 8080)
 */
export async function launchDashboard(options = {}) {
  const port = options.port || 8080;
  
  console.log(chalk.blue(`Starting Task Master dashboard on port ${port}...`));
  
  // Path to the web UI directory
  const webUiPath = path.resolve(__dirname, '../../mcp-server/web-ui');
  
  // Launch the dashboard using the package.json dev script
  const command = 'cd ' + webUiPath + ' && npm run dev -- --port=' + port;
  
  try {
    // Execute the command
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit'
    });
    
    // Display success message
    console.log(boxen(
      chalk.white.bold('Task Master Dashboard') + '\n\n' +
      chalk.white(`The dashboard is now running at:`) + '\n' +
      chalk.cyan(`http://localhost:${port}`) + '\n\n' +
      chalk.white(`Press Ctrl+C to stop the dashboard`),
      { padding: 1, borderColor: 'green', borderStyle: 'round', margin: { top: 1 } }
    ));
    
    // Keep the process running until Ctrl+C
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nStopping Task Master dashboard...'));
      child.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error(chalk.red(`Error starting dashboard: ${error.message}`));
    process.exit(1);
  }
}

export default {
  launchDashboard
};