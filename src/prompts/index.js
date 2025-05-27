/**
 * Centralized prompt management for complexity analysis
 * Provides access to different complexity analysis prompt modes
 */

import { generateStandardPrompt } from './complexity-standard.js';
import { generateBalancedPrompt } from './complexity-balanced.js';
import { generateAdvancedPrompt } from './complexity-advanced.js';
import { 
	COMPLEXITY_MODE_OPTIONS, 
	DEFAULT_COMPLEXITY_MODE,
	getValidComplexityMode
} from '../constants/complexity-modes.js';

/**
 * Generates the prompt for complexity analysis based on the specified mode.
 * @param {Object} tasksData - The tasks data object.
 * @param {string} mode - The complexity mode ('standard', 'balanced', 'advanced').
 * @returns {string} The generated prompt.
 */
export function generateComplexityAnalysisPrompt(tasksData, mode = null) {
	// Validate and get the complexity mode
	const validMode = getValidComplexityMode(mode || DEFAULT_COMPLEXITY_MODE);

	switch (validMode) {
		case 'standard':
			return generateStandardPrompt(tasksData);
		case 'balanced':
			return generateBalancedPrompt(tasksData);
		case 'advanced':
			return generateAdvancedPrompt(tasksData);
		default:
			// This should never happen due to validation, but provide fallback
			return generateBalancedPrompt(tasksData);
	}
}

// Export individual prompt generators for direct use if needed
export {
	generateStandardPrompt,
	generateBalancedPrompt,
	generateAdvancedPrompt
};

// Export complexity mode constants for convenience
export {
	COMPLEXITY_MODE_OPTIONS,
	DEFAULT_COMPLEXITY_MODE
};