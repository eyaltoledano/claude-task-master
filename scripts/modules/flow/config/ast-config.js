import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * AST Configuration Manager for Task Master Flow
 * Handles loading and validation of AST analysis configuration
 */

// Default AST configuration
const DEFAULT_AST_CONFIG = {
	enabled: false,
	cacheMaxAge: '2h',
	cacheMaxSize: '100MB',
	supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
	excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '*.min.js'],
	contextInclusion: {
		maxFunctions: 10,
		maxComplexityScore: 8,
		includeImports: true,
		includeDependencies: true
	}
};

/**
 * Load AST configuration from flow-config.json
 * @returns {Promise<Object>} AST configuration object
 */
export async function loadASTConfig() {
	try {
		// Try Flow-specific config first
		const flowConfigPath = path.join(
			path.dirname(fileURLToPath(import.meta.url)),
			'../flow-config.json'
		);
		
		try {
			const flowConfig = await fs.readFile(flowConfigPath, 'utf8');
			const flowParsed = JSON.parse(flowConfig);
			
			if (flowParsed.ast) {
				// Merge with defaults to ensure all required fields exist
				return {
					success: true,
					config: { ...DEFAULT_AST_CONFIG, ...flowParsed.ast }
				};
			}
		} catch (flowError) {
			// Flow config doesn't exist or doesn't have ast section
			console.debug('AST config not found in flow-config.json, using defaults');
		}

		// Return defaults if no config found
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	} catch (error) {
		console.warn('Error loading AST config:', error.message);
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	}
}

/**
 * Validate AST configuration
 * @param {Object} config - AST configuration to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateASTConfig(config) {
	const errors = [];
	
	// Check required fields
	if (typeof config.enabled !== 'boolean') {
		errors.push('enabled must be a boolean');
	}
	
	if (typeof config.cacheMaxAge !== 'string') {
		errors.push('cacheMaxAge must be a string');
	} else {
		// Validate cache age format (e.g., "2h", "30m", "24h")
		const cacheAgePattern = /^\d+[mhd]$/;
		if (!cacheAgePattern.test(config.cacheMaxAge)) {
			errors.push('cacheMaxAge must be in format like "2h", "30m", or "24h"');
		}
	}
	
	if (typeof config.cacheMaxSize !== 'string') {
		errors.push('cacheMaxSize must be a string');
	} else {
		// Validate cache size format (e.g., "100MB", "1GB")
		const cacheSizePattern = /^\d+(MB|GB)$/;
		if (!cacheSizePattern.test(config.cacheMaxSize)) {
			errors.push('cacheMaxSize must be in format like "100MB" or "1GB"');
		}
	}
	
	if (!Array.isArray(config.supportedLanguages)) {
		errors.push('supportedLanguages must be an array');
	} else {
		const validLanguages = ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'php', 'ruby'];
		const invalidLanguages = config.supportedLanguages.filter(lang => !validLanguages.includes(lang));
		if (invalidLanguages.length > 0) {
			errors.push(`Invalid languages: ${invalidLanguages.join(', ')}. Valid languages: ${validLanguages.join(', ')}`);
		}
	}
	
	if (!Array.isArray(config.excludePatterns)) {
		errors.push('excludePatterns must be an array');
	}
	
	if (!config.contextInclusion || typeof config.contextInclusion !== 'object') {
		errors.push('contextInclusion must be an object');
	} else {
		const ctx = config.contextInclusion;
		if (typeof ctx.maxFunctions !== 'number' || ctx.maxFunctions < 1) {
			errors.push('contextInclusion.maxFunctions must be a positive number');
		}
		if (typeof ctx.maxComplexityScore !== 'number' || ctx.maxComplexityScore < 1 || ctx.maxComplexityScore > 10) {
			errors.push('contextInclusion.maxComplexityScore must be a number between 1 and 10');
		}
		if (typeof ctx.includeImports !== 'boolean') {
			errors.push('contextInclusion.includeImports must be a boolean');
		}
		if (typeof ctx.includeDependencies !== 'boolean') {
			errors.push('contextInclusion.includeDependencies must be a boolean');
		}
	}
	
	return {
		isValid: errors.length === 0,
		errors,
		config: errors.length === 0 ? config : null
	};
}

/**
 * Parse cache duration string to milliseconds
 * @param {string} duration - Duration string like "2h", "30m", "24h"
 * @returns {number} Duration in milliseconds
 */
export function parseCacheDuration(duration) {
	const match = duration.match(/^(\d+)([mhd])$/);
	if (!match) {
		throw new Error(`Invalid duration format: ${duration}`);
	}
	
	const value = parseInt(match[1], 10);
	const unit = match[2];
	
	switch (unit) {
		case 'm': return value * 60 * 1000; // minutes to ms
		case 'h': return value * 60 * 60 * 1000; // hours to ms  
		case 'd': return value * 24 * 60 * 60 * 1000; // days to ms
		default: throw new Error(`Invalid duration unit: ${unit}`);
	}
}

/**
 * Parse cache size string to bytes
 * @param {string} size - Size string like "100MB", "1GB"
 * @returns {number} Size in bytes
 */
export function parseCacheSize(size) {
	const match = size.match(/^(\d+)(MB|GB)$/);
	if (!match) {
		throw new Error(`Invalid size format: ${size}`);
	}
	
	const value = parseInt(match[1], 10);
	const unit = match[2];
	
	switch (unit) {
		case 'MB': return value * 1024 * 1024; // MB to bytes
		case 'GB': return value * 1024 * 1024 * 1024; // GB to bytes
		default: throw new Error(`Invalid size unit: ${unit}`);
	}
}

/**
 * Check if AST analysis is enabled for a specific language
 * @param {Object} config - AST configuration
 * @param {string} language - Language to check (e.g., 'javascript', 'python')
 * @returns {boolean} True if language is supported and enabled
 */
export function isLanguageSupported(config, language) {
	return config.enabled && config.supportedLanguages.includes(language);
}

/**
 * Get file extensions supported by AST analysis
 * @param {Object} config - AST configuration
 * @returns {Array<string>} Array of file extensions (e.g., ['.js', '.ts', '.py'])
 */
export function getSupportedExtensions(config) {
	const extensionMap = {
		'javascript': ['.js', '.jsx'],
		'typescript': ['.ts', '.tsx'],
		'python': ['.py'],
		'go': ['.go'],
		'rust': ['.rs'],
		'java': ['.java'],
		'csharp': ['.cs'],
		'php': ['.php'],
		'ruby': ['.rb']
	};
	
	const extensions = [];
	for (const language of config.supportedLanguages) {
		if (extensionMap[language]) {
			extensions.push(...extensionMap[language]);
		}
	}
	
	return [...new Set(extensions)]; // Remove duplicates
} 