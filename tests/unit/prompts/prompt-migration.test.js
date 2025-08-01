import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsDir = path.join(__dirname, '../../../src/prompts');

describe('Prompt Migration Validation', () => {
	const bannedPhrases = [
		'Respond ONLY with',
		'Return only the',
		'valid JSON',
		'Do not include any explanatory text',
		'Do not include any explanation',
		'code block markers'
	];

	// Special cases where phrases are okay in different contexts
	const allowedContexts = {
		'markdown formatting': ['Use markdown formatting for better readability']
	};

	test('prompts should not contain JSON formatting instructions', () => {
		const promptFiles = fs
			.readdirSync(promptsDir)
			.filter((file) => file.endsWith('.json') && !file.includes('schema'))
			// Exclude update-subtask.json as it returns plain strings, not JSON
			.filter((file) => file !== 'update-subtask.json');

		promptFiles.forEach((file) => {
			const content = fs.readFileSync(path.join(promptsDir, file), 'utf8');
			const promptData = JSON.parse(content);

			bannedPhrases.forEach((phrase) => {
				const lowerContent = content.toLowerCase();
				const lowerPhrase = phrase.toLowerCase();

				if (lowerContent.includes(lowerPhrase)) {
					// Check if this phrase is allowed in its context
					const allowedInContext = allowedContexts[lowerPhrase];
					if (allowedInContext) {
						const isAllowed = allowedInContext.some((context) =>
							lowerContent.includes(context.toLowerCase())
						);
						if (isAllowed) {
							return; // Skip this phrase - it's allowed in this context
						}
					}

					// If we get here, the phrase is not allowed
					expect(lowerContent).not.toContain(lowerPhrase);
				}
			});
		});
	});
});
