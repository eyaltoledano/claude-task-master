#!/usr/bin/env node

/**
 * dev.js - Development entry point for the Task Master CLI
 * Parses command-line arguments and passes them to the appropriate command handlers
 */

import { program } from 'commander';
import { setupCLI, runCLI } from './modules/commands.js';
import { displayBanner } from './modules/ui.js';
import { CONFIG } from './modules/utils.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Display the banner
displayBanner();

// Set up the Commander program
setupCLI(program);

// Parse arguments and execute the appropriate command
runCLI(program, process.argv); 