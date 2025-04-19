#!/usr/bin/env node

/**
 * dev.js
 * Task Master CLI - AI-driven development task management
 *
 * This is the refactored entry point that uses the modular architecture.
 * It imports functionality from the modules directory and provides a CLI.
 */

// Add at the very beginning of the file
if (process.env.DEBUG === '1') {
	console.error('DEBUG - dev.js received args:', process.argv.slice(2));
}

// Model configuration
const MODEL = process.env.MODEL || 'claude-3-7-sonnet-20250219';
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || 'sonar-small-online';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4000');
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.7');

// Run the CLI with the process arguments
runCLI(process.argv);
