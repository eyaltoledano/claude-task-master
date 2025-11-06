#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 *
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

import dotenv from 'dotenv';
import { findProjectRoot } from '@tm/core';

// Store the original working directory before changing it
// This is needed for commands that take relative paths as arguments
const originalCwd = process.cwd();

// Change to project root so dotenv can find .env from the correct location
// This allows running commands from subdirectories like apps/, packages/, etc.
const projectRoot = findProjectRoot();
process.chdir(projectRoot);

// Load .env - dotenv will now look in the project root
dotenv.config();

// Make original cwd available to commands that need it
process.env.TASKMASTER_ORIGINAL_CWD = originalCwd;

// Add at the very beginning of the file
if (process.env.DEBUG === '1') {
	console.error('DEBUG - dev.js received args:', process.argv.slice(2));
}

// Use dynamic import to ensure dotenv.config() runs before module-level code executes
const { runCLI } = await import('./modules/commands.js');

// Run the CLI with the process arguments
runCLI(process.argv);
