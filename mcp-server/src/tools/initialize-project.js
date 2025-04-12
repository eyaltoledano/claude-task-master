import { z } from 'zod';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createContentResponse, createErrorResponse } from './utils.js'; // Only need response creators

export function registerInitializeProjectTool(server) {
	server.addTool({
		name: 'initialize_project', // snake_case for tool name
		description:
			"Initializes a new Task Master project structure in the current working directory by running 'task-master init'.",
		parameters: z.object({
			projectName: z
				.string()
				.optional()
				.describe('The name for the new project.'),
			projectDescription: z
				.string()
				.optional()
				.describe('A brief description for the project.'),
			projectVersion: z
				.string()
				.optional()
				.describe("The initial version for the project (e.g., '0.1.0')."),
			authorName: z.string().optional().describe("The author's name."),
			skipInstall: z
				.boolean()
				.optional()
				.default(false)
				.describe('Skip installing dependencies automatically.'),
			addAliases: z
				.boolean()
				.optional()
				.default(false)
				.describe('Add shell aliases (tm, taskmaster) to shell config file.'),
			yes: z
				.boolean()
				.optional()
				.default(false)
				.describe('Skip prompts and use default values or provided arguments.'),
			projectRoot: z
				.string()
				.describe('The root directory for the project. Must be absolute path.'),
			confirmOverwrite: z
				.boolean()
				.optional()
				.default(false)
				.describe('Confirm overwriting existing tasks if they exist.')
		}),
		execute: async (args, { log }) => {
			// Destructure context to get log
			try {
				log.info(
					`Executing initialize_project with args: ${JSON.stringify(args)}`
				);
				
				// Check if tasks.json already exists
				const tasksPath = path.join(args.projectRoot, 'tasks', 'tasks.json');
				if (fs.existsSync(tasksPath) && !args.confirmOverwrite) {
					const errorMessage = 'Existing tasks.json found. To initialize project and potentially overwrite existing task state, set confirmOverwrite parameter to true.';
					log.warn(errorMessage);
					return createErrorResponse(errorMessage, { code: 'EXISTING_TASKS' });
				}

				// Construct the command arguments carefully
				// Using npx ensures it uses the locally installed version if available, or fetches it
				let command = 'npx task-master init';
				const cliArgs = [];
				if (args.projectName)
					cliArgs.push(`--name "${args.projectName.replace(/"/g, '\\"')}"`); // Escape quotes
				if (args.projectDescription)
					cliArgs.push(
						`--description "${args.projectDescription.replace(/"/g, '\\"')}"`
					);
				if (args.projectVersion)
					cliArgs.push(
						`--version "${args.projectVersion.replace(/"/g, '\\"')}"`
					);
				if (args.authorName)
					cliArgs.push(`--author "${args.authorName.replace(/"/g, '\\"')}"`);
				if (args.skipInstall) cliArgs.push('--skip-install');
				if (args.addAliases) cliArgs.push('--aliases');
				if (args.yes) cliArgs.push('--yes');

				command += ' ' + cliArgs.join(' ');

				log.info(`Constructed command: ${command}`);
				
				// Navigate to the project root directory if provided
				const options = {
					encoding: 'utf8',
					stdio: 'pipe',
					timeout: 300000
				};
				
				if (args.projectRoot) {
					options.cwd = args.projectRoot;
				}

				// Execute the command in the specified directory
				const output = execSync(command, options);

				log.info(`Initialization output:\n${output}`);

				// Return a standard success response manually
				return createContentResponse(
					'Project initialized successfully.',
					{ output: output } // Include output in the data payload
				);
			} catch (error) {
				// Catch errors from execSync or timeouts
				const errorMessage = `Project initialization failed: ${error.message}`;
				const errorDetails =
					error.stderr?.toString() || error.stdout?.toString() || error.message; // Provide stderr/stdout if available
				log.error(`${errorMessage}\nDetails: ${errorDetails}`);

				// Return a standard error response manually
				return createErrorResponse(errorMessage, { details: errorDetails });
			}
		}
	});
}
