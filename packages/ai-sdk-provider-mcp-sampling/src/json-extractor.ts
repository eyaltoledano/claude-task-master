/**
 * JSON extraction utilities for MCP Sampling provider
 */

/**
 * Extract JSON from text response
 * Handles various formats including code blocks and plain JSON
 */
export function extractJson(text: string): string {
	if (!text || typeof text !== 'string') {
		throw new Error('Input text is empty or not a string');
	}

	const trimmedText = text.trim();

	// Try to find JSON in code blocks first
	const codeBlockMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	if (codeBlockMatch) {
		return codeBlockMatch[1].trim();
	}

	// Try to find JSON between specific markers
	const markerMatch = trimmedText.match(/```json\s*([\s\S]*?)\s*```/i);
	if (markerMatch) {
		return markerMatch[1].trim();
	}

	// Look for JSON object/array patterns
	const jsonObjectMatch = trimmedText.match(/\{[\s\S]*\}/);
	const jsonArrayMatch = trimmedText.match(/\[[\s\S]*\]/);

	if (jsonObjectMatch && jsonArrayMatch) {
		// Return the first match that appears
		const objectIndex = trimmedText.indexOf(jsonObjectMatch[0]);
		const arrayIndex = trimmedText.indexOf(jsonArrayMatch[0]);
		return objectIndex < arrayIndex ? jsonObjectMatch[0] : jsonArrayMatch[0];
	}

	if (jsonObjectMatch) {
		return jsonObjectMatch[0];
	}

	if (jsonArrayMatch) {
		return jsonArrayMatch[0];
	}

	// If nothing found, try to parse the entire text as JSON
	try {
		JSON.parse(trimmedText);
		return trimmedText;
	} catch {
		// If all else fails, return the original text
		// The caller should handle JSON parsing errors
		return trimmedText;
	}
}