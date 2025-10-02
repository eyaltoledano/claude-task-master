/**
 * @fileoverview Schema conversion utilities for MCP AI SDK provider
 */

/**
 * Convert Zod schema to human-readable JSON instructions
 * @param {import('zod').ZodSchema} schema - Zod schema object
 * @param {string} [objectName='result'] - Name of the object being generated
 * @returns {string} Instructions for JSON generation
 */
export function convertSchemaToInstructions(schema, objectName = 'result') {
	try {
		// Generate example structure from schema
		const exampleStructure = generateExampleFromSchema(schema);

		return `
CRITICAL JSON GENERATION INSTRUCTIONS:

You must respond with ONLY valid JSON that matches this exact structure for "${objectName}":

${JSON.stringify(exampleStructure, null, 2)}

STRICT REQUIREMENTS:
1. Response must start with { and end with }
2. Use double quotes for all strings and property names
3. Do not include any text before or after the JSON
4. Do not wrap in markdown code blocks
5. Do not include explanations or comments
6. Follow the exact property names and types shown above
7. All required fields must be present

Begin your response immediately with the opening brace {`;
	} catch (error) {
		// Fallback to basic JSON instructions if schema parsing fails
		return `
CRITICAL JSON GENERATION INSTRUCTIONS:

You must respond with ONLY valid JSON for "${objectName}".

STRICT REQUIREMENTS:
1. Response must start with { and end with }
2. Use double quotes for all strings and property names  
3. Do not include any text before or after the JSON
4. Do not wrap in markdown code blocks
5. Do not include explanations or comments

Begin your response immediately with the opening brace {`;
	}
}

/**
 * Generate example structure from Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema
 * @returns {any} Example object matching the schema
 */
function generateExampleFromSchema(schema) {
	// This is a simplified schema-to-example converter
	// For production, you might want to use a more sophisticated library

	if (!schema || typeof schema._def === 'undefined') {
		return {};
	}

	const def = schema._def;

	switch (def.typeName) {
		case 'ZodObject':
			const result = {};
			const shape = def.shape();

			for (const [key, fieldSchema] of Object.entries(shape)) {
				result[key] = generateExampleFromSchema(fieldSchema);
			}

			return result;

		case 'ZodString':
			// Check for min/max length constraints
			if (def.checks) {
				const minCheck = def.checks.find((c) => c.kind === 'min');
				const maxCheck = def.checks.find((c) => c.kind === 'max');
				if (minCheck && maxCheck) {
					return (
						'<string between ' +
						minCheck.value +
						'-' +
						maxCheck.value +
						' characters>'
					);
				} else if (minCheck) {
					return '<string with at least ' + minCheck.value + ' characters>';
				} else if (maxCheck) {
					return '<string up to ' + maxCheck.value + ' characters>';
				}
			}
			return '<string>';

		case 'ZodNumber':
			// Check for int, positive, min/max constraints
			if (def.checks) {
				const intCheck = def.checks.find((c) => c.kind === 'int');
				const minCheck = def.checks.find((c) => c.kind === 'min');
				const maxCheck = def.checks.find((c) => c.kind === 'max');

				if (intCheck && minCheck && minCheck.value > 0) {
					return '<positive integer>';
				} else if (intCheck) {
					return '<integer>';
				} else if (minCheck || maxCheck) {
					return (
						'<number' +
						(minCheck ? ' >= ' + minCheck.value : '') +
						(maxCheck ? ' <= ' + maxCheck.value : '') +
						'>'
					);
				}
			}
			return '<number>';

		case 'ZodBoolean':
			return '<boolean>';

		case 'ZodArray':
			const elementExample = generateExampleFromSchema(def.type);
			return [elementExample];

		case 'ZodOptional':
			return generateExampleFromSchema(def.innerType);

		case 'ZodNullable':
			return generateExampleFromSchema(def.innerType);

		case 'ZodEnum':
			return def.values[0] || 'enum_value';

		case 'ZodLiteral':
			return def.value;

		case 'ZodUnion':
			// Use the first option from the union
			if (def.options && def.options.length > 0) {
				return generateExampleFromSchema(def.options[0]);
			}
			return 'union_value';

		case 'ZodRecord':
			return {
				key: generateExampleFromSchema(def.valueType)
			};

		default:
			// For unknown types, return a placeholder
			return `<${def.typeName || 'unknown'}>`;
	}
}

/**
 * Enhance prompt with JSON generation instructions
 * @param {Array} prompt - AI SDK prompt array
 * @param {string} jsonInstructions - JSON generation instructions
 * @returns {Array} Enhanced prompt array
 */
export function enhancePromptForJSON(prompt, jsonInstructions) {
	const enhancedPrompt = [...prompt];

	// Find system message or create one
	let systemMessageIndex = enhancedPrompt.findIndex(
		(msg) => msg.role === 'system'
	);

	if (systemMessageIndex >= 0) {
		// Append to existing system message
		const currentContent = enhancedPrompt[systemMessageIndex].content;
		enhancedPrompt[systemMessageIndex] = {
			...enhancedPrompt[systemMessageIndex],
			content: currentContent + '\n\n' + jsonInstructions
		};
	} else {
		// Add new system message at the beginning
		enhancedPrompt.unshift({
			role: 'system',
			content: jsonInstructions
		});
	}

	return enhancedPrompt;
}
