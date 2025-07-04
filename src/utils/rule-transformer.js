/**
 * Rule Transformer Module
 * Handles conversion of Cursor rules to profile rules
 *
 * This module procedurally generates .{profile}/rules files from assets/rules files,
 * eliminating the need to maintain both sets of files manually.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../scripts/modules/utils.js';

// Import the shared MCP configuration helper
import {
	setupMCPConfiguration,
	removeTaskMasterMCPConfiguration
} from './create-mcp-config.js';

// Import profile constants (single source of truth)
import { RULE_PROFILES } from '../constants/profiles.js';

// --- Profile Imports ---
import * as profilesModule from '../profiles/index.js';

export function isValidProfile(profile) {
	return RULE_PROFILES.includes(profile);
}

/**
 * Get rule profile by name
 * @param {string} name - Profile name
 * @returns {Object|null} Profile object or null if not found
 */
export function getRulesProfile(name) {
	if (!isValidProfile(name)) {
		return null;
	}

	// Get the profile from the imported profiles module
	const profileKey = `${name}Profile`;
	const profile = profilesModule[profileKey];

	if (!profile) {
		throw new Error(
			`Profile not found: static import missing for '${name}'. Valid profiles: ${RULE_PROFILES.join(', ')}`
		);
	}

	return profile;
}

/**
 * Replace basic Cursor terms with profile equivalents
 */
function replaceBasicTerms(content, conversionConfig) {
	let result = content;

	// Apply profile term replacements
	conversionConfig.profileTerms.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	// Apply file extension replacements
	conversionConfig.fileExtensions.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Replace Cursor tool references with profile tool equivalents
 */
function replaceToolReferences(content, conversionConfig) {
	let result = content;

	// Basic pattern for direct tool name replacements
	const toolNames = conversionConfig.toolNames;
	const toolReferencePattern = new RegExp(
		`\\b(${Object.keys(toolNames).join('|')})\\b`,
		'g'
	);

	// Apply direct tool name replacements
	result = result.replace(toolReferencePattern, (match, toolName) => {
		return toolNames[toolName] || toolName;
	});

	// Apply contextual tool replacements
	conversionConfig.toolContexts.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	// Apply tool group replacements
	conversionConfig.toolGroups.forEach((pattern) => {
		result = result.replace(pattern.from, pattern.to);
	});

	return result;
}

/**
 * Update documentation URLs to point to profile documentation
 */
function updateDocReferences(content, conversionConfig) {
	let result = content;

	// Apply documentation URL replacements
	conversionConfig.docUrls.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	return result;
}

/**
 * Update file references in markdown links
 */
function updateFileReferences(content, conversionConfig) {
	const { pathPattern, replacement } = conversionConfig.fileReferences;
	return content.replace(pathPattern, replacement);
}

/**
 * Transform rule content to profile-specific rules
 * @param {string} content - The content to transform
 * @param {Object} conversionConfig - The conversion configuration
 * @param {Object} globalReplacements - Global text replacements
 * @returns {string} - The transformed content
 */
function transformRuleContent(content, conversionConfig, globalReplacements) {
	let result = content;

	// Apply all transformations in appropriate order
	result = updateFileReferences(result, conversionConfig);
	result = replaceBasicTerms(result, conversionConfig);
	result = replaceToolReferences(result, conversionConfig);
	result = updateDocReferences(result, conversionConfig);

	// Apply any global/catch-all replacements from the profile
	// Super aggressive failsafe pass to catch any variations we might have missed
	// This ensures critical transformations are applied even in contexts we didn't anticipate
	globalReplacements.forEach((pattern) => {
		if (typeof pattern.to === 'function') {
			result = result.replace(pattern.from, pattern.to);
		} else {
			result = result.replace(pattern.from, pattern.to);
		}
	});

	return result;
}

/**
 * Convert a Cursor rule file to a profile-specific rule file
 * @param {string} sourcePath - Path to the source .mdc file
 * @param {string} targetPath - Path to the target file
 * @param {Object} profile - The profile configuration
 * @returns {boolean} - Success status
 */
export function convertRuleToProfileRule(sourcePath, targetPath, profile) {
	const { conversionConfig, globalReplacements } = profile;
	try {
		// Read source content
		const content = fs.readFileSync(sourcePath, 'utf8');

		// Transform content
		const transformedContent = transformRuleContent(
			content,
			conversionConfig,
			globalReplacements
		);

		// Ensure target directory exists
		const targetDir = path.dirname(targetPath);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		// Write transformed content
		fs.writeFileSync(targetPath, transformedContent);

		return true;
	} catch (error) {
		console.error(`Error converting rule file: ${error.message}`);
		return false;
	}
}

/**
 * Convert all Cursor rules to profile rules for a specific profile
 */
export function convertAllRulesToProfileRules(projectRoot, profile) {
	// Handle simple profiles (Claude, Codex) that just copy files to root
	const isSimpleProfile = Object.keys(profile.fileMap).length === 0;
	if (isSimpleProfile) {
		// For simple profiles, just call their post-processing hook and return
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = path.dirname(__filename);
		const assetsDir = path.join(__dirname, '..', '..', 'assets');

		if (typeof profile.onPostConvertRulesProfile === 'function') {
			profile.onPostConvertRulesProfile(projectRoot, assetsDir);
		}
		return { success: 1, failed: 0 };
	}

	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const sourceDir = path.join(__dirname, '..', '..', 'assets', 'rules');
	const targetDir = path.join(projectRoot, profile.rulesDir);

	// Ensure target directory exists
	if (!fs.existsSync(targetDir)) {
		fs.mkdirSync(targetDir, { recursive: true });
	}

	// Setup MCP configuration if enabled
	if (profile.mcpConfig !== false) {
		setupMCPConfiguration(projectRoot, profile.mcpConfigPath);
	}

	let success = 0;
	let failed = 0;

	// Use fileMap to determine which files to copy
	const sourceFiles = Object.keys(profile.fileMap);

	for (const sourceFile of sourceFiles) {
		try {
			const sourcePath = path.join(sourceDir, sourceFile);

			// Check if source file exists
			if (!fs.existsSync(sourcePath)) {
				log(
					'warn',
					`[Rule Transformer] Source file not found: ${sourceFile}, skipping`
				);
				continue;
			}

			const targetFilename = profile.fileMap[sourceFile];
			const targetPath = path.join(targetDir, targetFilename);

			// Ensure target subdirectory exists (for rules like taskmaster/dev_workflow.md)
			const targetFileDir = path.dirname(targetPath);
			if (!fs.existsSync(targetFileDir)) {
				fs.mkdirSync(targetFileDir, { recursive: true });
			}

			// Read source content
			let content = fs.readFileSync(sourcePath, 'utf8');

			// Apply transformations
			content = transformRuleContent(
				content,
				profile.conversionConfig,
				profile.globalReplacements
			);

			// Write to target
			fs.writeFileSync(targetPath, content, 'utf8');
			success++;

			log(
				'debug',
				`[Rule Transformer] Converted ${sourceFile} -> ${targetFilename} for ${profile.profileName}`
			);
		} catch (error) {
			failed++;
			log(
				'error',
				`[Rule Transformer] Failed to convert ${sourceFile} for ${profile.profileName}: ${error.message}`
			);
		}
	}

	// Call post-processing hook if defined (e.g., for Roo's rules-*mode* folders)
	if (typeof profile.onPostConvertRulesProfile === 'function') {
		const assetsDir = path.join(__dirname, '..', '..', 'assets');
		profile.onPostConvertRulesProfile(projectRoot, assetsDir);
	}

	return { success, failed };
}

/**
 * Remove only Task Master specific files from a profile, leaving other existing rules intact
 * @param {string} projectRoot - Target project directory
 * @param {Object} profile - Profile configuration
 * @returns {Object} Result object
 */
export function removeProfileRules(projectRoot, profile) {
	const targetDir = path.join(projectRoot, profile.rulesDir);
	const profileDir = path.join(projectRoot, profile.profileDir);

	const result = {
		profileName: profile.profileName,
		success: false,
		skipped: false,
		error: null,
		filesRemoved: [],
		mcpResult: null,
		profileDirRemoved: false,
		notice: null
	};

	try {
		// Handle simple profiles (Claude, Codex) that just copy files to root
		const isSimpleProfile = Object.keys(profile.fileMap).length === 0;

		if (isSimpleProfile) {
			// For simple profiles, just call their removal hook and return
			if (typeof profile.onRemoveRulesProfile === 'function') {
				profile.onRemoveRulesProfile(projectRoot);
			}
			result.success = true;
			log(
				'debug',
				`[Rule Transformer] Successfully removed ${profile.profileName} files from ${projectRoot}`
			);
			return result;
		}

		// Check if profile directory exists at all (for full profiles)
		if (!fs.existsSync(profileDir)) {
			result.success = true;
			result.skipped = true;
			log(
				'debug',
				`[Rule Transformer] Profile directory does not exist: ${profileDir}`
			);
			return result;
		}

		// 1. Remove only Task Master specific files from the rules directory
		let hasOtherRulesFiles = false;
		if (fs.existsSync(targetDir)) {
			const taskmasterFiles = Object.values(profile.fileMap);
			const removedFiles = [];

			// Helper function to recursively check and remove Task Master files
			function processDirectory(dirPath, relativePath = '') {
				const items = fs.readdirSync(dirPath);

				for (const item of items) {
					const itemPath = path.join(dirPath, item);
					const relativeItemPath = relativePath
						? path.join(relativePath, item)
						: item;
					const stat = fs.statSync(itemPath);

					if (stat.isDirectory()) {
						// Recursively process subdirectory
						processDirectory(itemPath, relativeItemPath);

						// Check if directory is empty after processing and remove if so
						try {
							const remainingItems = fs.readdirSync(itemPath);
							if (remainingItems.length === 0) {
								fs.rmSync(itemPath, { recursive: true, force: true });
								log(
									'debug',
									`[Rule Transformer] Removed empty directory: ${relativeItemPath}`
								);
							}
						} catch (error) {
							// Directory might have been removed already, ignore
						}
					} else if (stat.isFile()) {
						if (taskmasterFiles.includes(relativeItemPath)) {
							// This is a Task Master file, remove it
							fs.rmSync(itemPath, { force: true });
							removedFiles.push(relativeItemPath);
							log(
								'debug',
								`[Rule Transformer] Removed Task Master file: ${relativeItemPath}`
							);
						} else {
							// This is not a Task Master file, leave it
							hasOtherRulesFiles = true;
							log(
								'debug',
								`[Rule Transformer] Preserved existing file: ${relativeItemPath}`
							);
						}
					}
				}
			}

			// Process the rules directory recursively
			processDirectory(targetDir);

			result.filesRemoved = removedFiles;

			// Only remove the rules directory if it's empty after removing Task Master files
			const remainingFiles = fs.readdirSync(targetDir);
			if (remainingFiles.length === 0) {
				fs.rmSync(targetDir, { recursive: true, force: true });
				log(
					'debug',
					`[Rule Transformer] Removed empty rules directory: ${targetDir}`
				);
			} else if (hasOtherRulesFiles) {
				result.notice = `Preserved ${remainingFiles.length} existing rule files in ${profile.rulesDir}`;
				log('info', `[Rule Transformer] ${result.notice}`);
			}
		}

		// 2. Handle MCP configuration - only remove Task Master, preserve other servers
		if (profile.mcpConfig !== false) {
			result.mcpResult = removeTaskMasterMCPConfiguration(
				projectRoot,
				profile.mcpConfigPath
			);
			if (result.mcpResult.hasOtherServers) {
				if (!result.notice) {
					result.notice = 'Preserved other MCP server configurations';
				} else {
					result.notice += '; preserved other MCP server configurations';
				}
			}
		}

		// 3. Call removal hook if defined (e.g., Roo's custom cleanup)
		if (typeof profile.onRemoveRulesProfile === 'function') {
			profile.onRemoveRulesProfile(projectRoot);
		}

		// 4. Only remove profile directory if:
		//    - It's completely empty after all operations, AND
		//    - All rules removed were Task Master rules (no existing rules preserved), AND
		//    - MCP config was completely deleted (not just Task Master removed), AND
		//    - No other files or folders exist in the profile directory
		if (fs.existsSync(profileDir)) {
			const remaining = fs.readdirSync(profileDir);
			const allRulesWereTaskMaster = !hasOtherRulesFiles;
			const mcpConfigCompletelyDeleted = result.mcpResult?.deleted === true;

			// Check if there are any other files or folders beyond what we expect
			const hasOtherFilesOrFolders = remaining.length > 0;

			if (
				remaining.length === 0 &&
				allRulesWereTaskMaster &&
				(profile.mcpConfig === false || mcpConfigCompletelyDeleted) &&
				!hasOtherFilesOrFolders
			) {
				fs.rmSync(profileDir, { recursive: true, force: true });
				result.profileDirRemoved = true;
				log(
					'debug',
					`[Rule Transformer] Removed profile directory: ${profileDir} (completely empty, all rules were Task Master rules, and MCP config was completely removed)`
				);
			} else {
				// Determine what was preserved and why
				const preservationReasons = [];
				if (hasOtherFilesOrFolders) {
					preservationReasons.push(
						`${remaining.length} existing files/folders`
					);
				}
				if (hasOtherRulesFiles) {
					preservationReasons.push('existing rule files');
				}
				if (result.mcpResult?.hasOtherServers) {
					preservationReasons.push('other MCP server configurations');
				}

				const preservationMessage = `Preserved ${preservationReasons.join(', ')} in ${profile.profileDir}`;

				if (!result.notice) {
					result.notice = preservationMessage;
				} else if (!result.notice.includes('Preserved')) {
					result.notice += `; ${preservationMessage.toLowerCase()}`;
				}

				log('info', `[Rule Transformer] ${preservationMessage}`);
			}
		}

		result.success = true;
		log(
			'debug',
			`[Rule Transformer] Successfully removed ${profile.profileName} Task Master files from ${projectRoot}`
		);
	} catch (error) {
		result.error = error.message;
		log(
			'error',
			`[Rule Transformer] Failed to remove ${profile.profileName} rules: ${error.message}`
		);
	}

	return result;
}
