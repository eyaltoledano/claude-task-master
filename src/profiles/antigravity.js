import fs from 'fs';
import path from 'path';
import { log } from '../../scripts/modules/utils.js';
import { createProfile } from './base-profile.js';

function isInstalled(targetDir) {
	// Check if Antigravity MCP config exists and contains task-master-ai server
	const mcpConfigPath = path.join(targetDir, '.gemini', 'antigravity', 'mcp_config.json');

	try {
		if (!fs.existsSync(mcpConfigPath)) {
			return false;
		}

		const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
		return config.mcpServers && config.mcpServers['task-master-ai'];
	} catch (error) {
		log('debug', `[Antigravity] Error checking installation: ${error.message}`);
		return false;
	}
}

function onAddRulesProfile(targetDir, assetsDir) {
	// Antigravity creates MCP config in project root .gemini/antigravity/ directory
	const geminiDir = path.join(targetDir, '.gemini');
	const antigravityDir = path.join(geminiDir, 'antigravity');
	const mcpConfigPath = path.join(antigravityDir, 'mcp_config.json');

	try {
		// Ensure directories exist
		if (!fs.existsSync(geminiDir)) {
			fs.mkdirSync(geminiDir, { recursive: true });
		}
		if (!fs.existsSync(antigravityDir)) {
			fs.mkdirSync(antigravityDir, { recursive: true });
		}

		// Check if config already exists
		if (fs.existsSync(mcpConfigPath)) {
			const existingConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

			// Check if task-master-ai server is already configured
			if (existingConfig.mcpServers && existingConfig.mcpServers['task-master-ai']) {
				log('info', `[Antigravity] Task Master AI server already configured in MCP config`);
				return;
			}

			// Add task-master-ai server to existing config
			if (!existingConfig.mcpServers) {
				existingConfig.mcpServers = {};
			}
			existingConfig.mcpServers['task-master-ai'] = {
				command: 'npx',
				args: ['-y', 'task-master-ai', 'mcp-server'],
				env: {
					TASK_MASTER_PROJECT_ROOT: targetDir
				}
			};

			fs.writeFileSync(mcpConfigPath, JSON.stringify(existingConfig, null, 2) + '\n');
			log('info', `[Antigravity] Added Task Master AI server to existing MCP config`);
		} else {
			// Create new MCP config
			const mcpConfig = {
				mcpServers: {
					'task-master-ai': {
						command: 'npx',
						args: ['-y', 'task-master-ai', 'mcp-server'],
						env: {
							TASK_MASTER_PROJECT_ROOT: targetDir
						}
					}
				}
			};

			fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2) + '\n');
			log('info', `[Antigravity] Created MCP config at ${mcpConfigPath}`);
		}
	} catch (error) {
		log('error', `[Antigravity] Failed to create MCP config: ${error.message}`);
	}
}

function onRemoveRulesProfile(targetDir) {
	// Clean up Antigravity MCP config from project .gemini/antigravity/
	const antigravityDir = path.join(targetDir, '.gemini', 'antigravity');
	const mcpConfigPath = path.join(antigravityDir, 'mcp_config.json');

	try {
		if (fs.existsSync(mcpConfigPath)) {
			// Read current config and remove task-master-ai server
			const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
			if (config.mcpServers && config.mcpServers['task-master-ai']) {
				delete config.mcpServers['task-master-ai'];

				// If no servers left, remove the file
				if (Object.keys(config.mcpServers).length === 0) {
					fs.rmSync(mcpConfigPath, { force: true });
					log('info', `[Antigravity] Removed empty MCP config file`);
				} else {
					// Update config with task-master-ai removed
					fs.writeFileSync(mcpConfigPath, JSON.stringify(config, null, 2) + '\n');
					log('info', `[Antigravity] Removed Task Master from MCP config`);
				}
			}
		}

		// Clean up empty directories
		try {
			if (fs.existsSync(antigravityDir) && fs.readdirSync(antigravityDir).length === 0) {
				fs.rmSync(antigravityDir, { recursive: true, force: true });
				log('debug', `[Antigravity] Removed empty antigravity directory`);
			}
			const geminiDir = path.join(targetDir, '.gemini');
			if (fs.existsSync(geminiDir) && fs.readdirSync(geminiDir).length === 0) {
				fs.rmSync(geminiDir, { recursive: true, force: true });
				log('debug', `[Antigravity] Removed empty .gemini directory`);
			}
		} catch (dirError) {
			// Directory cleanup is not critical
		}
	} catch (error) {
		log('error', `[Antigravity] Failed to clean up MCP config: ${error.message}`);
	}
}

export const antigravityProfile = createProfile({
	name: 'antigravity',
	displayName: 'Antigravity',
	url: 'https://antigravity.dev',
	docsUrl: 'https://antigravity.dev/docs',
	profileDir: '.gemini/antigravity',
	rulesDir: '.',
	mcpConfig: true,
	mcpConfigName: 'mcp_config.json',
	includeDefaultRules: false,
	fileMap: {},
	isInstalled,
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile
});
