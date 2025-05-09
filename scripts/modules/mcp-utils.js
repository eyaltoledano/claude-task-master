import fs from 'fs';
import path from 'path';
import { log } from './utils.js';

// Structure matches project conventions (see scripts/init.js)
export function setupMCPConfiguration(configDir) {
	const mcpPath = path.join(configDir, 'mcp.json');
	// New MCP config to be added - references the installed package
	const newMCPServer = {
		'task-master-ai': {
			command: 'npx',
			args: ['-y', '--package=task-master-ai', 'task-master-ai'],
			env: {
				ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY_HERE',
				PERPLEXITY_API_KEY: 'PERPLEXITY_API_KEY_HERE',
				OPENAI_API_KEY: 'OPENAI_API_KEY_HERE',
				GOOGLE_API_KEY: 'GOOGLE_API_KEY_HERE',
				XAI_API_KEY: 'XAI_API_KEY_HERE',
				OPENROUTER_API_KEY: 'OPENROUTER_API_KEY_HERE',
				MISTRAL_API_KEY: 'MISTRAL_API_KEY_HERE',
				AZURE_OPENAI_API_KEY: 'AZURE_OPENAI_API_KEY_HERE',
				OLLAMA_API_KEY: 'OLLAMA_API_KEY_HERE'
			}
		}
	};
	// Create config directory if it doesn't exist
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}
	if (fs.existsSync(mcpPath)) {
		log(
			'info',
			'MCP configuration file already exists, checking for existing task-master-ai...'
		);
		try {
			// Read existing config
			const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
			// Initialize mcpServers if it doesn't exist
			if (!mcpConfig.mcpServers) {
				mcpConfig.mcpServers = {};
			}
			// Check if any existing server configuration already has task-master-ai in its args
			const hasMCPString = Object.values(mcpConfig.mcpServers).some(
				(server) =>
					server.args &&
					server.args.some(
						(arg) => typeof arg === 'string' && arg.includes('task-master-ai')
					)
			);
			if (hasMCPString) {
				log(
					'info',
					'Found existing task-master-ai MCP configuration in mcp.json, leaving untouched'
				);
				return; // Exit early, don't modify the existing configuration
			}
			// Add the task-master-ai server if it doesn't exist
			if (!mcpConfig.mcpServers['task-master-ai']) {
				mcpConfig.mcpServers['task-master-ai'] = newMCPServer['task-master-ai'];
				log(
					'info',
					'Added task-master-ai server to existing MCP configuration'
				);
			} else {
				log('info', 'task-master-ai server already configured in mcp.json');
			}
			// Write the updated configuration
			fs.writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 4));
			log('success', 'Updated MCP configuration file');
		} catch (error) {
			log('error', `Failed to update MCP configuration: ${error.message}`);
			// Create a backup before potentially modifying
			const backupPath = `${mcpPath}.backup-${Date.now()}`;
			if (fs.existsSync(mcpPath)) {
				fs.copyFileSync(mcpPath, backupPath);
				log('info', `Created backup of existing mcp.json at ${backupPath}`);
			}
			// Create new configuration
			const newMCPConfig = {
				mcpServers: newMCPServer
			};
			fs.writeFileSync(mcpPath, JSON.stringify(newMCPConfig, null, 4));
			log(
				'warn',
				'Created new MCP configuration file (backup of original file was created if it existed)'
			);
		}
	} else {
		// If mcp.json doesn't exist, create it
		const newMCPConfig = {
			mcpServers: newMCPServer
		};
		fs.writeFileSync(mcpPath, JSON.stringify(newMCPConfig, null, 4));
		log('success', 'Created MCP configuration file');
	}
	log('info', 'MCP server will use the installed task-master-ai package');
}
