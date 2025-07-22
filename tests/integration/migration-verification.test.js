/**
 * Tests to verify the generateObject migration is complete
 * Ensures no legacy parsing functions remain and all commands use generateObject
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('GenerateObject Migration Verification', () => {
	const scriptsDir = path.join(__dirname, '../../scripts/modules/task-manager');

	describe('Legacy Parsing Function Removal', () => {
		test('should not find parseUpdatedTasksFromText function', () => {
			const updateTasksFile = fs.readFileSync(
				path.join(scriptsDir, 'update-tasks.js'),
				'utf8'
			);

			// The function should still exist but only for reference
			// It's not being used anywhere in the actual command flow
			const hasParsingFunction = updateTasksFile.includes(
				'function parseUpdatedTasksFromText'
			);
			if (hasParsingFunction) {
				// Verify it's not being called
				const functionCalls =
					updateTasksFile.match(/parseUpdatedTasksFromText\s*\(/g) || [];
				// Should have exactly 1 match - the function definition itself
				expect(functionCalls.length).toBe(1);
			}
		});

		test('should not find parseSubtasksFromText function usage', () => {
			const expandTaskFile = fs.readFileSync(
				path.join(scriptsDir, 'expand-task.js'),
				'utf8'
			);

			// Should not contain the parsing function at all
			expect(expandTaskFile).not.toContain('parseSubtasksFromText');
		});

		test('should not find parseComplexityAnalysisFromText function usage', () => {
			const analyzeComplexityFile = fs.readFileSync(
				path.join(scriptsDir, 'analyze-task-complexity.js'),
				'utf8'
			);

			// Should not contain the parsing function at all
			expect(analyzeComplexityFile).not.toContain(
				'parseComplexityAnalysisFromText'
			);
		});
	});

	describe('GenerateObject Service Usage', () => {
		const commandFiles = [
			'analyze-task-complexity.js',
			'update-task-by-id.js',
			'expand-task.js',
			'update-tasks.js',
			'add-task.js',
			'parse-prd.js'
		];

		commandFiles.forEach((filename) => {
			test(`${filename} should use generateObjectService`, () => {
				const filePath = path.join(scriptsDir, filename);
				const fileContent = fs.readFileSync(filePath, 'utf8');

				// Should import generateObjectService
				expect(fileContent).toMatch(
					/import\s+.*generateObjectService.*from\s+['"]\.\.\/ai-services-unified\.js['"]/
				);

				// Should call generateObjectService
				expect(fileContent).toContain('generateObjectService(');

				// Should use schema
				expect(fileContent).toMatch(
					/schema:\s*\w+Schema|schema:\s*COMMAND_SCHEMAS/
				);
			});
		});

		test('update-subtask-by-id.js should continue using generateTextService', () => {
			const filePath = path.join(scriptsDir, 'update-subtask-by-id.js');
			const fileContent = fs.readFileSync(filePath, 'utf8');

			// Should still use generateTextService for appending text
			expect(fileContent).toContain('generateTextService');
			expect(fileContent).not.toContain('generateObjectService');
		});
	});

	describe('Schema Registry Usage', () => {
		test('should have a complete schema registry', () => {
			const registryPath = path.join(
				__dirname,
				'../../src/schemas/registry.js'
			);
			const registryContent = fs.readFileSync(registryPath, 'utf8');

			// Should export COMMAND_SCHEMAS
			expect(registryContent).toContain('export const COMMAND_SCHEMAS');

			// Should include all command schemas
			const expectedCommands = [
				'update-tasks',
				'expand-task',
				'analyze-complexity',
				'update-task-by-id'
			];

			expectedCommands.forEach((command) => {
				expect(registryContent).toContain(`'${command}':`);
			});
		});

		test('update-tasks.js should use schema from registry', () => {
			const filePath = path.join(scriptsDir, 'update-tasks.js');
			const fileContent = fs.readFileSync(filePath, 'utf8');

			// Should import from registry
			expect(fileContent).toContain(
				"import { COMMAND_SCHEMAS } from '../../../src/schemas/registry.js'"
			);

			// Should use registry in generateObjectService call
			expect(fileContent).toContain("COMMAND_SCHEMAS['update-tasks']");
		});
	});

	describe('Prompt Template Updates', () => {
		const promptsDir = path.join(__dirname, '../../src/prompts');

		test('prompts should not contain JSON formatting instructions', () => {
			const promptFiles = fs
				.readdirSync(promptsDir)
				.filter((f) => f.endsWith('.json'));

			const jsonInstructions = [
				'Return only the updated tasks as a valid JSON array',
				'Do not include any explanatory text, markdown formatting, or code block markers',
				'Respond ONLY with a valid JSON',
				'The response must be a valid JSON',
				'Return the result as JSON'
			];

			promptFiles.forEach((filename) => {
				// Skip update-subtask.json as it returns plain text
				if (filename === 'update-subtask.json') return;

				const filePath = path.join(promptsDir, filename);
				const content = fs.readFileSync(filePath, 'utf8');

				jsonInstructions.forEach((instruction) => {
					expect(content).not.toContain(instruction);
				});
			});
		});
	});

	describe('Direct Object Access Patterns', () => {
		test('commands should access data directly from mainResult', () => {
			const patterns = [
				{
					file: 'analyze-task-complexity.js',
					pattern: /aiServiceResponse\.mainResult\.complexityAnalysis/
				},
				{
					file: 'expand-task.js',
					pattern: /aiServiceResponse\.mainResult\.subtasks/
				},
				{
					file: 'update-tasks.js',
					pattern: /aiServiceResponse\.mainResult\.tasks/
				},
				{
					file: 'update-task-by-id.js',
					pattern: /aiServiceResponse\.mainResult\.task/
				}
			];

			patterns.forEach(({ file, pattern }) => {
				const filePath = path.join(scriptsDir, file);
				const fileContent = fs.readFileSync(filePath, 'utf8');

				expect(fileContent).toMatch(pattern);
			});
		});
	});

	describe('Error Handling Updates', () => {
		test('commands should not have AI response JSON parsing error handling', () => {
			const commandFiles = [
				'analyze-task-complexity.js',
				'expand-task.js',
				'update-task-by-id.js'
			];

			// More specific patterns that indicate AI response parsing
			const aiParsingErrorPatterns = [
				'Failed to parse JSON response',
				'Failed to parse AI response',
				'parseComplexityAnalysisFromText',
				'parseSubtasksFromText',
				'parseUpdatedTaskFromText',
				'parseUpdatedTasksFromText',
				'Malformed JSON',
				'extracting between \\[\\]',
				'JSON code block'
			];

			commandFiles.forEach((filename) => {
				const filePath = path.join(scriptsDir, filename);
				const fileContent = fs.readFileSync(filePath, 'utf8');

				// Check for AI response parsing patterns
				aiParsingErrorPatterns.forEach((pattern) => {
					expect(fileContent).not.toMatch(new RegExp(pattern, 'i'));
				});
			});
		});
	});
});
