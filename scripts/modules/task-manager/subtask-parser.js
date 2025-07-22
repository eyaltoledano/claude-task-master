import { z } from 'zod';

// Zod Schemas for subtask validation
export const subtaskSchema = z
	.object({
		id: z
			.number()
			.int()
			.positive()
			.describe('Sequential subtask ID starting from 1'),
		title: z.string().min(5).describe('Clear, specific title for the subtask'),
		description: z
			.string()
			.min(10)
			.describe('Detailed description of the subtask'),
		dependencies: z
			.array(z.string())
			.describe(
				'Array of subtask dependencies within the same parent task. Use format ["parentTaskId.1", "parentTaskId.2"]. Subtasks can only depend on siblings, not external tasks.'
			),
		details: z.string().min(20).describe('Implementation details and guidance'),
		status: z
			.string()
			.describe(
				'The current status of the subtask (should be pending initially)'
			),
		testStrategy: z
			.string()
			.nullable()
			.describe('Approach for testing this subtask')
			.default('')
	})
	.strict();

export const subtaskArraySchema = z.array(subtaskSchema);

export const subtaskWrapperSchema = z.object({
	subtasks: subtaskArraySchema.describe('The array of generated subtasks.')
});

/**
 * Parse subtasks from AI's text response. Includes basic cleanup.
 * @param {string} text - Response text from AI.
 * @param {number} startId - Starting subtask ID expected.
 * @param {number} expectedCount - Expected number of subtasks.
 * @param {number} parentTaskId - Parent task ID for context.
 * @param {Object} logger - Logging object (mcpLog or console log).
 * @returns {Array} Parsed and potentially corrected subtasks array.
 * @throws {Error} If parsing fails or JSON is invalid/malformed.
 */
export function parseSubtasksFromText(
	text,
	startId,
	expectedCount,
	parentTaskId,
	logger
) {
	if (typeof text !== 'string') {
		logger.error(
			`AI response text is not a string. Received type: ${typeof text}, Value: ${text}`
		);
		throw new Error('AI response text is not a string.');
	}

	if (!text || text.trim() === '') {
		throw new Error('AI response text is empty after trimming.');
	}

	const originalTrimmedResponse = text.trim(); // Store the original trimmed response
	let jsonToParse = originalTrimmedResponse; // Initialize jsonToParse with it

	logger.debug(
		`Original AI Response for parsing (full length: ${jsonToParse.length}): ${jsonToParse.substring(0, 1000)}...`
	);

	// --- Pre-emptive cleanup for known AI JSON issues ---
	// Fix for "dependencies": , or "dependencies":,
	if (jsonToParse.includes('"dependencies":')) {
		const malformedPattern = /"dependencies":\s*,/g;
		if (malformedPattern.test(jsonToParse)) {
			logger.warn('Attempting to fix malformed "dependencies": , issue.');
			jsonToParse = jsonToParse.replace(
				malformedPattern,
				'"dependencies": [],'
			);
			logger.debug(
				`JSON after fixing "dependencies": ${jsonToParse.substring(0, 500)}...`
			);
		}
	}
	// --- End pre-emptive cleanup ---

	let parsedObject;
	let primaryParseAttemptFailed = false;

	// --- Attempt 1: Simple Parse (with optional Markdown cleanup) ---
	logger.debug('Attempting simple parse...');
	try {
		// Check for markdown code block
		const codeBlockMatch = jsonToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		let contentToParseDirectly = jsonToParse;
		if (codeBlockMatch && codeBlockMatch[1]) {
			contentToParseDirectly = codeBlockMatch[1].trim();
			logger.debug('Simple parse: Extracted content from markdown code block.');
		} else {
			logger.debug(
				'Simple parse: No markdown code block found, using trimmed original.'
			);
		}

		parsedObject = JSON.parse(contentToParseDirectly);
		logger.debug('Simple parse successful!');

		// Quick check if it looks like our target object
		if (
			!parsedObject ||
			typeof parsedObject !== 'object' ||
			!Array.isArray(parsedObject.subtasks)
		) {
			logger.warn(
				'Simple parse succeeded, but result is not the expected {"subtasks": []} structure. Will proceed to advanced extraction.'
			);
			primaryParseAttemptFailed = true;
			parsedObject = null; // Reset parsedObject so we enter the advanced logic
		}
		// If it IS the correct structure, we'll skip advanced extraction.
	} catch (e) {
		logger.warn(
			`Simple parse failed: ${e.message}. Proceeding to advanced extraction logic.`
		);
		primaryParseAttemptFailed = true;
		// jsonToParse is already originalTrimmedResponse if simple parse failed before modifying it for markdown
	}

	// --- Attempt 2: Advanced Extraction (if simple parse failed or produced wrong structure) ---
	if (primaryParseAttemptFailed || !parsedObject) {
		// Ensure we try advanced if simple parse gave wrong structure
		logger.debug('Attempting advanced extraction logic...');
		// Reset jsonToParse to the original full trimmed response for advanced logic
		jsonToParse = originalTrimmedResponse;

		// Look for the target pattern and extract the JSON object
		const targetPattern = '{"subtasks":';
		const patternStartIndex = jsonToParse.indexOf(targetPattern);

		if (patternStartIndex !== -1) {
			logger.debug(`Found target pattern at index ${patternStartIndex}`);

			// Start from the pattern and count braces to find the complete object
			let openBraces = 0;
			let firstBraceFound = false;
			let extractedJsonBlock = '';

			for (let i = patternStartIndex; i < jsonToParse.length; i++) {
				const char = jsonToParse[i];
				extractedJsonBlock += char;

				if (char === '{') {
					openBraces++;
					firstBraceFound = true;
				} else if (char === '}') {
					openBraces--;

					// If we've found the closing brace that matches our opening brace
					if (firstBraceFound && openBraces === 0) {
						logger.debug(
							`Complete JSON object extracted, length: ${extractedJsonBlock.length}`
						);
						jsonToParse = extractedJsonBlock;
						break;
					}
				}
			}

			// If brace counting didn't work, fall back to pattern-based extraction
			if (openBraces !== 0) {
				logger.warn('Brace counting failed, attempting fallback extraction');
				// Fallback to last '}' approach
				const lastBraceIndex = jsonToParse.lastIndexOf('}');
				if (lastBraceIndex > patternStartIndex) {
					jsonToParse = jsonToParse.substring(
						patternStartIndex,
						lastBraceIndex + 1
					);
					logger.debug(
						`Fallback extraction: ${jsonToParse.substring(0, 200)}...`
					);
				}
			}
		} else {
			// Pattern not found, try to extract any JSON-like structure
			logger.warn(
				'Target pattern not found, attempting generic JSON extraction'
			);
			const firstBraceIndex = jsonToParse.indexOf('{');
			const lastBraceIndex = jsonToParse.lastIndexOf('}');

			if (
				firstBraceIndex !== -1 &&
				lastBraceIndex !== -1 &&
				lastBraceIndex > firstBraceIndex
			) {
				jsonToParse = jsonToParse.substring(
					firstBraceIndex,
					lastBraceIndex + 1
				);
				logger.debug(`Generic extraction: ${jsonToParse.substring(0, 200)}...`);
			}
		}

		logger.debug(
			`Advanced extraction: JSON string that will be parsed: ${jsonToParse.substring(0, 500)}...`
		);
		try {
			parsedObject = JSON.parse(jsonToParse);
			logger.debug('Advanced extraction parse successful!');
		} catch (parseError) {
			logger.error(
				`Advanced extraction: Failed to parse JSON object: ${parseError.message}`
			);
			logger.error(
				`Advanced extraction: Problematic JSON string for parse (first 500 chars): ${jsonToParse.substring(0, 500)}`
			);
			throw new Error(
				`Failed to parse JSON response object after both simple and advanced attempts: ${parseError.message}`
			);
		}
	}

	// --- Validation (applies to successfully parsedObject from either attempt) ---
	if (
		!parsedObject ||
		typeof parsedObject !== 'object' ||
		!Array.isArray(parsedObject.subtasks)
	) {
		logger.error(
			`Final parsed content is not an object or missing 'subtasks' array. Content: ${JSON.stringify(parsedObject).substring(0, 200)}`
		);
		throw new Error(
			'Parsed AI response is not a valid object containing a "subtasks" array after all attempts.'
		);
	}
	const parsedSubtasks = parsedObject.subtasks;

	if (expectedCount && parsedSubtasks.length !== expectedCount) {
		logger.warn(
			`Expected ${expectedCount} subtasks, but parsed ${parsedSubtasks.length}.`
		);
	}

	let currentId = startId;
	const validatedSubtasks = [];
	const validationErrors = [];

	for (const rawSubtask of parsedSubtasks) {
		const correctedSubtask = {
			...rawSubtask,
			id: currentId,
			dependencies: Array.isArray(rawSubtask.dependencies)
				? rawSubtask.dependencies.filter(
						(dep) =>
							typeof dep === 'string' && dep.startsWith(`${parentTaskId}.`)
					)
				: [],
			status: 'pending'
		};

		const result = subtaskSchema.safeParse(correctedSubtask);

		if (result.success) {
			validatedSubtasks.push(result.data);
		} else {
			logger.warn(
				`Subtask validation failed for raw data: ${JSON.stringify(rawSubtask).substring(0, 100)}...`
			);
			result.error.errors.forEach((err) => {
				const errorMessage = `  - Field '${err.path.join('.')}': ${err.message}`;
				logger.warn(errorMessage);
				validationErrors.push(`Subtask ${currentId}: ${errorMessage}`);
			});
		}
		currentId++;
	}

	if (validationErrors.length > 0) {
		logger.error(
			`Found ${validationErrors.length} validation errors in the generated subtasks.`
		);
		logger.warn('Proceeding with only the successfully validated subtasks.');
	}

	if (validatedSubtasks.length === 0 && parsedSubtasks.length > 0) {
		throw new Error(
			'AI response contained potential subtasks, but none passed validation.'
		);
	}
	return validatedSubtasks.slice(0, expectedCount || validatedSubtasks.length);
}
