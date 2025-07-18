// Zed profile using new ProfileBuilder system
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { ProfileBuilder } from '../profile/ProfileBuilder.js';

/**
 * Transform standard MCP config format to Zed format
 * @param {Object} mcpConfig - Standard MCP configuration object
 * @returns {Object} - Transformed Zed configuration object
 */
function transformToZedFormat(mcpConfig) {
	const zedConfig = {};

	// Transform mcpServers to context_servers
	if (mcpConfig.mcpServers) {
		zedConfig['context_servers'] = mcpConfig.mcpServers;
	}

	// Preserve any other existing settings
	for (const [key, value] of Object.entries(mcpConfig)) {
		if (key !== 'mcpServers') {
			zedConfig[key] = value;
		}
	}

	return zedConfig;
}

// Lifecycle functions for Zed profile
function onAddRulesProfile(targetDir, assetsDir) {
	// MCP transformation will be handled in onPostConvertRulesProfile
	// File copying is handled by the base profile via fileMap
}

function onRemoveRulesProfile(targetDir) {
	// Clean up .rules (Zed uses .rules directly in root)
	const userRulesFile = path.join(targetDir, '.rules');

	try {
		// Remove Task Master .rules
		if (fs.existsSync(userRulesFile)) {
			fs.rmSync(userRulesFile, { force: true });
			log('debug', `[Zed] Removed ${userRulesFile}`);
		}
	} catch (err) {
		log('error', `[Zed] Failed to remove Zed instructions: ${err.message}`);
	}

	// MCP Removal: Remove context_servers section
	const mcpConfigPath = path.join(targetDir, '.zed', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		log('debug', '[Zed] No .zed/settings.json found to clean up');
		return;
	}

	try {
		// Read the current config
		const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const config = JSON.parse(configContent);

		// Check if it has the context_servers section and task-master-ai server
		if (
			config['context_servers'] &&
			config['context_servers']['task-master-ai']
		) {
			// Remove task-master-ai server
			delete config['context_servers']['task-master-ai'];

			// Check if there are other MCP servers in context_servers
			const remainingServers = Object.keys(config['context_servers']);

			if (remainingServers.length === 0) {
				// No other servers, remove entire context_servers section
				delete config['context_servers'];
				log('debug', '[Zed] Removed empty context_servers section');
			}

			// Check if config is now empty
			const remainingKeys = Object.keys(config);

			if (remainingKeys.length === 0) {
				// Config is empty, remove entire file
				fs.rmSync(mcpConfigPath, { force: true });
				log('info', '[Zed] Removed empty settings.json file');

				// Check if .zed directory is empty
				const zedDirPath = path.join(targetDir, '.zed');
				if (fs.existsSync(zedDirPath)) {
					const remainingContents = fs.readdirSync(zedDirPath);
					if (remainingContents.length === 0) {
						fs.rmSync(zedDirPath, { recursive: true, force: true });
						log('debug', '[Zed] Removed empty .zed directory');
					}
				}
			} else {
				// Write back the modified config
				fs.writeFileSync(
					mcpConfigPath,
					JSON.stringify(config, null, '\t') + '\n'
				);
				log(
					'info',
					'[Zed] Removed TaskMaster from settings.json, preserved other configurations'
				);
			}
		} else {
			log('debug', '[Zed] TaskMaster not found in context_servers');
		}
	} catch (error) {
		log('error', `[Zed] Failed to clean up settings.json: ${error.message}`);
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// Handle .rules setup (same as onAddRulesProfile)
	onAddRulesProfile(targetDir, assetsDir);

	// Transform MCP config to Zed format
	const mcpConfigPath = path.join(targetDir, '.zed', 'settings.json');

	if (!fs.existsSync(mcpConfigPath)) {
		log('debug', '[Zed] No .zed/settings.json found to transform');
		return;
	}

	try {
		// Read the generated standard MCP config
		const mcpConfigContent = fs.readFileSync(mcpConfigPath, 'utf8');
		const mcpConfig = JSON.parse(mcpConfigContent);

		// Check if it's already in Zed format (has context_servers)
		if (mcpConfig['context_servers']) {
			log(
				'info',
				'[Zed] settings.json already in Zed format, skipping transformation'
			);
			return;
		}

		// Transform to Zed format
		const zedConfig = transformToZedFormat(mcpConfig);

		// Write back the transformed config with proper formatting
		fs.writeFileSync(
			mcpConfigPath,
			JSON.stringify(zedConfig, null, '\t') + '\n'
		);

		log('info', '[Zed] Transformed settings.json to Zed format');
		log('debug', '[Zed] Renamed mcpServers to context_servers');
	} catch (error) {
		log('error', `[Zed] Failed to transform settings.json: ${error.message}`);
	}
}

// Create zed profile using the new ProfileBuilder
const zedProfile = ProfileBuilder
	.minimal('zed')
	.display('Zed')
	.profileDir('.zed')
	.rulesDir('.')
	.mcpConfig({
		configName: 'settings.json'
	})
	.includeDefaultRules(false)
	.fileMap({
		'AGENTS.md': '.rules'
	})
	.conversion({
		// Profile name replacements
		profileTerms: [
			{ from: /cursor\.so/g, to: 'zed.dev' },
			{ from: /\[cursor\.so\]/g, to: '[zed.dev]' },
			{ from: /href="https:\/\/cursor\.so/g, to: 'href="https://zed.dev' },
			{ from: /\(https:\/\/cursor\.so/g, to: '(https://zed.dev' },
			{
				from: /\bcursor\b/gi,
				to: (match) => (match === 'Cursor' ? 'Zed' : 'zed')
			},
			{ from: /Cursor/g, to: 'Zed' }
		],
		// Documentation URL replacements
		docUrls: [
			{ from: /docs\.cursor\.so/g, to: 'zed.dev/docs' }
		],
		// Standard tool mappings (no custom tools)
		toolNames: {
			edit_file: 'edit_file',
			search: 'search',
			grep_search: 'grep_search',
			list_dir: 'list_dir',
			read_file: 'read_file',
			run_terminal_cmd: 'run_terminal_cmd'
		}
	})
	.onAdd(onAddRulesProfile)
	.onRemove(onRemoveRulesProfile)
	.onPost(onPostConvertRulesProfile)
	.build();

// Export both the new Profile instance and a legacy-compatible version
export { zedProfile };

// Legacy-compatible export for backward compatibility
export const zedProfileLegacy = zedProfile.toLegacyFormat();

// Default export remains legacy format for maximum compatibility
export default zedProfileLegacy;

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
