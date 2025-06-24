/**
 * CLI wrapper for the Flow TUI
 * This wrapper uses tsx to handle JSX transpilation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Launch the Flow TUI using tsx
 * @param {Object} options - Command options
 */
export async function launchFlow(options = {}) {
  return new Promise((resolve, reject) => {
    // Path to the main flow app
    const flowAppPath = path.join(__dirname, 'index.jsx');
    
    // Prepare environment variables
    const env = { ...process.env };
    if (options.backend) {
      env.TASKMASTER_BACKEND = options.backend;
    }
    
    // Ensure terminal is interactive
    env.FORCE_COLOR = '1';
    
    // Use npx tsx directly with proper TTY settings
    const args = ['tsx', flowAppPath];
    
    const proc = spawn('npx', args, {
      stdio: 'inherit',
      env,
      cwd: process.cwd(),
      shell: true
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to launch Flow TUI: ${error.message}`));
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Flow TUI exited with code ${code}`));
      }
    });
  });
} 