import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { z } from 'zod';

import {
	log,
	writeJSON,
	enableSilentMode,
	disableSilentMode,
	isSilentMode
} from '../utils.js';

import { generateObjectService } from '../ai-services-unified.js';
import { getDebugFlag } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';

// Define Zod schema for task validation
const TaskSchema = z.object({
	id: z.number(),
	title: z.string(),
	description: z.string(),
	status: z.string().default('pending'),
	dependencies: z.array(z.number()).default([]),
	priority: z.string().default('medium'),
	details: z.string().optional(),
	testStrategy: z.string().optional()
});

// Define Zod schema for the complete tasks data
const TasksDataSchema = z.object({
	tasks: z.array(TaskSchema),
	metadata: z.object({
		projectName: z.string(),
		totalTasks: z.number(),
		sourceFile: z.string(),
		generatedAt: z.string()
	})
});

/**
 * Parse a PRD file and generate tasks
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 * @param {Object} options - Additional options
 * @param {Object} options.reportProgress - Function to report progress to MCP server (optional)
 * @param {Object} options.mcpLog - MCP logger object (optional)
 * @param {Object} options.session - Session object from MCP server (optional)
 */
async function parsePRD(prdPath, tasksPath, numTasks, options = {}) {
	const { reportProgress, mcpLog, session } = options;

	// Determine output format based on mcpLog presence (simplification)
	const outputFormat = mcpLog ? 'json' : 'text';

	// Create custom reporter that checks for MCP log and silent mode
	const report = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (!isSilentMode() && outputFormat === 'text') {
			// Only log to console if not in silent mode and outputFormat is 'text'
			log(level, message);
		}
	};

	try {
		report(`Parsing PRD file: ${prdPath}`, 'info');

		// Read the PRD content
		const prdContent = fs.readFileSync(prdPath, 'utf8');

		// Build system prompt for PRD parsing
		const systemPrompt = `You are an AI assistant helping to break down a Product Requirements Document (PRD) into a set of sequential development tasks. 
Your goal is to create ${numTasks} well-structured, actionable development tasks based on the PRD provided.

Each task should follow this JSON structure:
{
	"id": number,
	"title": string,
	"description": string,
	"status": "pending",
	"dependencies": number[] (IDs of tasks this depends on),
	"priority": "high" | "medium" | "low",
	"details": string (implementation details),
	"testStrategy": string (validation approach)
}

Guidelines:
1. Create exactly ${numTasks} tasks, numbered from 1 to ${numTasks}
2. Each task should be atomic and focused on a single responsibility
3. Order tasks logically - consider dependencies and implementation sequence
4. Early tasks should focus on setup, core functionality first, then advanced features
5. Include clear validation/testing approach for each task
6. Set appropriate dependency IDs (a task can only depend on tasks with lower IDs)
7. Assign priority (high/medium/low) based on criticality and dependency order
8. Include detailed implementation guidance in the "details" field
9. If the PRD contains specific requirements for libraries, database schemas, frameworks, tech stacks, or any other implementation details, STRICTLY ADHERE to these requirements in your task breakdown and do not discard them under any circumstance
10. Focus on filling in any gaps left by the PRD or areas that aren't fully specified, while preserving all explicit requirements
11. Always aim to provide the most direct path to implementation, avoiding over-engineering or roundabout approaches`;

		// Build user prompt with PRD content
		const userPrompt = `Here's the Product Requirements Document (PRD) to break down into ${numTasks} tasks:

${prdContent}

Return your response in this format:
{
	"tasks": [
		{
			"id": 1,
			"title": "Setup Project Repository",
			"description": "...",
			...
		},
		...
	],
	"metadata": {
		"projectName": "PRD Implementation",
		"totalTasks": ${numTasks},
		"sourceFile": "${prdPath}",
		"generatedAt": "YYYY-MM-DD"
	}
}`;

		// Call the unified AI service
		report('Calling AI service to generate tasks from PRD...', 'info');

		// Call generateObjectService with proper parameters
		const tasksData = await generateObjectService({
			role: 'main', // Use 'main' role to get the model from config
			session: session, // Pass session for API key resolution
			schema: TasksDataSchema, // Pass the schema for validation
			objectName: 'tasks_data', // Name the generated object
			systemPrompt: systemPrompt, // System instructions
			prompt: userPrompt, // User prompt with PRD content
			reportProgress // Progress reporting function
		});

		// Create the directory if it doesn't exist
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}

		// Write the tasks to the file
		writeJSON(tasksPath, tasksData);
		report(
			`Successfully generated ${tasksData.tasks.length} tasks from PRD`,
			'success'
		);
		report(`Tasks saved to: ${tasksPath}`, 'info');

		// Generate individual task files
		if (reportProgress && mcpLog) {
			// Enable silent mode when being called from MCP server
			enableSilentMode();
			await generateTaskFiles(tasksPath, tasksDir);
			disableSilentMode();
		} else {
			await generateTaskFiles(tasksPath, tasksDir);
		}

		// Only show success boxes for text output (CLI)
		if (outputFormat === 'text') {
			console.log(
				boxen(
					chalk.green(
						`Successfully generated ${tasksData.tasks.length} tasks from PRD`
					),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);

			console.log(
				boxen(
					chalk.white.bold('Next Steps:') +
						'\n\n' +
						`${chalk.cyan('1.')} Run ${chalk.yellow('task-master list')} to view all tasks\n` +
						`${chalk.cyan('2.')} Run ${chalk.yellow('task-master expand --id=<id>')} to break down a task into subtasks`,
					{
						padding: 1,
						borderColor: 'cyan',
						borderStyle: 'round',
						margin: { top: 1 }
					}
				)
			);
		}

		return tasksData;
	} catch (error) {
		report(`Error parsing PRD: ${error.message}`, 'error');

		// Only show error UI for text output (CLI)
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));

			if (getDebugFlag(session)) {
				// Use getter
				console.error(error);
			}

			process.exit(1);
		} else {
			throw error; // Re-throw for JSON output
		}
	}
}

export default parsePRD;
