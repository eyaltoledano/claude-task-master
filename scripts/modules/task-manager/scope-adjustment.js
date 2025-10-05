/**
 * scope-adjustment.js
 * Core logic for dynamic task complexity adjustment (scope-up and scope-down)
 */

import { z } from 'zod';
import {
	log,
	readJSON,
	writeJSON,
	getCurrentTag,
	readComplexityReport,
	findTaskInComplexityReport
} from '../utils.js';
import {
	generateObjectService,
	generateTextService
} from '../ai-services-unified.js';
import { findTaskById, taskExists } from '../task-manager.js';
import analyzeTaskComplexity from './analyze-task-complexity.js';
import { findComplexityReportPath } from '../../../src/utils/path-utils.js';

/**
 * Valid strength levels for scope adjustments
 */
const VALID_STRENGTHS = ['light', 'regular', 'heavy'];

/**
 * Statuses that should be preserved during subtask regeneration
 * These represent work that has been started or intentionally set by the user
 */
const PRESERVE_STATUSES = [
	'done',
	'in-progress',
	'review',
	'cancelled',
	'deferred',
	'blocked'
];

/**
 * Statuses that should be regenerated during subtask regeneration
 * These represent work that hasn't been started yet
 */
const REGENERATE_STATUSES = ['pending'];

/**
 * Validates strength parameter
 * @param {string} strength - The strength level to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateStrength(strength) {
	return VALID_STRENGTHS.includes(strength);
}

/**
 * Re-analyzes the complexity of a single task after scope adjustment
 * @param {Object} task - The task to analyze
 * @param {string} tasksPath - Path to tasks.json
 * @param {Object} context - Context containing projectRoot, tag, session
 * @returns {Promise<number|null>} New complexity score or null if analysis failed
 */
async function reanalyzeTaskComplexity(task, tasksPath, context) {
	const { projectRoot, tag, session } = context;

	try {
		// Create a minimal tasks data structure for analysis
		const tasksForAnalysis = {
			tasks: [task],
			metadata: { analyzedAt: new Date().toISOString() }
		};

		// Find the complexity report path for this tag
		const complexityReportPath = findComplexityReportPath(
			null,
			{ projectRoot, tag },
			null
		);

		if (!complexityReportPath) {
			log('warn', 'No complexity report found - cannot re-analyze complexity');
			return null;
		}

		// Use analyze-task-complexity to re-analyze just this task
		const analysisOptions = {
			file: tasksPath,
			output: complexityReportPath,
			id: task.id.toString(), // Analyze only this specific task
			projectRoot,
			tag,
			_filteredTasksData: tasksForAnalysis, // Pass pre-filtered data
			_originalTaskCount: 1
		};

		// Run the analysis with proper context
		await analyzeTaskComplexity(analysisOptions, { session });

		// Read the updated complexity report to get the new score
		const updatedReport = readComplexityReport(complexityReportPath);
		if (updatedReport) {
			const taskAnalysis = findTaskInComplexityReport(updatedReport, task.id);
			if (taskAnalysis) {
				log(
					'info',
					`Re-analyzed task ${task.id} complexity: ${taskAnalysis.complexityScore}/10`
				);
				return taskAnalysis.complexityScore;
			}
		}

		log(
			'warn',
			`Could not find updated complexity analysis for task ${task.id}`
		);
		return null;
	} catch (error) {
		log('error', `Failed to re-analyze task complexity: ${error.message}`);
		return null;
	}
}

/**
 * Gets the current complexity score for a task from the complexity report
 * @param {number} taskId - Task ID to look up
 * @param {Object} context - Context containing projectRoot, tag
 * @returns {number|null} Current complexity score or null if not found
 */
function getCurrentComplexityScore(taskId, context) {
	const { projectRoot, tag } = context;

	try {
		// Find the complexity report path for this tag
		const complexityReportPath = findComplexityReportPath(
			null,
			{ projectRoot, tag },
			null
		);

		if (!complexityReportPath) {
			return null;
		}

		// Read the current complexity report
		const complexityReport = readComplexityReport(complexityReportPath);
		if (!complexityReport) {
			return null;
		}

		// Find this task's current complexity
		const taskAnalysis = findTaskInComplexityReport(complexityReport, taskId);
		return taskAnalysis ? taskAnalysis.complexityScore : null;
	} catch (error) {
		log('debug', `Could not read current complexity score: ${error.message}`);
		return null;
	}
}

/**
 * Regenerates subtasks for a task based on new complexity while preserving completed work
 * @param {Object} task - The updated task object
 * @param {string} tasksPath - Path to tasks.json
 * @param {Object} context - Context containing projectRoot, tag, session
 * @param {string} direction - Direction of scope change (up/down) for logging
 * @param {string} strength - Strength level ('light', 'regular', 'heavy')
 * @param {number|null} originalComplexity - Original complexity score for smarter adjustments
 * @returns {Promise<Object>} Object with updated task and regeneration info
 */
async function regenerateSubtasksForComplexity(
	task,
	tasksPath,
	context,
	direction,
	strength = 'regular',
	originalComplexity = null
) {
	const { projectRoot, tag, session } = context;

	// Check if task has subtasks
	if (
		!task.subtasks ||
		!Array.isArray(task.subtasks) ||
		task.subtasks.length === 0
	) {
		return {
			updatedTask: task,
			regenerated: false,
			preserved: 0,
			generated: 0
		};
	}

	// Identify subtasks to preserve vs regenerate
	const preservedSubtasks = task.subtasks.filter((subtask) =>
		PRESERVE_STATUSES.includes(subtask.status)
	);
	const pendingSubtasks = task.subtasks.filter((subtask) =>
		REGENERATE_STATUSES.includes(subtask.status)
	);

	// If no pending subtasks, nothing to regenerate
	if (pendingSubtasks.length === 0) {
		return {
			updatedTask: task,
			regenerated: false,
			preserved: preservedSubtasks.length,
			generated: 0
		};
	}

	// Calculate appropriate number of total subtasks based on direction, complexity, strength, and original complexity
	let targetSubtaskCount;
	const preservedCount = preservedSubtasks.length;
	const currentPendingCount = pendingSubtasks.length;

	// Use original complexity to inform decisions (if available)
	const complexityFactor = originalComplexity
		? Math.max(0.5, originalComplexity / 10)
		: 1.0;
	const complexityInfo = originalComplexity
		? ` (original complexity: ${originalComplexity}/10)`
		: '';

	if (direction === 'up') {
		// Scope up: More subtasks for increased complexity
		if (strength === 'light') {
			const base = Math.max(
				5,
				preservedCount + Math.ceil(currentPendingCount * 1.1)
			);
			targetSubtaskCount = Math.ceil(base * (0.8 + 0.4 * complexityFactor));
		} else if (strength === 'regular') {
			const base = Math.max(
				6,
				preservedCount + Math.ceil(currentPendingCount * 1.3)
			);
			targetSubtaskCount = Math.ceil(base * (0.8 + 0.4 * complexityFactor));
		} else {
			// heavy
			const base = Math.max(
				8,
				preservedCount + Math.ceil(currentPendingCount * 1.6)
			);
			targetSubtaskCount = Math.ceil(base * (0.8 + 0.6 * complexityFactor));
		}
	} else {
		// Scope down: Fewer subtasks for decreased complexity
		// High complexity tasks get reduced more aggressively
		const aggressiveFactor =
			originalComplexity >= 8 ? 0.7 : originalComplexity >= 6 ? 0.85 : 1.0;

		if (strength === 'light') {
			const base = Math.max(
				3,
				preservedCount + Math.ceil(currentPendingCount * 0.8)
			);
			targetSubtaskCount = Math.ceil(base * aggressiveFactor);
		} else if (strength === 'regular') {
			const base = Math.max(
				3,
				preservedCount + Math.ceil(currentPendingCount * 0.5)
			);
			targetSubtaskCount = Math.ceil(base * aggressiveFactor);
		} else {
			// heavy
			// Heavy scope-down should be much more aggressive - aim for only core functionality
			// Very high complexity tasks (9-10) get reduced to almost nothing
			const ultraAggressiveFactor =
				originalComplexity >= 9 ? 0.3 : originalComplexity >= 7 ? 0.5 : 0.7;
			const base = Math.max(
				2,
				preservedCount + Math.ceil(currentPendingCount * 0.25)
			);
			targetSubtaskCount = Math.max(1, Math.ceil(base * ultraAggressiveFactor));
		}
	}

	log(
		'debug',
		`Complexity-aware subtask calculation${complexityInfo}: ${currentPendingCount} pending -> target ${targetSubtaskCount} total`
	);
	log(
		'debug',
		`Complexity-aware calculation${complexityInfo}: ${currentPendingCount} pending -> ${targetSubtaskCount} total subtasks (${strength} ${direction})`
	);

	const newSubtasksNeeded = Math.max(1, targetSubtaskCount - preservedCount);

	try {
		// Generate new subtasks using AI to match the new complexity level
		const systemPrompt = `You are an expert project manager who creates task breakdowns that match complexity levels.`;

		const prompt = `Based on this updated task, generate ${newSubtasksNeeded} NEW subtasks that reflect the ${direction === 'up' ? 'increased' : 'decreased'} complexity level:

**Task Title**: ${task.title}
**Task Description**: ${task.description}
**Implementation Details**: ${task.details}
**Test Strategy**: ${task.testStrategy}

**Complexity Direction**: This task was recently scoped ${direction} (${strength} strength) to ${direction === 'up' ? 'increase' : 'decrease'} complexity.
${originalComplexity ? `**Original Complexity**: ${originalComplexity}/10 - consider this when determining appropriate scope level.` : ''}

${preservedCount > 0 ? `**Preserved Subtasks**: ${preservedCount} existing subtasks with work already done will be kept.` : ''}

Generate subtasks that:
${
	direction === 'up'
		? strength === 'heavy'
			? `- Add comprehensive implementation steps with advanced features
- Include extensive error handling, validation, and edge cases
- Cover multiple integration scenarios and advanced testing
- Provide thorough documentation and optimization approaches`
			: strength === 'regular'
				? `- Add more detailed implementation steps
- Include additional error handling and validation
- Cover more edge cases and advanced features
- Provide more comprehensive testing approaches`
				: `- Add some additional implementation details
- Include basic error handling considerations
- Cover a few common edge cases
- Enhance testing approaches slightly`
		: strength === 'heavy'
			? `- Focus ONLY on absolutely essential core functionality
- Strip out ALL non-critical features (error handling, advanced testing, etc.)
- Provide only the minimum viable implementation
- Eliminate any complex integrations or advanced scenarios
- Aim for the simplest possible working solution`
			: strength === 'regular'
				? `- Focus on core functionality only
- Simplify implementation steps
- Remove non-essential features
- Streamline to basic requirements`
				: `- Focus mainly on core functionality
- Slightly simplify implementation steps
- Remove some non-essential features
- Streamline most requirements`
}

Return a JSON object with a "subtasks" array. Each subtask should have:
- id: Sequential NUMBER starting from 1 (e.g., 1, 2, 3 - NOT "1", "2", "3")
- title: Clear, specific title
- description: Detailed description
- dependencies: Array of dependency IDs as STRINGS (use format ["${task.id}.1", "${task.id}.2"] for siblings, or empty array [] for no dependencies)
- details: Implementation guidance
- status: "pending"
- testStrategy: Testing approach

IMPORTANT: 
- The 'id' field must be a NUMBER, not a string!
- Dependencies must be strings, not numbers!

Ensure the JSON is valid and properly formatted.`;

		// Define subtask schema
		const subtaskSchema = z.object({
			subtasks: z.array(
				z.object({
					id: z.int().positive(),
					title: z.string().min(5),
					description: z.string().min(10),
					dependencies: z.array(z.string()),
					details: z.string().min(20),
					status: z.string(),
					testStrategy: z.string()
				})
			)
		});

		const aiResult = await generateObjectService({
			role: context.research ? 'research' : 'main',
			session: context.session,
			systemPrompt,
			prompt,
			schema: subtaskSchema,
			objectName: 'subtask_regeneration',
			commandName: context.commandName || `subtask-regen-${direction}`,
			outputType: context.outputType || 'cli'
		});

		const generatedSubtasks = aiResult.mainResult.subtasks || [];

		// Post-process generated subtasks to ensure defaults
		const processedGeneratedSubtasks = generatedSubtasks.map((subtask) => ({
			...subtask,
			status: subtask.status || 'pending',
			testStrategy: subtask.testStrategy || ''
		}));

		// Ensure new subtasks have unique sequential IDs after the preserved ones
		const maxPreservedId = preservedSubtasks.reduce(
			(max, st) => Math.max(max, st.id || 0),
			0
		);
		let nextId = maxPreservedId + 1;
		const idMapping = new Map();
		const normalizedGeneratedSubtasks = processedGeneratedSubtasks
			.map((st) => {
				const originalId = st.id;
				const newId = nextId++;
				idMapping.set(originalId, newId);
				return {
					...st,
					id: newId
				};
			})
			.map((st) => ({
				...st,
				dependencies: (st.dependencies || []).map((dep) => {
					if (typeof dep !== 'string' || !dep.startsWith(`${task.id}.`)) {
						return dep;
					}
					const [, siblingIdPart] = dep.split('.');
					const originalSiblingId = Number.parseInt(siblingIdPart, 10);
					const remappedSiblingId = idMapping.get(originalSiblingId);
					return remappedSiblingId ? `${task.id}.${remappedSiblingId}` : dep;
				})
			}));

		// Update task with preserved subtasks + newly generated ones
		task.subtasks = [...preservedSubtasks, ...normalizedGeneratedSubtasks];

		return {
			updatedTask: task,
			regenerated: true,
			preserved: preservedSubtasks.length,
			generated: normalizedGeneratedSubtasks.length
		};
	} catch (error) {
		log(
			'warn',
			`Failed to regenerate subtasks for task ${task.id}: ${error.message}`
		);
		// Don't fail the whole operation if subtask regeneration fails
		return {
			updatedTask: task,
			regenerated: false,
			preserved: preservedSubtasks.length,
			generated: 0,
			error: error.message
		};
	}
}

/**
 * Generates AI prompt for scope adjustment
 * @param {Object} task - The task to adjust
 * @param {string} direction - 'up' or 'down'
 * @param {string} strength - 'light', 'regular', or 'heavy'
 * @param {string} customPrompt - Optional custom instructions
 * @returns {string} The generated prompt
 */
function generateScopePrompt(task, direction, strength, customPrompt) {
	const isUp = direction === 'up';
	const strengthDescriptions = {
		light: isUp ? 'minor enhancements' : 'slight simplifications',
		regular: isUp
			? 'moderate complexity increases'
			: 'moderate simplifications',
		heavy: isUp ? 'significant complexity additions' : 'major simplifications'
	};

	let basePrompt = `You are tasked with adjusting the complexity of a task. 

CURRENT TASK:
Title: ${task.title}
Description: ${task.description}
Details: ${task.details}
Test Strategy: ${task.testStrategy || 'Not specified'}

ADJUSTMENT REQUIREMENTS:
- Direction: ${isUp ? 'INCREASE' : 'DECREASE'} complexity
- Strength: ${strength} (${strengthDescriptions[strength]})
- Preserve the core purpose and functionality of the task
- Maintain consistency with the existing task structure`;

	if (isUp) {
		basePrompt += `
- Add more detailed requirements, edge cases, or advanced features
- Include additional implementation considerations
- Enhance error handling and validation requirements
- Expand testing strategies with more comprehensive scenarios`;
	} else {
		basePrompt += `
- Focus on core functionality and essential requirements
- Remove or simplify non-essential features  
- Streamline implementation details
- Simplify testing to focus on basic functionality`;
	}

	if (customPrompt) {
		basePrompt += `\n\nCUSTOM INSTRUCTIONS:\n${customPrompt}`;
	}

	basePrompt += `\n\nReturn a JSON object with the updated task containing these fields:
- title: Updated task title
- description: Updated task description  
- details: Updated implementation details
- testStrategy: Updated test strategy
- priority: Task priority ('low', 'medium', or 'high')

Ensure the JSON is valid and properly formatted.`;

	return basePrompt;
}

/**
 * Adjusts task complexity using AI
 * @param {Object} task - The task to adjust
 * @param {string} direction - 'up' or 'down'
 * @param {string} strength - 'light', 'regular', or 'heavy'
 * @param {string} customPrompt - Optional custom instructions
 * @param {Object} context - Context object with projectRoot, tag, etc.
 * @returns {Promise<Object>} Updated task data and telemetry
 */
async function adjustTaskComplexity(
	task,
	direction,
	strength,
	customPrompt,
	context
) {
	const systemPrompt = `You are an expert software project manager who helps adjust task complexity while maintaining clarity and actionability.`;

	const prompt = generateScopePrompt(task, direction, strength, customPrompt);

	// Define the task schema for structured response using Zod
	const taskSchema = z.object({
		title: z
			.string()
			.min(1)
			.describe('Updated task title reflecting scope adjustment'),
		description: z
			.string()
			.min(1)
			.describe('Updated task description with adjusted scope'),
		details: z
			.string()
			.min(1)
			.describe('Updated implementation details with adjusted complexity'),
		testStrategy: z
			.string()
			.min(1)
			.describe('Updated testing approach for the adjusted scope'),
		priority: z.enum(['low', 'medium', 'high']).describe('Task priority level')
	});

	const aiResult = await generateObjectService({
		role: context.research ? 'research' : 'main',
		session: context.session,
		systemPrompt,
		prompt,
		schema: taskSchema,
		objectName: 'updated_task',
		commandName: context.commandName || `scope-${direction}`,
		outputType: context.outputType || 'cli'
	});

	const updatedTaskData = aiResult.mainResult;

	// Ensure priority has a value (in case AI didn't provide one)
	const processedTaskData = {
		...updatedTaskData,
		priority: updatedTaskData.priority || task.priority || 'medium'
	};

	return {
		updatedTask: {
			...task,
			...processedTaskData
		},
		telemetryData: aiResult.telemetryData
	};
}

/**
 * Increases task complexity (scope-up)
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Array<number>} taskIds - Array of task IDs to scope up
 * @param {string} strength - Strength level ('light', 'regular', 'heavy')
 * @param {string} customPrompt - Optional custom instructions
 * @param {Object} context - Context object with projectRoot, tag, etc.
 * @param {string} outputFormat - Output format ('text' or 'json')
 * @returns {Promise<Object>} Results of the scope-up operation
 */
export async function scopeUpTask(
	tasksPath,
	taskIds,
	strength = 'regular',
	customPrompt = null,
	context = {},
	outputFormat = 'text'
) {
	// Validate inputs
	if (!validateStrength(strength)) {
		throw new Error(
			`Invalid strength level: ${strength}. Must be one of: ${VALID_STRENGTHS.join(', ')}`
		);
	}

	const { projectRoot = '.', tag = 'master' } = context;

	// Read tasks data
	const data = readJSON(tasksPath, projectRoot, tag);
	const tasks = data?.tasks || [];

	// Validate all task IDs exist
	for (const taskId of taskIds) {
		if (!taskExists(tasks, taskId)) {
			throw new Error(`Task with ID ${taskId} not found`);
		}
	}

	const updatedTasks = [];
	let combinedTelemetryData = null;

	// Process each task
	for (const taskId of taskIds) {
		const taskResult = findTaskById(tasks, taskId);
		const task = taskResult.task;
		if (!task) {
			throw new Error(`Task with ID ${taskId} not found`);
		}

		if (outputFormat === 'text') {
			log('info', `Scoping up task ${taskId}: ${task.title}`);
		}

		// Get original complexity score (if available)
		const originalComplexity = getCurrentComplexityScore(taskId, context);
		if (originalComplexity && outputFormat === 'text') {
			log('info', `Original complexity: ${originalComplexity}/10`);
		}

		const adjustResult = await adjustTaskComplexity(
			task,
			'up',
			strength,
			customPrompt,
			context
		);

		// Regenerate subtasks based on new complexity while preserving completed work
		const subtaskResult = await regenerateSubtasksForComplexity(
			adjustResult.updatedTask,
			tasksPath,
			context,
			'up',
			strength,
			originalComplexity
		);

		// Log subtask regeneration info if in text mode
		if (outputFormat === 'text' && subtaskResult.regenerated) {
			log(
				'info',
				`Regenerated ${subtaskResult.generated} pending subtasks (preserved ${subtaskResult.preserved} completed)`
			);
		}

		// Update task in data
		const taskIndex = data.tasks.findIndex((t) => t.id === taskId);
		if (taskIndex !== -1) {
			data.tasks[taskIndex] = subtaskResult.updatedTask;
			updatedTasks.push(subtaskResult.updatedTask);
		}

		// Re-analyze complexity after scoping (if we have a session for AI calls)
		if (context.session && originalComplexity) {
			try {
				// Write the updated task first so complexity analysis can read it
				writeJSON(tasksPath, data, projectRoot, tag);

				// Re-analyze complexity
				const newComplexity = await reanalyzeTaskComplexity(
					subtaskResult.updatedTask,
					tasksPath,
					context
				);
				if (newComplexity && outputFormat === 'text') {
					const complexityChange = newComplexity - originalComplexity;
					const arrow =
						complexityChange > 0 ? '↗️' : complexityChange < 0 ? '↘️' : '➡️';
					log(
						'info',
						`New complexity: ${originalComplexity}/10 ${arrow} ${newComplexity}/10 (${complexityChange > 0 ? '+' : ''}${complexityChange})`
					);
				}
			} catch (error) {
				if (outputFormat === 'text') {
					log('warn', `Could not re-analyze complexity: ${error.message}`);
				}
			}
		}

		// Combine telemetry data
		if (adjustResult.telemetryData) {
			if (!combinedTelemetryData) {
				combinedTelemetryData = { ...adjustResult.telemetryData };
			} else {
				// Sum up costs and tokens
				combinedTelemetryData.inputTokens +=
					adjustResult.telemetryData.inputTokens || 0;
				combinedTelemetryData.outputTokens +=
					adjustResult.telemetryData.outputTokens || 0;
				combinedTelemetryData.totalTokens +=
					adjustResult.telemetryData.totalTokens || 0;
				combinedTelemetryData.totalCost +=
					adjustResult.telemetryData.totalCost || 0;
			}
		}
	}

	// Write updated data
	writeJSON(tasksPath, data, projectRoot, tag);

	if (outputFormat === 'text') {
		log('info', `Successfully scoped up ${updatedTasks.length} task(s)`);
	}

	return {
		updatedTasks,
		telemetryData: combinedTelemetryData
	};
}

/**
 * Decreases task complexity (scope-down)
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Array<number>} taskIds - Array of task IDs to scope down
 * @param {string} strength - Strength level ('light', 'regular', 'heavy')
 * @param {string} customPrompt - Optional custom instructions
 * @param {Object} context - Context object with projectRoot, tag, etc.
 * @param {string} outputFormat - Output format ('text' or 'json')
 * @returns {Promise<Object>} Results of the scope-down operation
 */
export async function scopeDownTask(
	tasksPath,
	taskIds,
	strength = 'regular',
	customPrompt = null,
	context = {},
	outputFormat = 'text'
) {
	// Validate inputs
	if (!validateStrength(strength)) {
		throw new Error(
			`Invalid strength level: ${strength}. Must be one of: ${VALID_STRENGTHS.join(', ')}`
		);
	}

	const { projectRoot = '.', tag = 'master' } = context;

	// Read tasks data
	const data = readJSON(tasksPath, projectRoot, tag);
	const tasks = data?.tasks || [];

	// Validate all task IDs exist
	for (const taskId of taskIds) {
		if (!taskExists(tasks, taskId)) {
			throw new Error(`Task with ID ${taskId} not found`);
		}
	}

	const updatedTasks = [];
	let combinedTelemetryData = null;

	// Process each task
	for (const taskId of taskIds) {
		const taskResult = findTaskById(tasks, taskId);
		const task = taskResult.task;
		if (!task) {
			throw new Error(`Task with ID ${taskId} not found`);
		}

		if (outputFormat === 'text') {
			log('info', `Scoping down task ${taskId}: ${task.title}`);
		}

		// Get original complexity score (if available)
		const originalComplexity = getCurrentComplexityScore(taskId, context);
		if (originalComplexity && outputFormat === 'text') {
			log('info', `Original complexity: ${originalComplexity}/10`);
		}

		const adjustResult = await adjustTaskComplexity(
			task,
			'down',
			strength,
			customPrompt,
			context
		);

		// Regenerate subtasks based on new complexity while preserving completed work
		const subtaskResult = await regenerateSubtasksForComplexity(
			adjustResult.updatedTask,
			tasksPath,
			context,
			'down',
			strength,
			originalComplexity
		);

		// Log subtask regeneration info if in text mode
		if (outputFormat === 'text' && subtaskResult.regenerated) {
			log(
				'info',
				`Regenerated ${subtaskResult.generated} pending subtasks (preserved ${subtaskResult.preserved} completed)`
			);
		}

		// Update task in data
		const taskIndex = data.tasks.findIndex((t) => t.id === taskId);
		if (taskIndex !== -1) {
			data.tasks[taskIndex] = subtaskResult.updatedTask;
			updatedTasks.push(subtaskResult.updatedTask);
		}

		// Re-analyze complexity after scoping (if we have a session for AI calls)
		if (context.session && originalComplexity) {
			try {
				// Write the updated task first so complexity analysis can read it
				writeJSON(tasksPath, data, projectRoot, tag);

				// Re-analyze complexity
				const newComplexity = await reanalyzeTaskComplexity(
					subtaskResult.updatedTask,
					tasksPath,
					context
				);
				if (newComplexity && outputFormat === 'text') {
					const complexityChange = newComplexity - originalComplexity;
					const arrow =
						complexityChange > 0 ? '↗️' : complexityChange < 0 ? '↘️' : '➡️';
					log(
						'info',
						`New complexity: ${originalComplexity}/10 ${arrow} ${newComplexity}/10 (${complexityChange > 0 ? '+' : ''}${complexityChange})`
					);
				}
			} catch (error) {
				if (outputFormat === 'text') {
					log('warn', `Could not re-analyze complexity: ${error.message}`);
				}
			}
		}

		// Combine telemetry data
		if (adjustResult.telemetryData) {
			if (!combinedTelemetryData) {
				combinedTelemetryData = { ...adjustResult.telemetryData };
			} else {
				// Sum up costs and tokens
				combinedTelemetryData.inputTokens +=
					adjustResult.telemetryData.inputTokens || 0;
				combinedTelemetryData.outputTokens +=
					adjustResult.telemetryData.outputTokens || 0;
				combinedTelemetryData.totalTokens +=
					adjustResult.telemetryData.totalTokens || 0;
				combinedTelemetryData.totalCost +=
					adjustResult.telemetryData.totalCost || 0;
			}
		}
	}

	// Write updated data
	writeJSON(tasksPath, data, projectRoot, tag);

	if (outputFormat === 'text') {
		log('info', `Successfully scoped down ${updatedTasks.length} task(s)`);
	}

	return {
		updatedTasks,
		telemetryData: combinedTelemetryData
	};
}
