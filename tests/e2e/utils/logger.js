import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export class TestLogger {
  constructor(logDir, testRunId) {
    this.logDir = logDir;
    this.testRunId = testRunId;
    this.startTime = Date.now();
    this.stepCount = 0;
    this.logFile = join(logDir, `e2e_run_${testRunId}.log`);
    this.logBuffer = [];
    this.totalCost = 0;

    // Ensure log directory exists
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  }

  getElapsedTime() {
    return this.formatDuration(Date.now() - this.startTime);
  }

  formatLogEntry(level, message) {
    const timestamp = new Date().toISOString();
    const elapsed = this.getElapsedTime();
    return `[${level}] [${elapsed}] ${timestamp} ${message}`;
  }

  log(level, message, options = {}) {
    const formattedMessage = this.formatLogEntry(level, message);
    
    // Add to buffer
    this.logBuffer.push(formattedMessage);
    
    // Console output with colors
    let coloredMessage = formattedMessage;
    switch (level) {
      case 'INFO':
        coloredMessage = chalk.blue(formattedMessage);
        break;
      case 'SUCCESS':
        coloredMessage = chalk.green(formattedMessage);
        break;
      case 'ERROR':
        coloredMessage = chalk.red(formattedMessage);
        break;
      case 'WARNING':
        coloredMessage = chalk.yellow(formattedMessage);
        break;
    }
    
    console.log(coloredMessage);
    
    // Write to file if immediate flush requested
    if (options.flush) {
      this.flush();
    }
  }

  info(message) {
    this.log('INFO', message);
  }

  success(message) {
    this.log('SUCCESS', message);
  }

  error(message) {
    this.log('ERROR', message);
  }

  warning(message) {
    this.log('WARNING', message);
  }

  step(message) {
    this.stepCount++;
    const separator = '='.repeat(45);
    this.log('STEP', `\n${separator}\n  STEP ${this.stepCount}: ${message}\n${separator}`);
  }

  addCost(cost) {
    if (typeof cost === 'number' && !isNaN(cost)) {
      this.totalCost += cost;
    }
  }

  extractAndAddCost(output) {
    const costRegex = /Est\. Cost: \$(\d+\.\d+)/g;
    let match;
    while ((match = costRegex.exec(output)) !== null) {
      const cost = parseFloat(match[1]);
      this.addCost(cost);
    }
  }

  flush() {
    writeFileSync(this.logFile, this.logBuffer.join('\n'), 'utf8');
  }

  getSummary() {
    const duration = this.formatDuration(Date.now() - this.startTime);
    const successCount = this.logBuffer.filter(line => line.includes('[SUCCESS]')).length;
    const errorCount = this.logBuffer.filter(line => line.includes('[ERROR]')).length;
    
    return {
      duration,
      totalSteps: this.stepCount,
      successCount,
      errorCount,
      totalCost: this.totalCost.toFixed(6),
      logFile: this.logFile
    };
  }
}