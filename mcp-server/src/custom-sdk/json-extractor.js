/**
 * @fileoverview Extract JSON from MCP response, handling markdown blocks and other formatting
 */

/**
 * Extract JSON from MCP AI response
 * @param {string} text - The text to extract JSON from
 * @returns {string} - The extracted JSON string
 */
export function extractJson(text) {
	// Remove markdown code blocks if present
	let jsonText = text.trim();

	// Remove ```json blocks
	jsonText = jsonText.replace(/^```json\s*/gm, '');
	jsonText = jsonText.replace(/^```\s*/gm, '');
	jsonText = jsonText.replace(/```\s*$/gm, '');

	// Remove common TypeScript/JavaScript patterns
	jsonText = jsonText.replace(/^const\s+\w+\s*=\s*/, ''); // Remove "const varName = "
	jsonText = jsonText.replace(/^let\s+\w+\s*=\s*/, ''); // Remove "let varName = "
	jsonText = jsonText.replace(/^var\s+\w+\s*=\s*/, ''); // Remove "var varName = "
	jsonText = jsonText.replace(/;?\s*$/, ''); // Remove trailing semicolons

	// Remove explanatory text before JSON (common with AI responses)
	jsonText = jsonText.replace(/^.*?(?=\{|\[)/s, '');

	// Remove explanatory text after JSON
	const lines = jsonText.split('\n');
	let jsonEndIndex = -1;
	let braceCount = 0;
	let inString = false;
	let escapeNext = false;

	// Find the end of the JSON by tracking braces
	for (let i = 0; i < jsonText.length; i++) {
		const char = jsonText[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		if (char === '\\') {
			escapeNext = true;
			continue;
		}

		if (char === '"' && !escapeNext) {
			inString = !inString;
			continue;
		}

		if (!inString) {
			if (char === '{' || char === '[') {
				braceCount++;
			} else if (char === '}' || char === ']') {
				braceCount--;
				if (braceCount === 0) {
					jsonEndIndex = i;
					break;
				}
			}
		}
	}

	if (jsonEndIndex > -1) {
		jsonText = jsonText.substring(0, jsonEndIndex + 1);
	}

	// Try to extract JSON object or array if previous method didn't work
	if (jsonEndIndex === -1) {
		const objectMatch = jsonText.match(/{[\s\S]*}/);
		const arrayMatch = jsonText.match(/\[[\s\S]*\]/);

		if (objectMatch) {
			jsonText = objectMatch[0];
		} else if (arrayMatch) {
			jsonText = arrayMatch[0];
		}
	}

	// First try to parse as valid JSON
	try {
		JSON.parse(jsonText);
		return jsonText;
	} catch {
		// If it's not valid JSON, it might be a JavaScript object literal
		// Try to convert it to valid JSON
		try {
			// This is a simple conversion that handles basic cases
			// Replace unquoted keys with quoted keys
			const converted = jsonText
				.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
				// Replace single quotes with double quotes
				.replace(/'/g, '"')
				// Handle trailing commas
				.replace(/,\s*([}\]])/g, '$1');

			// Validate the converted JSON
			JSON.parse(converted);
			return converted;
		} catch {
			// If all else fails, return the original text
			// The calling code will handle the error appropriately
			return text;
		}
	}
}
