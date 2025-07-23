// Opencode profile using ProfileBuilder
import path from 'path';
import fs from 'fs';
import { log } from '../../scripts/modules/utils.js';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

/**
 * Transform standard MCP config format to OpenCode format
 * @param {Object} mcpConfig - Standard MCP configuration object
 * @returns {Object} - Transformed OpenCode configuration object
 */
function transformToOpenCodeFormat(mcpConfig) {
	const openCodeConfig = {
		$schema: 'https://opencode.ai/config.json'
	};

	// Transform mcpServers to mcp
	if (mcpConfig.mcpServers) {
		openCodeConfig.mcp = {};

		for (const [serverName, serverConfig] of Object.entries(
			mcpConfig.mcpServers
		)) {
			// Transform server configuration
			const transformedServer = {
				type: 'local'
			};

			// Combine command and args into single command array
			if (serverConfig.command && serverConfig.args) {
				transformedServer.command = [
					serverConfig.command,
					...serverConfig.args
				];
			} else if (serverConfig.command) {
				transformedServer.command = [serverConfig.command];
			}

			// Add enabled flag
			transformedServer.enabled = true;

			// Transform env to environment
			if (serverConfig.env) {
				transformedServer.environment = serverConfig.env;
			}

			// update with transformed config
			openCodeConfig.mcp[serverName] = transformedServer;
		}
	}

	return openCodeConfig;
}

/**
 * Lifecycle function called after MCP config generation to transform to OpenCode format
 * @param {string} targetDir - Target project directory
 * @param {string} assetsDir - Assets directory (unused for OpenCode)
 */
function onPostConvertRulesProfile(targetDir, assetsDir) {
	const openCodeConfigPath = path.join(targetDir, 'opencode.json');

	if (!fs.existsSync(openCodeConfigPath)) {
		log('debug', '[OpenCode] No opencode.json found to transform');
		return;
	}

	try {
		// Read the generated standard MCP config
		const mcpConfigContent = fs.readFileSync(openCodeConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Check if it's already in OpenCode format (has $schema)
		if (mcpConfig.$schema) {
			log(
				'info',
				'[OpenCode] opencode.json already in OpenCode format, skipping transformation'
			);
			return;
		}

		// Transform to OpenCode format
		const openCodeConfig = transformToOpenCodeFormat(mcpConfig);

		// Write back the transformed config with proper formatting
		fs.writeFileSync(
			openCodeConfigPath,
			JSON.stringify(openCodeConfig, null, 2) + '\n'
		);

		log('info', '[OpenCode] Transformed opencode.json to OpenCode format');
		log(
			'debug',
			`[OpenCode] Added schema, renamed mcpServers->mcp, combined command+args, added type/enabled, renamed env->environment`
		);
	} catch (error) {
		log(
			'error',
			`[OpenCode] Failed to transform opencode.json: ${error.message}`
		);
	}
}

/**
 * Lifecycle function called when removing OpenCode profile
 * @param {string} targetDir - Target project directory
 */
function onRemoveRulesProfile(targetDir) {
	const openCodeConfigPath = path.join(targetDir, 'opencode.json');

	if (!fs.existsSync(openCodeConfigPath)) {
		log('debug', '[OpenCode] No opencode.json found to clean up');
		return;
	}

	try {
		// Read the current config
		const configContent = fs.readFileSync(openCodeConfigPath, 'utf8');
		const config = JSON.parse(configContent);

		// Check if it has the mcp section and taskmaster-ai server
		if (config.mcp && config.mcp['taskmaster-ai']) {
			// Remove taskmaster-ai server
			delete config.mcp['taskmaster-ai'];

			// Check if there are other MCP servers
			const remainingServers = Object.keys(config.mcp);

			if (remainingServers.length === 0) {
				// No other servers, remove entire mcp section
				delete config.mcp;
			}

			// Check if config is now empty (only has $schema)
			const remainingKeys = Object.keys(config).filter(
				(key) => key !== '$schema'
			);

			if (remainingKeys.length === 0) {
				// Config only has schema left, remove entire file
				fs.rmSync(openCodeConfigPath, { force: true });
				log('info', '[OpenCode] Removed empty opencode.json file');
			} else {
				// Write back the modified config
				fs.writeFileSync(
					openCodeConfigPath,
					JSON.stringify(config, null, 2) + '\n'
				);
				log(
					'info',
					'[OpenCode] Removed TaskMaster from opencode.json, preserved other configurations'
				);
			}
		} else {
			log('debug', '[OpenCode] TaskMaster not found in opencode.json');
		}
	} catch (error) {
		log(
			'error',
			`[OpenCode] Failed to clean up opencode.json: ${error.message}`
		);
	}
}

// Create opencode profile using the new ProfileBuilder
const opencodeProfile = ProfileBuilder.minimal('opencode')
	.display('OpenCode')
	.profileDir('.') // Root directory
	.rulesDir('.') // Root directory for AGENTS.md
	.mcpConfig({
		configName: 'opencode.json' // Override default 'mcp.json'
	})
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': 'AGENTS.md'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'opencode.ai' },
			{ from: /\[cursor\.so\]/g, to: '[opencode.ai]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://opencode.ai' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://opencode.ai' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'OpenCode' : 'opencode')
			},
			{ from: /Cursor/g, to: 'OpenCode' }
		],
		// Documentation URL replacements
		docUrls: [{ from: /docs\.cursor\.so/g, to: 'src.codes/docs' }],
		// Standard tool mappings (no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		},

		// Tool context mappings (opencode uses standard contexts)
		toolContexts: [],

		// Tool group mappings (opencode uses standard groups)
		toolGroups: [],

		// File reference mappings (opencode uses standard file references)
		fileReferences: []
	})
	.onPost(onPostConvertRulesProfile)
	.onRemove(onRemoveRulesProfile)
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { opencodeProfile };

// Legacy-compatible export for backward compatibility
export const opencodeProfileLegacy = opencodeProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default opencodeProfileLegacy;

// Export lifecycle functions separately to avoid naming conflicts
export { onPostConvertRulesProfile, onRemoveRulesProfile };
