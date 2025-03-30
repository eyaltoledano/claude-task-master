#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 * 
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

import { runCLI } from './modules/commands.js';

// Debug log the incoming arguments
console.log('CLI Arguments:', process.argv);

try {
  // Run the CLI with the process arguments
  runCLI(process.argv);
} catch (err) {
  console.error('Error executing command:', err);
  process.exit(1);
}