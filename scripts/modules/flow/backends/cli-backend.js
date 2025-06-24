import { spawn } from 'child_process';
import { FlowBackend } from '../backend-interface.js';

/**
 * CLI Backend - executes task-master commands as child processes
 */
export class CliBackend extends FlowBackend {
  constructor(options = {}) {
    super(options);
    this.execPath = options.execPath || 'node';
    this.scriptPath = options.scriptPath || 'scripts/dev.js';
  }

  async initialize() {
    // Verify the CLI is accessible
    try {
      await this.runCommand(['--version']);
      return true;
    } catch (error) {
      throw new Error(`Failed to initialize CLI backend: ${error.message}`);
    }
  }

  /**
   * Run a task-master command and return parsed JSON output
   */
  async runCommand(args, options = {}) {
    return new Promise((resolve, reject) => {
      const allArgs = [this.scriptPath, ...args, '--output=json'];
      const proc = spawn(this.execPath, allArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.onData) {
          options.onData(data.toString());
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse JSON output
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.find(line => {
            try {
              JSON.parse(line);
              return true;
            } catch {
              return false;
            }
          });

          if (jsonLine) {
            const result = JSON.parse(jsonLine);
            this.updateTelemetry(result);
            resolve(result);
          } else {
            // Fallback for commands that don't output JSON
            resolve({ output: stdout });
          }
        } catch (error) {
          reject(new Error(`Failed to parse output: ${error.message}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  async listTasks(options = {}) {
    const args = ['list'];
    if (options.status) args.push('--status', options.status);
    if (options.tag) args.push('--tag', options.tag);
    args.push('--with-subtasks');
    
    const result = await this.runCommand(args);
    return {
      tasks: result.tasks || [],
      tag: result.currentTag || 'master',
      telemetryData: result.telemetryData
    };
  }

  async nextTask() {
    const result = await this.runCommand(['next']);
    return {
      task: result.task,
      suggestions: result.suggestions || [],
      telemetryData: result.telemetryData
    };
  }

  async getTask(taskId) {
    const result = await this.runCommand(['show', taskId]);
    return result;
  }

  async setTaskStatus(taskId, status) {
    const result = await this.runCommand(['set-status', '--id', taskId, '--status', status]);
    return result;
  }

  async expandTask(taskId, options = {}) {
    const args = ['expand', '--id', taskId];
    if (options.num) args.push('--num', options.num.toString());
    if (options.research) args.push('--research');
    if (options.force) args.push('--force');
    
    const result = await this.runCommand(args);
    return result;
  }

  async addTask(taskData) {
    const args = ['add-task', '--prompt', taskData.prompt];
    if (taskData.dependencies) args.push('--dependencies', taskData.dependencies);
    if (taskData.priority) args.push('--priority', taskData.priority);
    
    const result = await this.runCommand(args);
    return result;
  }

  async *researchStream(query, options = {}) {
    const args = ['research', query];
    if (options.taskIds) args.push('--id', options.taskIds);
    if (options.detailLevel) args.push('--detail', options.detailLevel);
    
    const chunks = [];
    const onData = (data) => {
      chunks.push(data);
    };

    // Start the research command
    const promise = this.runCommand(args, { onData });
    
    // Yield chunks as they come in
    let lastYieldedIndex = 0;
    while (true) {
      if (chunks.length > lastYieldedIndex) {
        yield chunks[lastYieldedIndex];
        lastYieldedIndex++;
      } else {
        // Check if the command is done
        try {
          await Promise.race([
            promise,
            new Promise(resolve => setTimeout(resolve, 100))
          ]);
          // If we get here, the command finished
          break;
        } catch (error) {
          // Command is still running, continue
        }
      }
    }
    
    // Yield any remaining chunks
    while (lastYieldedIndex < chunks.length) {
      yield chunks[lastYieldedIndex];
      lastYieldedIndex++;
    }
  }

  async listTags() {
    const result = await this.runCommand(['tags']);
    return result.tags || [];
  }

  async useTag(tagName) {
    const result = await this.runCommand(['use-tag', tagName]);
    return result;
  }
} 