#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 *
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

import { join } from 'node:path';
import { findProjectRoot } from '@tm/core';
import dotenv from 'dotenv';
import { initializeSentry } from '../src/telemetry/sentry.js';

// Store the original working directory
// This is needed for commands that take relative paths as arguments
const originalCwd = process.cwd();

// Find project root for .env loading
// We don't change the working directory to avoid breaking relative path logic
const projectRoot = findProjectRoot();

// Load .env from project root without changing cwd
dotenv.config({ path: join(projectRoot, '.env') });

// Initialize Sentry after .env is loaded
initializeSentry({ projectRoot });

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
