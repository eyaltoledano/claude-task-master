/**
 * Rule Transformer Module
 * Handles conversion of Cursor rules to profile rules
 *
 * This module procedurally generates .{profile}/rules files from assets/rules files,
 * eliminating the need to maintain both sets of files manually.
 */
import fs from 'fs';
import path from 'path';
import { log } from '../../scripts/modules/utils.js';

// Import asset resolver
import { assetExists, readAsset, getAssetsDir } from './asset-resolver.js';

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
	const targetDir = path.join(projectRoot, profile.rulesDir);

	let success = 0;
	let failed = 0;

	// 1. Call onAddRulesProfile first (for pre-processing like copying assets)
	if (typeof profile.onAddRulesProfile === 'function') {
		try {
			const assetsDir = getAssetsDir();
			profile.onAddRulesProfile(targetDir, assetsDir);
			log(
				'debug',
				`[Rule Transformer] Called onAddRulesProfile for ${profile.profileName}`
			);
		} catch (error) {
			log(
				'error',
				`[Rule Transformer] onAddRulesProfile failed for ${profile.profileName}: ${error.message}`
			);
			failed++;
		}
	}

	// 2. Handle fileMap-based rule conversion (if any)
	const sourceFiles = Object.keys(profile.fileMap);
	if (sourceFiles.length > 0) {
		// Only create rules directory if we have files to copy
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		for (const sourceFile of sourceFiles) {
			// Determine if this is an asset file (not a rule file)
			const isAssetFile = !sourceFile.startsWith('rules/');

			try {
				// Check if source file exists using asset resolver
				if (!assetExists(sourceFile)) {
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

				// Read source content using asset resolver
				let content = readAsset(sourceFile, 'utf8');

				// Apply transformations (only if this is a rule file, not an asset file)
				if (!isAssetFile) {
					content = transformRuleContent(
						content,
						profile.conversionConfig,
						profile.globalReplacements
					);
				}

				// Write to target
				fs.writeFileSync(targetPath, content, 'utf8');
				success++;

				log(
					'debug',
					`[Rule Transformer] ${isAssetFile ? 'Copied' : 'Converted'} ${sourceFile} -> ${targetFilename} for ${profile.profileName}`
				);
			} catch (error) {
				failed++;
				log(
					'error',
					`[Rule Transformer] Failed to ${isAssetFile ? 'copy' : 'convert'} ${sourceFile} for ${profile.profileName}: ${error.message}`
				);
			}
		}
	}

	// 3. Setup MCP configuration (if enabled)
	if (profile.mcpConfig !== false) {
		try {
			setupMCPConfiguration(projectRoot, profile.mcpConfigPath);
			log(
				'debug',
				`[Rule Transformer] Setup MCP configuration for ${profile.profileName}`
			);
		} catch (error) {
			log(
				'error',
				`[Rule Transformer] MCP setup failed for ${profile.profileName}: ${error.message}`
			);
		}
	}

	// 4. Call post-conversion hook (for finalization)
	if (typeof profile.onPostConvertRulesProfile === 'function') {
		try {
			const assetsDir = getAssetsDir();
			profile.onPostConvertRulesProfile(targetDir, assetsDir);
			log(
				'debug',
				`[Rule Transformer] Called onPostConvertRulesProfile for ${profile.profileName}`
			);
		} catch (error) {
			log(
				'error',
				`[Rule Transformer] onPostConvertRulesProfile failed for ${profile.profileName}: ${error.message}`
			);
		}
	}

	// Ensure we return at least 1 success for profiles that only use lifecycle functions
	return { success: Math.max(success, 1), failed };
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
		// 1. Call onRemoveRulesProfile first (for custom cleanup like removing assets)
		if (typeof profile.onRemoveRulesProfile === 'function') {
			try {
				profile.onRemoveRulesProfile(targetDir);
				log(
					'debug',
					`[Rule Transformer] Called onRemoveRulesProfile for ${profile.profileName}`
				);
			} catch (error) {
				log(
					'error',
					`[Rule Transformer] onRemoveRulesProfile failed for ${profile.profileName}: ${error.message}`
				);
			}
		}

		// 2. Remove fileMap-based files (if any)
		const sourceFiles = Object.keys(profile.fileMap);
		if (sourceFiles.length > 0) {
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

			let hasOtherRulesFiles = false;

			if (fs.existsSync(targetDir)) {
				// Get list of files we're responsible for
				const taskMasterFiles = sourceFiles.map(
					(sourceFile) => profile.fileMap[sourceFile]
				);

				// Get all files in the rules directory
				// For root-level directories, we need to be careful to avoid circular symlinks
				let allFiles = [];
				if (targetDir === projectRoot || profile.rulesDir === '.') {
					// For root directory, manually read without recursion into problematic directories
					const items = fs.readdirSync(targetDir);
					for (const item of items) {
						// Skip directories that can cause issues or are irrelevant
						if (item === 'node_modules' || item === '.git' || item === 'dist') {
							continue;
						}
						const itemPath = path.join(targetDir, item);
						try {
							const stats = fs.lstatSync(itemPath);
							if (stats.isFile()) {
								allFiles.push(item);
							} else if (stats.isDirectory() && !stats.isSymbolicLink()) {
								// Only recurse into safe directories
								const subFiles = fs.readdirSync(itemPath, { recursive: true });
								subFiles.forEach((subFile) => {
									allFiles.push(path.join(item, subFile.toString()));
								});
							}
						} catch (err) {
							// Silently skip files we can't access
						}
					}
				} else {
					// For non-root directories, use normal recursive read
					allFiles = fs.readdirSync(targetDir, { recursive: true });
				}

				const allFilePaths = allFiles
					.filter((file) => {
						const fullPath = path.join(targetDir, file);
						try {
							const stats = fs.statSync(fullPath);
							return stats.isFile();
						} catch (err) {
							return false;
						}
					})
					.map((file) => file.toString()); // Ensure it's a string

				// Remove only Task Master files
				for (const taskMasterFile of taskMasterFiles) {
					const filePath = path.join(targetDir, taskMasterFile);
					if (fs.existsSync(filePath)) {
						try {
							fs.rmSync(filePath, { force: true });
							result.filesRemoved.push(taskMasterFile);
							log(
								'debug',
								`[Rule Transformer] Removed Task Master file: ${taskMasterFile}`
							);
						} catch (error) {
							log(
								'error',
								`[Rule Transformer] Failed to remove ${taskMasterFile}: ${error.message}`
							);
						}
					}
				}

				// Check for other (non-Task Master) files
				const remainingFiles = allFilePaths.filter(
					(file) => !taskMasterFiles.includes(file)
				);

				hasOtherRulesFiles = remainingFiles.length > 0;

				// Remove empty directories or note preserved files
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
		}

		// 3. Handle MCP configuration - only remove Task Master, preserve other servers
		if (profile.mcpConfig !== false) {
			try {
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
				log(
					'debug',
					`[Rule Transformer] Processed MCP configuration for ${profile.profileName}`
				);
			} catch (error) {
				log(
					'error',
					`[Rule Transformer] MCP cleanup failed for ${profile.profileName}: ${error.message}`
				);
			}
		}

		// 4. Check if we should remove the entire profile directory
		if (fs.existsSync(profileDir)) {
			const remainingContents = fs.readdirSync(profileDir);
			if (remainingContents.length === 0 && profile.profileDir !== '.') {
				// Only remove profile directory if it's empty and not root directory
				try {
					fs.rmSync(profileDir, { recursive: true, force: true });
					result.profileDirRemoved = true;
					log(
						'debug',
						`[Rule Transformer] Removed empty profile directory: ${profileDir}`
					);
				} catch (error) {
					log(
						'error',
						`[Rule Transformer] Failed to remove profile directory ${profileDir}: ${error.message}`
					);
				}
			} else if (remainingContents.length > 0) {
				// Profile directory has remaining files/folders, add notice
				const preservedNotice = `Preserved ${remainingContents.length} existing files/folders in ${profile.profileDir}`;
				if (!result.notice) {
					result.notice = preservedNotice;
				} else {
					result.notice += `; ${preservedNotice.toLowerCase()}`;
				}
				log('info', `[Rule Transformer] ${preservedNotice}`);
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
