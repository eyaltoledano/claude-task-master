/**
 * JSON extraction utilities for parsing Cortex Code CLI responses
 */

/**
 * Extract JSON from text that may contain non-JSON content
 * 
 * This function attempts to find and parse JSON content from text that may
 * include markdown code blocks, additional text, or other formatting.
 * 
 * @param text - The text to extract JSON from
 * @returns The parsed JSON object, or null if no valid JSON is found
 */
export function extractJson<T = unknown>(text: string): T | null {
	if (!text || typeof text !== 'string') {
		return null;
	}

	// Try parsing the entire text first (fast path)
	try {
		return JSON.parse(text) as T;
	} catch {
		// Continue to more complex extraction
	}

	// Try to extract JSON from markdown code blocks
	const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
	if (codeBlockMatch) {
		try {
			return JSON.parse(codeBlockMatch[1]) as T;
		} catch {
			// Continue to next strategy
		}
	}

	// Try to find JSON object or array boundaries
	const jsonPatterns = [
		// Object pattern: { ... }
		/\{[\s\S]*\}/,
		// Array pattern: [ ... ]
		/\[[\s\S]*\]/
	];

	for (const pattern of jsonPatterns) {
		const match = text.match(pattern);
		if (match) {
			try {
				return JSON.parse(match[0]) as T;
			} catch {
				// Continue to next pattern
			}
		}
	}

	return null;
}

/**
 * Extract multiple JSON objects from newline-delimited JSON (NDJSON) text
 * This is specifically for Cortex Code's --output-format stream-json
 * 
 * @param text - The NDJSON text to parse
 * @returns Array of parsed JSON objects
 */
export function extractStreamJson<T = unknown>(text: string): T[] {
	if (!text || typeof text !== 'string') {
		return [];
	}

	const results: T[] = [];
	const lines = text.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		try {
			const parsed = JSON.parse(trimmed) as T;
			results.push(parsed);
		} catch {
			// Skip invalid JSON lines
			continue;
		}
	}

	return results;
}

/**
 * Validate if a string contains valid JSON
 * 
 * @param text - The text to validate
 * @returns True if the text is valid JSON
 */
export function isValidJson(text: string): boolean {
	if (!text || typeof text !== 'string') {
		return false;
	}

	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Clean and normalize JSON text before parsing
 * Removes common issues like trailing commas, comments, etc.
 * 
 * @param text - The text to clean
 * @returns Cleaned JSON text
 */
export function cleanJsonText(text: string): string {
	if (!text || typeof text !== 'string') {
		return '';
	}

	let cleaned = text.trim();

	// Remove single-line comments
	cleaned = cleaned.replace(/\/\/.*$/gm, '');

	// Remove multi-line comments
	cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

	// Remove trailing commas in objects and arrays
	cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

	return cleaned;
}

