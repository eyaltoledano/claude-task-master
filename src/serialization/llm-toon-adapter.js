/**
 * LLM TOON Adapter
 * 
 * Provides integration layer for using TOON serialization with LLM providers.
 * This adapter intercepts LLM calls to convert JSON payloads to TOON format
 * and converts TOON responses back to JSON.
 */

import { jsonToToon, toonToJson, estimateTokenSavings, validateToonRoundTrip } from './toon-serializer.js';
import { log } from '../../scripts/modules/utils.js';

/**
 * Configuration for TOON usage
 */
export const TOON_CONFIG = {
	// Enable/disable TOON serialization globally
	enabled: false,
	
	// Minimum data size to consider TOON (avoid overhead for tiny payloads)
	minDataSize: 100,
	
	// Minimum expected savings percentage to use TOON
	minSavingsThreshold: 10,
	
	// Data types/structures that work well with TOON
	preferredStructures: [
		'arrays_of_objects',
		'flat_objects',
		'uniform_data'
	],
	
	// Data types/structures to avoid with TOON
	avoidStructures: [
		'deeply_nested',
		'sparse_objects',
		'mixed_types'
	]
};

/**
 * Analyzes data to determine if TOON serialization would be beneficial
 * @param {any} data - Data to analyze
 * @returns {object} Analysis results with recommendation
 */
export function analyzeToonSuitability(data) {
	try {
		if (!data || typeof data !== 'object') {
			return {
				suitable: false,
				reason: 'Data is not an object or is null/undefined',
				structure: typeof data
			};
		}
		
		const jsonString = JSON.stringify(data);
		if (jsonString.length < TOON_CONFIG.minDataSize) {
			return {
				suitable: false,
				reason: `Data size (${jsonString.length}) below minimum threshold (${TOON_CONFIG.minDataSize})`,
				size: jsonString.length
			};
		}
		
		const savings = estimateTokenSavings(data);
		if (!savings) {
			return {
				suitable: false,
				reason: 'Unable to estimate token savings'
			};
		}
		
		if (savings.savingsPercentage < TOON_CONFIG.minSavingsThreshold) {
			return {
				suitable: false,
				reason: `Estimated savings (${savings.savingsPercentage}%) below threshold (${TOON_CONFIG.minSavingsThreshold}%)`,
				savings
			};
		}
		
		// Analyze data structure
		const structure = analyzeDataStructure(data);
		
		return {
			suitable: true,
			reason: `Good candidate: ${savings.savingsPercentage}% token savings expected`,
			savings,
			structure,
			recommendation: 'Use TOON for this data'
		};
		
	} catch (error) {
		log('error', `Error analyzing TOON suitability: ${error.message}`);
		return {
			suitable: false,
			reason: `Analysis failed: ${error.message}`,
			error: error.message
		};
	}
}

/**
 * Analyze data structure characteristics
 * @param {any} data - Data to analyze
 * @returns {object} Structure analysis
 */
function analyzeDataStructure(data) {
	const analysis = {
		type: Array.isArray(data) ? 'array' : 'object',
		depth: 0,
		uniformity: 0,
		repetition: 0
	};
	
	// Calculate maximum nesting depth
	analysis.depth = calculateDepth(data);
	
	// Analyze uniformity for arrays
	if (Array.isArray(data) && data.length > 0) {
		const firstItemKeys = data[0] && typeof data[0] === 'object' ? Object.keys(data[0]).sort() : [];
		let uniformCount = 0;
		
		for (const item of data) {
			if (typeof item === 'object' && item !== null) {
				const itemKeys = Object.keys(item).sort();
				if (JSON.stringify(itemKeys) === JSON.stringify(firstItemKeys)) {
					uniformCount++;
				}
			}
		}
		
		analysis.uniformity = data.length > 0 ? uniformCount / data.length : 0;
	}
	
	// Analyze key repetition for objects
	const allKeys = [];
	collectAllKeys(data, allKeys);
	const keyFrequency = {};
	for (const key of allKeys) {
		keyFrequency[key] = (keyFrequency[key] || 0) + 1;
	}
	
	const totalKeys = allKeys.length;
	const uniqueKeys = Object.keys(keyFrequency).length;
	analysis.repetition = totalKeys > 0 ? (totalKeys - uniqueKeys) / totalKeys : 0;
	
	return analysis;
}

function calculateDepth(obj, currentDepth = 0) {
	if (typeof obj !== 'object' || obj === null) {
		return currentDepth;
	}
	
	let maxDepth = currentDepth;
	const values = Array.isArray(obj) ? obj : Object.values(obj);
	
	for (const value of values) {
		const depth = calculateDepth(value, currentDepth + 1);
		maxDepth = Math.max(maxDepth, depth);
	}
	
	return maxDepth;
}

function collectAllKeys(obj, keys) {
	if (typeof obj === 'object' && obj !== null) {
		if (Array.isArray(obj)) {
			for (const item of obj) {
				collectAllKeys(item, keys);
			}
		} else {
			for (const [key, value] of Object.entries(obj)) {
				keys.push(key);
				collectAllKeys(value, keys);
			}
		}
	}
}

/**
 * Wraps LLM provider methods to use TOON serialization when beneficial
 * @param {object} provider - Original LLM provider instance
 * @returns {object} Wrapped provider with TOON support
 */
export function wrapProviderWithToon(provider) {
	if (!TOON_CONFIG.enabled) {
		log('debug', 'TOON serialization is disabled, returning original provider');
		return provider;
	}
	
	const originalGenerateText = provider.generateText.bind(provider);
	const originalGenerateObject = provider.generateObject.bind(provider);
	const originalStreamText = provider.streamText.bind(provider);
	const originalStreamObject = provider.streamObject.bind(provider);
	
	return {
		...provider,
		
		async generateText(params) {
			return await processWithToon(
				params,
				originalGenerateText,
				'generateText'
			);
		},
		
		async generateObject(params) {
			return await processWithToon(
				params,
				originalGenerateObject,
				'generateObject'
			);
		},
		
		async streamText(params) {
			return await processWithToon(
				params,
				originalStreamText,
				'streamText'
			);
		},
		
		async streamObject(params) {
			return await processWithToon(
				params,
				originalStreamObject,
				'streamObject'
			);
		}
	};
}

/**
 * Process LLM call with TOON optimization if suitable
 * @param {object} params - LLM call parameters
 * @param {function} originalMethod - Original provider method
 * @param {string} methodName - Name of the method being called
 * @returns {any} Result from LLM call
 */
async function processWithToon(params, originalMethod, methodName) {
	try {
		// Analyze if we should use TOON for the data in messages
		let useToon = false;
		let suitabilityAnalysis = null;
		
		// Check if there's structured data in the messages that could benefit from TOON
		for (const message of params.messages || []) {
			if (typeof message.content === 'object') {
				suitabilityAnalysis = analyzeToonSuitability(message.content);
				if (suitabilityAnalysis.suitable) {
					useToon = true;
					break;
				}
			}
		}
		
		if (!useToon) {
			log('debug', `TOON not suitable for ${methodName}, using standard JSON`);
			return await originalMethod(params);
		}
		
		log('info', `Using TOON serialization for ${methodName}: ${suitabilityAnalysis.reason}`);
		
		// Convert messages to use TOON format
		const toonParams = {
			...params,
			messages: params.messages.map(message => {
				if (typeof message.content === 'object') {
					const toonContent = jsonToToon(message.content);
					return {
						...message,
						content: `[TOON FORMAT]\n${toonContent}`
					};
				}
				return message;
			})
		};
		
		// Add TOON format instruction to the system message or create one
		const systemInstructions = `
You are working with data in TOON (Token-Oriented Object Notation) format.
TOON is a compact alternative to JSON that reduces token usage.

When you see "[TOON FORMAT]" in the input, the following data is in TOON format.
When generating responses with structured data, you may use either JSON or TOON format.

TOON Format Rules:
- Objects: {key:value key2:value2} (no quotes around keys unless they contain spaces)
- Arrays: [item1 item2 item3] (space-separated)  
- Strings: quoted only if they contain spaces or special characters
- No unnecessary brackets, quotes, or commas

Example: {name:John age:30 skills:[JavaScript Python Go]}
`;
		
		// Prepend system instructions if there's already a system message, otherwise create one
		const existingSystemMessage = toonParams.messages.find(msg => msg.role === 'system');
		if (existingSystemMessage) {
			existingSystemMessage.content = systemInstructions + '\n\n' + existingSystemMessage.content;
		} else {
			toonParams.messages.unshift({
				role: 'system',
				content: systemInstructions
			});
		}
		
		// Call the original method with TOON-optimized parameters
		const result = await originalMethod(toonParams);
		
		// Log the token savings achieved
		if (suitabilityAnalysis.savings) {
			log('info', `TOON optimization saved approximately ${suitabilityAnalysis.savings.estimatedTokenSavings} tokens (${suitabilityAnalysis.savings.estimatedTokenSavingsPercentage}%)`);
		}
		
		return result;
		
	} catch (error) {
		log('error', `Error in TOON processing for ${methodName}: ${error.message}`);
		// Fallback to original method if TOON processing fails
		log('warn', `Falling back to standard JSON for ${methodName}`);
		return await originalMethod(params);
	}
}

/**
 * Enable TOON serialization globally
 * @param {object} config - Configuration overrides
 */
export function enableToon(config = {}) {
	Object.assign(TOON_CONFIG, config, { enabled: true });
	log('info', 'TOON serialization enabled globally');
}

/**
 * Disable TOON serialization globally
 */
export function disableToon() {
	TOON_CONFIG.enabled = false;
	log('info', 'TOON serialization disabled globally');
}

/**
 * Get current TOON configuration
 * @returns {object} Current TOON configuration
 */
export function getToonConfig() {
	return { ...TOON_CONFIG };
}