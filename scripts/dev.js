#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 *
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

import dotenv from 'dotenv';

// Load .env BEFORE any other imports to ensure env vars are available
dotenv.config();

// Add at the very beginning of the file
if (process.env.DEBUG === '1') {
	console.error('DEBUG - dev.js received args:', process.argv.slice(2));
}

// Use dynamic import to ensure dotenv.config() runs before module-level code executes
const { runCLI } = await import('./modules/commands.js');

// Run the CLI with the process arguments
runCLI(process.argv);
