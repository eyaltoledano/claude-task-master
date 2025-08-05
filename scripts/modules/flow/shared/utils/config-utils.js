/**
 * Configuration Utilities for AST and Flow Configuration
 * Contains utility functions for parsing, validation, and helper functions
 */

/**
 * Validate AST configuration
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
		const validLanguages = [
			'javascript',
			'typescript',
			'python',
			'go',
			'rust',
			'java',
			'csharp',
			'php',
			'ruby'
		];
		const invalidLanguages = config.supportedLanguages.filter(
			(lang) => !validLanguages.includes(lang)
		);
		if (invalidLanguages.length > 0) {
			errors.push(
				`Invalid languages: ${invalidLanguages.join(', ')}. Valid languages: ${validLanguages.join(', ')}`
			);
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
		if (
			typeof ctx.maxComplexityScore !== 'number' ||
			ctx.maxComplexityScore < 1 ||
			ctx.maxComplexityScore > 10
		) {
			errors.push(
				'contextInclusion.maxComplexityScore must be a number between 1 and 10'
			);
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
 */
export function parseCacheDuration(duration) {
	const match = duration.match(/^(\d+)([mhd])$/);
	if (!match) {
		throw new Error(`Invalid duration format: ${duration}`);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	switch (unit) {
		case 'm':
			return value * 60 * 1000; // minutes to ms
		case 'h':
			return value * 60 * 60 * 1000; // hours to ms
		case 'd':
			return value * 24 * 60 * 60 * 1000; // days to ms
		default:
			throw new Error(`Invalid duration unit: ${unit}`);
	}
}

/**
 * Parse cache size string to bytes
 */
export function parseCacheSize(size) {
	const match = size.match(/^(\d+)(MB|GB)$/);
	if (!match) {
		throw new Error(`Invalid size format: ${size}`);
	}

	const value = parseInt(match[1], 10);
	const unit = match[2];

	switch (unit) {
		case 'MB':
			return value * 1024 * 1024; // MB to bytes
		case 'GB':
			return value * 1024 * 1024 * 1024; // GB to bytes
		default:
			throw new Error(`Invalid size unit: ${unit}`);
	}
}

/**
 * Check if AST analysis is enabled for a specific language
 */
export function isLanguageSupported(config, language) {
	return config.enabled && config.supportedLanguages.includes(language);
}

/**
 * Get file extensions supported by AST analysis
 */
export function getSupportedExtensions(config) {
	const extensionMap = {
		javascript: ['.js', '.jsx'],
		typescript: ['.ts', '.tsx'],
		python: ['.py'],
		go: ['.go'],
		rust: ['.rs'],
		java: ['.java'],
		csharp: ['.cs'],
		php: ['.php'],
		ruby: ['.rb']
	};

	const extensions = [];
	for (const language of config.supportedLanguages) {
		if (extensionMap[language]) {
			extensions.push(...extensionMap[language]);
		}
	}

	return [...new Set(extensions)]; // Remove duplicates
}

/**
 * Parse configuration value from string
 */
export function parseConfigValue(value) {
	// Handle boolean values directly
	if (typeof value === 'boolean') {
		return value;
	}

	// Convert to string for parsing
	const stringValue = String(value);

	// Handle boolean strings
	if (stringValue === 'true') return true;
	if (stringValue === 'false') return false;

	// Handle numeric strings
	if (/^\d+$/.test(stringValue)) return parseInt(stringValue, 10);
	if (/^\d+\.\d+$/.test(stringValue)) return parseFloat(stringValue);

	// Handle arrays (comma-separated)
	if (stringValue.includes(',')) {
		return stringValue.split(',').map((v) => v.trim());
	}

	// Return as string
	return stringValue;
}

/**
 * Parse size strings like "1MB", "500KB"
 */
export function parseSize(sizeStr) {
	const units = {
		B: 1,
		KB: 1024,
		MB: 1024 * 1024,
		GB: 1024 * 1024 * 1024,
		TB: 1024 * 1024 * 1024 * 1024
	};

	const match = sizeStr.toString().match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
	if (!match) {
		throw new Error(`Invalid size format: ${sizeStr}`);
	}

	const value = parseFloat(match[1]);
	const unit = match[2].toUpperCase();

	return value * (units[unit] || 1);
}

/**
 * Merge configurations with deep merge
 */
export function mergeConfigurations(defaultConfig, userConfig) {
	const merged = JSON.parse(JSON.stringify(defaultConfig));

	function deepMerge(target, source) {
		for (const key in source) {
			if (
				source[key] &&
				typeof source[key] === 'object' &&
				!Array.isArray(source[key])
			) {
				if (!target[key]) target[key] = {};
				deepMerge(target[key], source[key]);
			} else {
				target[key] = source[key];
			}
		}
	}

	deepMerge(merged, userConfig);
	return merged;
}
