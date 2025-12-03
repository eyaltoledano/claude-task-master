/**
 * TOON (Token-Oriented Object Notation) Serialization Utilities
 * 
 * TOON is a compact, schema-aware format that reduces token usage by 30-60% versus JSON
 * by eliminating syntactic overhead (braces, quotes, repeated fields).
 * 
 * This implementation provides conversion between JSON and TOON format
 * for LLM data serialization at the provider boundary layer.
 */

import { log } from '../../scripts/modules/utils.js';

/**
 * Convert JSON data to TOON format
 * @param {any} data - The data to convert to TOON
 * @param {object} options - Conversion options
 * @param {boolean} options.preserveTypes - Whether to preserve type information
 * @returns {string} TOON formatted string
 */
export function jsonToToon(data, options = { preserveTypes: true }) {
	try {
		if (data === null) return 'null';
		if (data === undefined) return 'undefined';
		
		// Handle primitive types
		if (typeof data === 'string') {
			// Escape special characters and wrap in quotes only if necessary
			return data.includes(' ') || data.includes('\n') ? `"${data.replace(/"/g, '\\"')}"` : data;
		}
		if (typeof data === 'number') return data.toString();
		if (typeof data === 'boolean') return data.toString();
		
		// Handle arrays - use space-separated values instead of brackets
		if (Array.isArray(data)) {
			if (data.length === 0) return '[]';
			const items = data.map(item => jsonToToon(item, options));
			return `[${items.join(' ')}]`;
		}
		
		// Handle objects - use key:value pairs separated by spaces
		if (typeof data === 'object') {
			const entries = Object.entries(data);
			if (entries.length === 0) return '{}';
			
			const pairs = entries.map(([key, value]) => {
				const toonValue = jsonToToon(value, options);
				// Use colon separator without spaces for compactness
				return `${key}:${toonValue}`;
			});
			
			return `{${pairs.join(' ')}}`;
		}
		
		return String(data);
	} catch (error) {
		log('error', `Failed to convert JSON to TOON: ${error.message}`);
		throw new Error(`TOON serialization error: ${error.message}`);
	}
}

/**
 * Convert TOON format back to JSON
 * @param {string} toonData - The TOON formatted string
 * @returns {any} Parsed JSON data
 */
export function toonToJson(toonData) {
	try {
		if (!toonData || typeof toonData !== 'string') {
			throw new Error('Invalid TOON data: must be a non-empty string');
		}
		
		const trimmed = toonData.trim();
		if (!trimmed) return null;
		
		// Handle primitive values
		if (trimmed === 'null') return null;
		if (trimmed === 'undefined') return undefined;
		if (trimmed === 'true') return true;
		if (trimmed === 'false') return false;
		
		// Handle numbers
		if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
			return Number(trimmed);
		}
		
		// Handle quoted strings
		if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
			return trimmed.slice(1, -1).replace(/\\"/g, '"');
		}
		
		// Handle arrays
		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			const content = trimmed.slice(1, -1).trim();
			if (!content) return [];
			
			const items = parseTooonItems(content);
			return items.map(item => toonToJson(item));
		}
		
		// Handle objects
		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			const content = trimmed.slice(1, -1).trim();
			if (!content) return {};
			
			const result = {};
			const pairs = parseTooonItems(content);
			
			for (const pair of pairs) {
				const colonIndex = pair.indexOf(':');
				if (colonIndex === -1) {
					throw new Error(`Invalid TOON object pair: ${pair}`);
				}
				
				const key = pair.substring(0, colonIndex).trim();
				const value = pair.substring(colonIndex + 1).trim();
				result[key] = toonToJson(value);
			}
			
			return result;
		}
		
		// Handle unquoted strings
		return trimmed;
		
	} catch (error) {
		log('error', `Failed to convert TOON to JSON: ${error.message}`);
		throw new Error(`TOON deserialization error: ${error.message}`);
	}
}

/**
 * Parse TOON items while respecting nested structures
 * @param {string} content - Content to parse
 * @returns {string[]} Array of parsed items
 */
function parseTooonItems(content) {
	const items = [];
	let current = '';
	let depth = 0;
	let inQuotes = false;
	let escaped = false;
	
	for (let i = 0; i < content.length; i++) {
		const char = content[i];
		
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		
		if (char === '\\') {
			escaped = true;
			current += char;
			continue;
		}
		
		if (char === '"' && !escaped) {
			inQuotes = !inQuotes;
			current += char;
			continue;
		}
		
		if (inQuotes) {
			current += char;
			continue;
		}
		
		if (char === '{' || char === '[') {
			depth++;
			current += char;
		} else if (char === '}' || char === ']') {
			depth--;
			current += char;
		} else if (char === ' ' && depth === 0) {
			if (current.trim()) {
				items.push(current.trim());
				current = '';
			}
		} else {
			current += char;
		}
	}
	
	if (current.trim()) {
		items.push(current.trim());
	}
	
	return items;
}

/**
 * Estimate token savings from using TOON vs JSON
 * @param {any} data - The data to analyze
 * @returns {object} Analysis of token savings
 */
export function estimateTokenSavings(data) {
	try {
		const jsonString = JSON.stringify(data);
		const toonString = jsonToToon(data);
		
		const jsonLength = jsonString.length;
		const toonLength = toonString.length;
		const savings = jsonLength - toonLength;
		const savingsPercentage = jsonLength > 0 ? (savings / jsonLength) * 100 : 0;
		
		// Rough token estimation (1 token ≈ 4 characters for English text)
		const estimatedJsonTokens = Math.ceil(jsonLength / 4);
		const estimatedToonTokens = Math.ceil(toonLength / 4);
		const tokenSavings = estimatedJsonTokens - estimatedToonTokens;
		
		return {
			jsonLength,
			toonLength,
			characterSavings: savings,
			savingsPercentage: Math.round(savingsPercentage * 100) / 100,
			estimatedJsonTokens,
			estimatedToonTokens,
			estimatedTokenSavings: tokenSavings,
			estimatedTokenSavingsPercentage: estimatedJsonTokens > 0 ? Math.round((tokenSavings / estimatedJsonTokens) * 10000) / 100 : 0
		};
	} catch (error) {
		log('error', `Failed to estimate token savings: ${error.message}`);
		return null;
	}
}

/**
 * Validate that TOON data can be round-tripped (JSON -> TOON -> JSON)
 * @param {any} data - The data to validate
 * @returns {object} Validation results
 */
export function validateToonRoundTrip(data) {
	try {
		const toonData = jsonToToon(data);
		const reconstructedData = toonToJson(toonData);
		
		// Deep comparison for validation
		const isValid = JSON.stringify(data) === JSON.stringify(reconstructedData);
		
		return {
			isValid,
			original: data,
			toon: toonData,
			reconstructed: reconstructedData,
			...(isValid ? {} : { 
				error: 'Data mismatch after round-trip conversion' 
			})
		};
	} catch (error) {
		return {
			isValid: false,
			error: error.message,
			original: data
		};
	}
}