// Roo Code conversion profile for rule-transformer
import path from 'path';
import fs from 'fs';
import { isSilentMode, log } from '../../scripts/modules/utils.js';
import { createProfile, COMMON_TOOL_MAPPINGS } from './base-profile.js';
import { ROO_MODES } from '../constants/profiles.js';

// Import the shared MCP configuration helper
import { formatJSONWithTabs } from '../utils/create-mcp-config.js';

// Roo-specific MCP configuration enhancements
function enhanceRooMCPConfiguration(mcpPath) {
	if (!fs.existsSync(mcpPath)) {
		log('warn', `[Roo] MCP configuration file not found at ${mcpPath}`);
		return;
	}

	try {
		// Read the existing configuration
		const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));

		if (mcpConfig.mcpServers && mcpConfig.mcpServers['task-master-ai']) {
			const server = mcpConfig.mcpServers['task-master-ai'];

			// Add Roo-specific timeout enhancement for long-running AI operations
			server.timeout = 300;

			// Write the enhanced configuration back
			fs.writeFileSync(mcpPath, formatJSONWithTabs(mcpConfig) + '\n');
			log(
				'debug',
				`[Roo] Enhanced MCP configuration with timeout at ${mcpPath}`
			);
		} else {
			log('warn', `[Roo] task-master-ai server not found in MCP configuration`);
		}
	} catch (error) {
		log('error', `[Roo] Failed to enhance MCP configuration: ${error.message}`);
	}
}

// Lifecycle functions for Roo profile
function onAddRulesProfile(targetDir, assetsDir) {
	// Use the provided assets directory to find the roocode directory
	const sourceDir = path.join(assetsDir, 'roocode');

	if (!fs.existsSync(sourceDir)) {
		log('error', `[Roo] Source directory does not exist: ${sourceDir}`);
		return;
	}

	copyRecursiveSync(sourceDir, targetDir);
	log('debug', `[Roo] Copied roocode directory to ${targetDir}`);

	const rooModesDir = path.join(sourceDir, '.roo');

	// Copy .roomodes to project root
	const roomodesSrc = path.join(sourceDir, '.roomodes');
	const roomodesDest = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesSrc)) {
		try {
			fs.copyFileSync(roomodesSrc, roomodesDest);
			log('debug', `[Roo] Copied .roomodes to ${roomodesDest}`);
		} catch (err) {
			log('error', `[Roo] Failed to copy .roomodes: ${err.message}`);
		}
	}

	// Note: MCP configuration is now handled by the base profile system
	// The base profile will call setupMCPConfiguration, and we enhance it in onPostConvert

	for (const mode of ROO_MODES) {
		const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
		const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);
		if (fs.existsSync(src)) {
			try {
				const destDir = path.dirname(dest);
				if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
				fs.copyFileSync(src, dest);
				log('debug', `[Roo] Copied ${mode}-rules to ${dest}`);
			} catch (err) {
				log('error', `[Roo] Failed to copy ${src} to ${dest}: ${err.message}`);
			}
		}
	}
}

function copyRecursiveSync(src, dest) {
	const exists = fs.existsSync(src);
	const stats = exists && fs.statSync(src);
	const isDirectory = exists && stats.isDirectory();
	if (isDirectory) {
		if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
		fs.readdirSync(src).forEach((childItemName) => {
			copyRecursiveSync(
				path.join(src, childItemName),
				path.join(dest, childItemName)
			);
		});
	} else {
		fs.copyFileSync(src, dest);
	}
}

function onRemoveRulesProfile(targetDir) {
	const roomodesPath = path.join(targetDir, '.roomodes');
	if (fs.existsSync(roomodesPath)) {
		try {
			fs.rmSync(roomodesPath, { force: true });
			log('debug', `[Roo] Removed .roomodes from ${roomodesPath}`);
		} catch (err) {
			log('error', `[Roo] Failed to remove .roomodes: ${err.message}`);
		}
	}

	const rooDir = path.join(targetDir, '.roo');
	if (fs.existsSync(rooDir)) {
		// Remove MCP configuration
		const mcpPath = path.join(rooDir, 'mcp.json');
		try {
			fs.rmSync(mcpPath, { force: true });
			log('debug', `[Roo] Removed MCP configuration from ${mcpPath}`);
		} catch (err) {
			log('error', `[Roo] Failed to remove MCP configuration: ${err.message}`);
		}

		fs.readdirSync(rooDir).forEach((entry) => {
			if (entry.startsWith('rules-')) {
				const modeDir = path.join(rooDir, entry);
				try {
					fs.rmSync(modeDir, { recursive: true, force: true });
					log('debug', `[Roo] Removed ${entry} directory from ${modeDir}`);
				} catch (err) {
					log('error', `[Roo] Failed to remove ${modeDir}: ${err.message}`);
				}
			}
		});
		if (fs.readdirSync(rooDir).length === 0) {
			try {
				fs.rmSync(rooDir, { recursive: true, force: true });
				log('debug', `[Roo] Removed empty .roo directory from ${rooDir}`);
			} catch (err) {
				log('error', `[Roo] Failed to remove .roo directory: ${err.message}`);
			}
		}
	}
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
	// Enhance the MCP configuration with Roo-specific features after base setup
	const mcpPath = path.join(targetDir, '.roo', 'mcp.json');
	try {
		enhanceRooMCPConfiguration(mcpPath);
	} catch (err) {
		log('error', `[Roo] Failed to enhance MCP configuration: ${err.message}`);
	}
}

// Create and export roo profile using the base factory
export const rooProfile = createProfile({
	name: 'roo',
	displayName: 'Roo Code',
	url: 'roocode.com',
	docsUrl: 'docs.roocode.com',
	toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,
	mcpConfig: true, // Enable MCP config - we enhance it with Roo-specific features
	onAdd: onAddRulesProfile,
	onRemove: onRemoveRulesProfile,
	onPostConvert: onPostConvertRulesProfile
});

// Export lifecycle functions separately to avoid naming conflicts
export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
