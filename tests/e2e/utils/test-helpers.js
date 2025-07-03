import { spawn } from 'child_process';
import { readFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

export class TestHelpers {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Execute a command and return output
   * @param {string} command - Command to execute
   * @param {string[]} args - Command arguments
   * @param {Object} options - Execution options
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  async executeCommand(command, args = [], options = {}) {
    return new Promise((resolve) => {
      const spawnOptions = {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: true
      };

      // When using shell: true, pass the full command as a single string
      const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const child = spawn(fullCommand, [], spawnOptions);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        const output = stdout + stderr;
        
        // Extract and log costs
        this.logger.extractAndAddCost(output);
        
        resolve({ stdout, stderr, exitCode });
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
        }, options.timeout);
      }
    });
  }

  /**
   * Execute task-master command
   * @param {string} subcommand - Task-master subcommand
   * @param {string[]} args - Command arguments
   * @param {Object} options - Execution options
   */
  async taskMaster(subcommand, args = [], options = {}) {
    const fullArgs = [subcommand, ...args];
    this.logger.info(`Executing: task-master ${fullArgs.join(' ')}`);
    
    const result = await this.executeCommand('task-master', fullArgs, options);
    
    if (result.exitCode !== 0 && !options.allowFailure) {
      this.logger.error(`Command failed with exit code ${result.exitCode}`);
      this.logger.error(`stderr: ${result.stderr}`);
    }
    
    return result;
  }

  /**
   * Check if a file exists
   */
  fileExists(filePath) {
    return existsSync(filePath);
  }

  /**
   * Read JSON file
   */
  readJson(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to read JSON file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Copy file
   */
  copyFile(source, destination) {
    try {
      copyFileSync(source, destination);
      return true;
    } catch (error) {
      this.logger.error(`Failed to copy file from ${source} to ${destination}: ${error.message}`);
      return false;
    }
  }

  /**
   * Wait for a specified duration
   */
  async wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Verify task exists in tasks.json
   */
  verifyTaskExists(tasksFile, taskId, tagName = 'master') {
    const tasks = this.readJson(tasksFile);
    if (!tasks || !tasks[tagName]) return false;
    
    return tasks[tagName].tasks.some(task => task.id === taskId);
  }

  /**
   * Get task count for a tag
   */
  getTaskCount(tasksFile, tagName = 'master') {
    const tasks = this.readJson(tasksFile);
    if (!tasks || !tasks[tagName]) return 0;
    
    return tasks[tagName].tasks.length;
  }

  /**
   * Extract task ID from command output
   */
  extractTaskId(output) {
    const patterns = [
      /✓ Added new task #(\d+(?:\.\d+)?)/,
      /✅ New task created successfully:.*?(\d+(?:\.\d+)?)/,
      /Task (\d+(?:\.\d+)?) Created Successfully/
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Run multiple async operations in parallel
   */
  async runParallel(operations) {
    return Promise.all(operations);
  }

  /**
   * Run operations with concurrency limit
   */
  async runWithConcurrency(operations, limit = 3) {
    const results = [];
    const executing = [];
    
    for (const operation of operations) {
      const promise = operation().then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      
      results.push(promise);
      executing.push(promise);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
    
    return Promise.all(results);
  }
}