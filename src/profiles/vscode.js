// VS Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { log } from '../../scripts/modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';

/**
 * Transform standard MCP config format to VS Code format
 * @param {Object} mcpConfig - Standard MCP configuration object
 * @returns {Object} - Transformed VS Code configuration object
 */
function transformToVSCodeFormat(mcpConfig) {
	const vscodeConfig = {};

	// Transform mcpServers to servers
	if (mcpConfig.mcpServers) {
		vscodeConfig.servers = {};

		for (const [serverName, serverConfig] of Object.entries(
			mcpConfig.mcpServers
		)) {
			// Transform server configuration
			const transformedServer = {
				...serverConfig
			};

			// Add type: "stdio" after the env block
			if (transformedServer.env) {
				// Reorder properties: keep command, args, env, then add type
				const reorderedServer = {};
				if (transformedServer.command)
					reorderedServer.command = transformedServer.command;
				if (transformedServer.args)
					reorderedServer.args = transformedServer.args;
				if (transformedServer.env) reorderedServer.env = transformedServer.env;
				reorderedServer.type = 'stdio';

				// Add any other properties that might exist
				Object.keys(transformedServer).forEach((key) => {
					if (!['command', 'args', 'env', 'type'].includes(key)) {
						reorderedServer[key] = transformedServer[key];
					}
				});

				vscodeConfig.servers[serverName] = reorderedServer;
			} else {
				// If no env block, just add type at the end
				transformedServer.type = 'stdio';
				vscodeConfig.servers[serverName] = transformedServer;
			}
		}
	}

	return vscodeConfig;
}

/**
 * Lifecycle function called after MCP config generation to transform to VS Code format
 * @param {string} targetDir - Target project directory
 * @param {string} assetsDir - Assets directory (unused for VS Code)
 */
function onPostConvertRulesProfile(targetDir, assetsDir) {
	const vscodeConfigPath = path.join(targetDir, '.vscode', 'mcp.json');

	if (!fs.existsSync(vscodeConfigPath)) {
		log('debug', '[VS Code] No .vscode/mcp.json found to transform');
		return;
	}

	try {
		// Read the generated standard MCP config
		const mcpConfigContent = fs.readFileSync(vscodeConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Check if it's already in VS Code format (has servers instead of mcpServers)
		if (mcpConfig.servers) {
			log(
				'info',
				'[VS Code] mcp.json already in VS Code format, skipping transformation'
			);
			return;
		}

		// Transform to VS Code format
		const vscodeConfig = transformToVSCodeFormat(mcpConfig);

		// Write back the transformed config with proper formatting
		fs.writeFileSync(
			vscodeConfigPath,
			JSON.stringify(vscodeConfig, null, 2) + '\n'
		);

		log('info', '[VS Code] Transformed mcp.json to VS Code format');
		log('debug', `[VS Code] Renamed mcpServers->servers, added type: "stdio"`);
	} catch (error) {
		log('error', `[VS Code] Failed to transform mcp.json: ${error.message}`);
	}
}

/**
 * Lifecycle function called when removing VS Code profile
 * @param {string} targetDir - Target project directory
 */
function onRemoveRulesProfile(targetDir) {
	const vscodeConfigPath = path.join(targetDir, '.vscode', 'mcp.json');

	if (!fs.existsSync(vscodeConfigPath)) {
		log('debug', '[VS Code] No .vscode/mcp.json found to clean up');
		return;
	}

	try {
		// Read the current config
		const configContent = fs.readFileSync(vscodeConfigPath, 'utf8');
		const config = JSON.parse(configContent);

		// Check if it has the servers section and task-master-ai server
		if (config.servers && config.servers['task-master-ai']) {
			// Remove task-master-ai server
			delete config.servers['task-master-ai'];

			// Check if there are other MCP servers
			const remainingServers = Object.keys(config.servers);

			if (remainingServers.length === 0) {
				// No other servers, remove entire file
				fs.rmSync(vscodeConfigPath, { force: true });
				log('info', '[VS Code] Removed empty mcp.json file');

				// Also remove .vscode directory if it's empty
				const vscodeDir = path.dirname(vscodeConfigPath);
				try {
					const dirContents = fs.readdirSync(vscodeDir);
					if (dirContents.length === 0) {
						fs.rmSync(vscodeDir, { recursive: true, force: true });
						log('debug', '[VS Code] Removed empty .vscode directory');
					}
				} catch (err) {
					// Directory might not be empty or might not exist, that's fine
				}
			} else {
				// Write back the modified config
				fs.writeFileSync(
					vscodeConfigPath,
					JSON.stringify(config, null, 2) + '\n'
				);
				log(
					'info',
					'[VS Code] Removed TaskMaster from mcp.json, preserved other configurations'
				);
			}
		} else {
			log('debug', '[VS Code] TaskMaster not found in mcp.json');
		}
	} catch (error) {
		log('error', `[VS Code] Failed to clean up mcp.json: ${error.message}`);
	}
}

// Create and export vscode profile using the base factory
export const vscodeProfile = createProfile({
	name: 'vscode',
	displayName: 'VS Code',
	url: 'code.visualstudio.com',
	docsUrl: 'code.visualstudio.com/docs',
	rulesDir: '.github/instructions', // VS Code instructions location
	profileDir: '.vscode', // VS Code configuration directory
	mcpConfigName: 'mcp.json', // VS Code uses mcp.json in .vscode directory
	targetExtension: '.instructions.md',
	customReplacements: [
		// Core VS Code directory structure changes
		{ from: /\.cursor\/rules/g, to: '.github/instructions' },
		{ from: /\.cursor\/mcp\.json/g, to: '.vscode/mcp.json' },

		// Fix any remaining vscode/rules references that might be created during transformation
		{ from: /\.vscode\/rules/g, to: '.github/instructions' },

		// VS Code custom instructions format - use applyTo with quoted patterns instead of globs
		{ from: /^globs:\s*(.+)$/gm, to: 'applyTo: "$1"' },

		// Remove unsupported property - alwaysApply
		{ from: /^alwaysApply:\s*(true|false)\s*\n?/gm, to: '' },

		// Essential markdown link transformations for VS Code structure
		{
			from: /\[(.+?)\]\(mdc:\.cursor\/rules\/(.+?)\.mdc\)/g,
			to: '[$1](.github/instructions/$2.instructions.md)'
		},

		// VS Code specific terminology
		{ from: /rules directory/g, to: 'instructions directory' },
		{ from: /cursor rules/gi, to: 'VS Code instructions' }
	],
	onPostConvert: onPostConvertRulesProfile,
	onRemove: onRemoveRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onPostConvertRulesProfile, onRemoveRulesProfile };
