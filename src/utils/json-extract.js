// src/utils/json-extract.js
// Tolerant JSON extractor leveraging jsonc-parser with smart boundary detection.

import { parse as parseJsonc } from 'jsonc-parser';
import { jsonrepair } from 'jsonrepair';

/**
 * Attempt to extract the first JSON object/array from free-form text and
 * return a valid JSON string. Uses tolerant JSONC parsing, with a final
 * jsonrepair fallback for salvageable outputs.
 *
 * @param {string} text - Raw model output that may include surrounding prose
 * @returns {string} A JSON string if extraction succeeds, otherwise the original text
 */
export function extractJsonTolerant(text) {
	if (!text || typeof text !== 'string') return text;

	let content = text.trim();
	if (content.length < 2) return text;

	// Strip common wrappers in a single pass
	content = content
		// Remove markdown fences
		.replace(/^.*?```(?:json)?\s*([\s\S]*?)\s*```.*$/i, '$1')
		// Remove variable assignments like: const x = {...};
		.replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*([\s\S]*?)(?:;|\s*)$/i, '$1')
		// Remove common prefixes
		.replace(/^(?:Here's|The)\s+(?:the\s+)?JSON.*?[:]\s*/i, '')
		.trim();

	// Find the first JSON-like structure
	const firstObj = content.indexOf('{');
	const firstArr = content.indexOf('[');
	if (firstObj === -1 && firstArr === -1) return text;

	const start =
		firstArr === -1
			? firstObj
			: firstObj === -1
				? firstArr
				: Math.min(firstObj, firstArr);
	content = content.slice(start);

	const tryParse = (value) => {
		if (!value || value.length < 2) return undefined;
		const errors = [];
		try {
			const result = parseJsonc(value, errors, {
				allowTrailingComma: true,
				allowEmptyContent: false
			});
			if (errors.length === 0 && result !== undefined) {
				return JSON.stringify(result, null, 2);
			}
		} catch {
			// ignore
		}
		return undefined;
	};

	// Try full parse first
	const full = tryParse(content);
	if (full !== undefined) return full;

	// Single-pass boundary detection
	const openChar = content[0];
	const closeChar = openChar === '{' ? '}' : ']';
	let depth = 0;
	let inString = false;
	let escapeNext = false;
	let lastValidEnd = -1;

	for (let i = 0; i < content.length && i < 10000; i++) {
		const ch = content[i];
		if (escapeNext) {
			escapeNext = false;
			continue;
		}
		if (ch === '\\') {
			escapeNext = true;
			continue;
		}
		if (ch === '"') {
			inString = !inString;
			continue;
		}
		if (inString) continue;
		if (ch === openChar) depth++;
		else if (ch === closeChar) {
			depth--;
			if (depth === 0) {
				lastValidEnd = i + 1;
				const candidate = content.slice(0, lastValidEnd);
				const parsed = tryParse(candidate);
				if (parsed !== undefined) return parsed;
			}
		}
	}

	// Fallback: try repair if parsing still failed
	try {
		const repaired = jsonrepair(content);
		const reparsed = tryParse(repaired);
		if (reparsed !== undefined) return reparsed;
	} catch {
		// ignore
	}

	return text;
}
