#!/usr/bin/env node

import { Config } from 'fastmcp';
import path from 'path';
import fs from 'fs';

// Log the current directory
console.error(`Current working directory: ${process.cwd()}`);

try {
	console.error('Attempting to load FastMCP Config...');

	// Check if .cursor/mcp.json exists
	const mcpPath = path.join(process.cwd(), '.cursor', 'mcp.json');
	console.error(`Checking if mcp.json exists at: ${mcpPath}`);

	if (fs.existsSync(mcpPath)) {
		console.error('mcp.json file found');
		console.error(
			`File content: ${JSON.stringify(JSON.parse(fs.readFileSync(mcpPath, 'utf8')), null, 2)}`
		);
	} else {
		console.error('mcp.json file not found');
	}

	// Try to create Config
	const config = new Config();
	console.error('Config created successfully');

	// Check if env property exists
	if (config.env) {
		console.error(
			`Config.env exists with keys: ${Object.keys(config.env).join(', ')}`
		);

		// Print each env var value (careful with sensitive values)
		for (const [key, value] of Object.entries(config.env)) {
			if (key.includes('KEY')) {
				console.error(`${key}: [value hidden]`);
			} else {
				console.error(`${key}: ${value}`);
			}
		}
	} else {
		console.error('Config.env does not exist');
	}
} catch (error) {
	console.error(`Error loading Config: ${error.message}`);
	console.error(`Stack trace: ${error.stack}`);
}

// Log process.env to see if values from mcp.json were loaded automatically
console.error('\nChecking if process.env already has values from mcp.json:');
const envVars = [
	'ANTHROPIC_API_KEY',
	'PERPLEXITY_API_KEY',
	'MODEL',
	'PERPLEXITY_MODEL',
	'MAX_TOKENS',
	'TEMPERATURE',
	'DEFAULT_SUBTASKS',
	'DEFAULT_PRIORITY'
];

for (const varName of envVars) {
	if (process.env[varName]) {
		if (varName.includes('KEY')) {
			console.error(`${varName}: [value hidden]`);
		} else {
			console.error(`${varName}: ${process.env[varName]}`);
		}
	} else {
		console.error(`${varName}: not set`);
	}
}
