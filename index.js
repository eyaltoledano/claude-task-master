#!/usr/bin/env node

/**
 * Task Master
 * Copyright (c) 2025 Eyal Toledano, Ralph Khreish
 *
 * This software is licensed under the MIT License with Commons Clause.
 * You may use this software for any purpose, including commercial applications,
 * and modify and redistribute it freely, subject to the following restrictions:
 *
 * 1. You may not sell this software or offer it as a service.
 * 2. The origin of this software must not be misrepresented.
 * 3. Altered source versions must be plainly marked as such.
 *
 * For the full license text, see the LICENSE file in the root directory.
 */

/**
 * Claude Task Master
 * A task management system for AI-driven development with Claude
 */

// This file serves as the main entry point for the package
// The primary functionality is provided through the CLI commands

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { Command } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Get package information
const packageJson = require('./package.json');

// Export the path to the dev.js script for programmatic usage
export const devScriptPath = resolve(__dirname, './scripts/dev.js');

// Export a function to initialize a new project programmatically
export const initProject = async (options = {}) => {
  const init = await import('./scripts/init.js');
  return init.initializeProject(options);
};

// Export a function to run init as a CLI command
export const runInitCLI = async () => {
  // Using spawn to ensure proper handling of stdio and process exit
  const child = spawn('node', [resolve(__dirname, './scripts/init.js')], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Init script exited with code ${code}`));
      }
    });
  });
};

// Export version information
export const version = packageJson.version;

// CLI implementation
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = new Command();
  
  program
    .name('task-master')
    .description('Claude Task Master CLI')
    .version(version);
  
  program
    .command('init')
    .description('Initialize a new project')
    .action(() => {
      runInitCLI().catch(err => {
        console.error('Init failed:', err.message);
        process.exit(1);
      });
    });
  
  program
    .command('dev')
    .description('Run the dev.js script')
    .allowUnknownOption(true)
    .action(() => {
      const args = process.argv.slice(process.argv.indexOf('dev') + 1);
      const child = spawn('node', [devScriptPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  // Add shortcuts for common dev.js commands
  program
    .command('list')
    .description('List all tasks')
    .action(() => {
      const child = spawn('node', [devScriptPath, 'list'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  program
    .command('next')
    .description('Show the next task to work on')
    .action(() => {
      const child = spawn('node', [devScriptPath, 'next'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  program
    .command('generate')
    .description('Generate task files')
    .action(() => {
      const child = spawn('node', [devScriptPath, 'generate'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      child.on('close', (code) => {
        process.exit(code);
      });
    });
  
  program.parse(process.argv);
} 