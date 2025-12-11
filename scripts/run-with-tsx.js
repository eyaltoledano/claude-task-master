#!/usr/bin/env node

/**
 * Helper script to run a file with tsx
 */

import { spawn } from 'child_process';
import path from 'path';

const scriptPath = process.argv[2];
const scriptArgs = process.argv.slice(3);

if (!scriptPath) {
  console.error('Usage: node run-with-tsx.js <script-path> [args...]');
  process.exit(1);
}

// Use tsx to run the script
const child = spawn('npx', ['tsx', scriptPath, ...scriptArgs], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code);
});