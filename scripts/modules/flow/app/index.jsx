#!/usr/bin/env node

// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

import React from 'react';
import { render } from 'ink';
import { ThemeProvider, defaultTheme, extendTheme } from '@inkjs/ui';
import { DirectBackend } from '../infra/backends/direct-backend.js';
import { CliBackend } from '../infra/backends/cli-backend.js';
import { MCPClientBackend } from '../infra/backends/mcp-client-backend.js';
import { createInkUITheme } from '../features/ui/theme/ink-ui-theme.js';
import { FlowApp } from '../FlowApp.jsx';

/**
 * Main application bootstrap function
 * Initializes backend, theme, and renders the app
 */
export async function run(options = {}) {
	// Augment options with environment variables as a fallback
	if (process.env.TASKMASTER_PROJECT_ROOT && !options.projectRoot) {
		options.projectRoot = process.env.TASKMASTER_PROJECT_ROOT;
	}
	if (process.env.TASKMASTER_BACKEND && !options.backend) {
		options.backend = process.env.TASKMASTER_BACKEND;
	}
	if (process.env.TASKMASTER_MCP_SERVER_ID && !options.mcpServerId) {
		options.mcpServerId = process.env.TASKMASTER_MCP_SERVER_ID;
	}

	// Determine backend
	const backendType =
		options.backend || process.env.TASKMASTER_BACKEND || 'direct';

	let backend;
	if (backendType === 'direct') {
		backend = new DirectBackend({
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else if (backendType === 'cli') {
		backend = new CliBackend({
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else if (backendType === 'mcp') {
		// For MCP backend, we need to load server configuration
		const { loadServers, getDefaultServer, findServerById } = await import(
			'../infra/mcp/servers.js'
		);
		const servers = await loadServers();

		// Get server ID from options or environment
		const serverId =
			options.mcpServerId || process.env.TASKMASTER_MCP_SERVER_ID;

		let serverConfig;
		if (serverId) {
			serverConfig = findServerById(servers, serverId);
			if (!serverConfig) {
				throw new Error(`MCP server with ID '${serverId}' not found`);
			}
		} else {
			// Use default server
			serverConfig = getDefaultServer(servers);
			if (!serverConfig) {
				throw new Error(
					'No MCP servers configured. Use Flow UI to add servers or run with --backend direct'
				);
			}
		}

		// Create MCP backend with server configuration
		backend = new MCPClientBackend({
			server: serverConfig,
			projectRoot: options.projectRoot || process.env.TASKMASTER_PROJECT_ROOT
		});
	} else {
		throw new Error(`Unknown backend type: ${backendType}`);
	}

	// Initialize backend
	await backend.initialize();

	// Create Ink UI theme
	const inkUITheme = extendTheme(defaultTheme, createInkUITheme());

	// Create app instance with ThemeProvider
	const app = render(
		<ThemeProvider theme={inkUITheme}>
			<FlowApp backend={backend} options={options} />
		</ThemeProvider>
	);

	// Wait for app to exit
	await app.waitUntilExit();
}

// If this file is run directly, execute the run function
if (import.meta.url === `file://${process.argv[1]}`) {
	run().catch((error) => {
		console.error('Error running flow:', error);
		process.exit(1);
	});
} 