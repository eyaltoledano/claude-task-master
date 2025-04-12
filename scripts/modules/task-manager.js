/**
 * task-manager.js
 * Central logic for AI interactions and higher-level task operations.
 * Local file-based CRUD operations have been moved to local-task-manager.js
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
// Keep Table, readline, ora, inquirer if used by remaining functions (like analyze)
import { Anthropic } from '@anthropic-ai/sdk';
import ora from 'ora';
import inquirer from 'inquirer';

import {
	CONFIG,
	log,
	readJSON, // Still needed by functions remaining here (e.g., analyze)
	writeJSON, // Still needed by functions remaining here (e.g., analyze report)
	sanitizePrompt,
	findTaskById,
	readComplexityReport,
	findTaskInComplexityReport,
	truncate,
	enableSilentMode,
	disableSilentMode,
	isSilentMode,
	taskExists,
	formatTaskId,
	generateId
} from './utils.js';

import {
	// displayBanner, // UI calls likely stay in ui.js or commands.js
	// getStatusWithColor,
	// formatDependenciesWithStatus,
	getComplexityWithColor, // Needed for analyzeTaskComplexity display
	startLoadingIndicator,
	stopLoadingIndicator,
	// createProgressBar // Moved to local-task-manager or ui.js?
} from './ui.js';

import {
	callClaude, // AI functions remain relevant here
	generateSubtasks,
	generateSubtasksWithPerplexity,
	generateComplexityAnalysisPrompt,
	getAvailableAIModel,
	handleClaudeError,
	// _handleAnthropicStream, // Keep if needed by remaining funcs
	getConfiguredAnthropicClient,
	// sendChatWithContext,
	parseTasksFromCompletion,
	generateTaskDescriptionWithPerplexity,
	parseSubtasksFromText,
	getAnthropicClient,
	getPerplexityClient,
	// buildParsePRDPrompt, // Removed non-existent export
	parseTaskJsonResponse,
	_handleAnthropicStream,
	// _handlePerplexityStream // Removed non-existent export
} from './ai-services.js';

// Removed import for LocalTaskManager - should use provider pattern
// Use default import for JiraTaskManager
import JiraTaskManager from './jira-task-manager.js'; 

// Removed import for dependency-manager functions, should use provider
// import { validateDependencies, fixDependencies } from './dependency-manager.js';

// Initialize Anthropic client if needed by remaining functions
const anthropic = new Anthropic({
	apiKey: process.env.ANTHROPIC_API_KEY
});

// Import perplexity if available and needed by remaining functions
let perplexity;

try {
	if (process.env.PERPLEXITY_API_KEY) {
		const OpenAI = (await import('openai')).default;
		perplexity = new OpenAI({
			apiKey: process.env.PERPLEXITY_API_KEY,
			baseURL: 'https://api.perplexity.ai'
		});
		log('info', `Initialized Perplexity client`);
	}
} catch (error) {
	log('warn', `Failed to initialize Perplexity client: ${error.message}`);
}


// --- Functions involving AI or Complex Logic (potentially provider-agnostic input) ---

/**
 * Parse a PRD file and generate tasks using AI.
 * This function interacts with AI and then uses local file storage operations.
 * It might need refactoring if the output should go to a different provider.
 * For now, keep it here as it orchestrates AI and local file writing.
 * @param {string} prdPath - Path to the PRD file
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {number} numTasks - Number of tasks to generate
 * @param {Object} options - Additional options
 * @param {Object} options.reportProgress - Function to report progress to MCP server (optional)
 * @param {Object} options.mcpLog - MCP logger object (optional)
 * @param {Object} options.session - Session object from MCP server (optional)
 * @param {Object} aiClient - AI client to use (optional)
 * @param {Object} modelConfig - Model configuration (optional)
 */
async function parsePRD(
	prdPath,
	tasksPath,
	numTasks,
	options = {},
	aiClient = null,
	modelConfig = null
) {
	const { reportProgress, mcpLog, session } = options;
	const outputFormat = mcpLog ? 'json' : 'text';
	const report = (message, level = 'info') => { /* ... reporter logic ... */ };

	try {
		report(`Parsing PRD file: ${prdPath}`, 'info');
		const prdContent = fs.readFileSync(prdPath, 'utf8');

		// AI Call
		const tasksData = await callClaude(
			prdContent, prdPath, numTasks, 0, 
			{ reportProgress, mcpLog, session },
            aiClient, modelConfig
		);

		// Local File System Operations - These might need to be delegated based on provider?
		const tasksDir = path.dirname(tasksPath);
		if (!fs.existsSync(tasksDir)) {
			fs.mkdirSync(tasksDir, { recursive: true });
		}
		writeJSON(tasksPath, tasksData); // Writes to local file
		report(`Tasks saved to: ${tasksPath}`, 'info');

		// ... rest of the function (UI feedback) ...
		return tasksData;
	} catch (error) {
        // ... error handling ...
	}
}

/**
 * Update tasks based on new context using AI.
 * Reads tasks (provider-agnostic?), calls AI, then updates tasks (provider-specific).
 * @param {string} tasksPath - Path for local provider context (might be ignored by Jira)
 * @param {string|number} fromId - Task ID/Key to start updating from
 * @param {string} prompt - Prompt with new context
 * @param {boolean} useResearch - Whether to use Perplexity AI for research
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider }
 */
async function updateTasks(
	tasksPath,
	fromId,
	prompt,
	useResearch = false,
	{ reportProgress, mcpLog, session, taskProvider } = {} // Inject TaskProvider
) {
	// ... reporter setup ...
    const report = (message, level = 'info') => { /* ... */ };
	try {
		report(`Updating tasks from ID ${fromId} with prompt: "${prompt}"`);

		// Read tasks - Needs to use the injected taskProvider!
		const data = await taskProvider.getTasks(); // Assumes getTasks returns { tasks: [...] }
        // TODO: Adapt this - getTasks might need options or return format adjusted
		if (!data || !data.tasks) {
			throw new Error(`No valid tasks found via provider.`);
		}

		// Find tasks to update (logic needs care with string vs number IDs)
        // Assume IDs are strings for flexibility
		const tasksToUpdate = data.tasks.filter(
			(task) =>
                // Compare IDs appropriately (numeric for local, string for Jira?)
                // This comparison needs to be robust based on provider.
                // Simple string comparison might work for now.
				(String(task.id) >= String(fromId)) && task.status !== 'done'
		);
		// ... rest of finding logic ...

		// Prepare context for AI (remains mostly the same)
		const updateContext = ` ... `; // Construct based on tasksToUpdate

		// Call AI (remains the same)
		let updatedTasksJson;
        const spinner = startLoadingIndicator('Updating tasks with AI...');
		try {
            // ... AI call logic (Claude/Perplexity) ...
            updatedTasksJson = /* AI result */ '';
            stopLoadingIndicator(spinner, 'AI update completed.', 'succeed');
        } catch (aiError) {
            stopLoadingIndicator(spinner, 'AI update failed.', 'fail');
            handleClaudeError(aiError, report);
            throw aiError;
        }

		// Parse AI response (remains the same)
		let updatedTasksArray = parseTasksFromCompletion(updatedTasksJson);

		// Merge updates - Needs to use the injected taskProvider!
        report('Merging updates...', 'info');
        let updatedCount = 0;
        for (const updatedTaskData of updatedTasksArray) {
            try {
                // Use provider's update function
                await taskProvider.updateTask(updatedTaskData.id, updatedTaskData);
                updatedCount++;
                report(`Updated task ${updatedTaskData.id} via provider.`, 'debug');
                // TODO: Handle potential addition of new tasks by AI if needed
            } catch (updateError) {
                report(`Failed to update task ${updatedTaskData.id} via provider: ${updateError.message}`, 'error');
            }
        }

        // Re-fetch data? Or assume updates are reflected? Depends on provider.
        // Let's assume for now updateTask handles persistence.

		// ... UI feedback ...
		return { updatedCount }; // Return relevant info

	} catch (error) {
        // ... error handling ...
	}
}

/**
 * Updates a single task by its ID using AI.
 * Reads task (provider-specific), calls AI, updates task (provider-specific).
 * @param {string} tasksPath - Path for local provider context
 * @param {string} taskId - The ID/Key of the task or subtask to update
 * @param {string} prompt - Prompt with the new information or changes
 * @param {boolean} useResearch - Whether to use Perplexity AI for research
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider }
 */
async function updateTaskById(
	tasksPath,
	taskId,
	prompt,
	useResearch = false,
	{ reportProgress, mcpLog, session, taskProvider } = {} // Inject TaskProvider
) {
	// ... reporter setup ...
    const report = (message, level = 'info') => { /* ... */ };
	try {
		report(`Updating task ${taskId} with prompt: "${prompt}"`);

		// Read the task using the provider
		const targetTask = await taskProvider.getTask(taskId);
		if (!targetTask) {
			throw new Error(
				`Task or subtask with ID/Key "${taskId}" not found via provider.`
			);
		}
        // TODO: Handle subtask case - does getTask fetch parent context if needed?
        const isSubtask = String(taskId).includes('.'); // Basic check, might need refinement for Jira
		const taskIdentifier = isSubtask ? `Subtask ${taskId}` : `Task ${taskId}`;

		// ... progress tracking ...

		// Prepare context for AI (using fetched targetTask)
		const updateContext = ` ... Task to Update: ... ${JSON.stringify(targetTask)} ... Update Request: ${prompt} ... Instructions ... `;

		// Call AI
        updateProgress(`Calling AI to update ${taskIdentifier}`);
        const spinner = startLoadingIndicator(`Updating ${taskIdentifier} with AI...`);
		let updatedTaskJson;
        try {
            // ... AI call logic (Claude/Perplexity) ...
            updatedTaskJson = /* AI result */ '';
            stopLoadingIndicator(spinner, 'AI update completed.', 'succeed');
        } catch (aiError) {
             stopLoadingIndicator(spinner, 'AI update failed.', 'fail');
            handleClaudeError(aiError, report);
            throw aiError;
        }

		// Parse AI response (expecting single task object)
		let updatedTaskData = null;
        // ... robust parsing logic ...
        try { updatedTaskData = JSON.parse(updatedTaskJson); } catch (e) { /* ... handle fallback ... */ }

        if (!updatedTaskData || typeof updatedTaskData !== 'object') {
             throw new Error('Parsed AI response is not a valid task object.');
        }

        // Ensure ID matches
        if (String(updatedTaskData.id) !== String(taskId)) {
             report(`AI returned task data with ID ${updatedTaskData.id}, but expected ${taskId}. Updating ID.`, 'warn');
             updatedTaskData.id = taskId;
        }

		// Update the task using the provider
        updateProgress(`Saving updates for ${taskIdentifier} ${taskId}`);
		await taskProvider.updateTask(taskId, updatedTaskData); // Assumes updateTask takes ID and data

        report(`Successfully updated ${taskIdentifier} ${taskId} via provider.`, 'success');

		// ... UI feedback ...
		return { updatedTask: updatedTaskData }; // Return updated task data

	} catch (error) {
        // ... error handling ...
	}
}


/**
 * Appends details to a specific subtask's details field.
 * Reads task (provider-specific), modifies details, updates task (provider-specific).
 * @param {string} tasksPath - Path for local provider context
 * @param {string} subtaskId - The ID/Key of the subtask to update
 * @param {string} prompt - The text content to append
 * @param {boolean} useResearch - (Informational only for this function)
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider }
 */
async function updateSubtaskById(
	tasksPath, // May be unused by Jira provider
	subtaskId,
	prompt,
	useResearch = false,
	{ reportProgress, mcpLog, session, taskProvider } = {} // Inject TaskProvider
) {
    const outputFormat = mcpLog ? 'json' : 'text';
	const report = (message, level = 'info') => { /* ... reporter setup ... */ };

	// TODO: Validate subtaskId format based on provider?

	if (!prompt || prompt.trim() === '') {
		throw new Error('Prompt content cannot be empty.');
	}

	try {
		report(`Appending details to subtask ${subtaskId}.`);

		// 1. Get the subtask data using the provider
		const targetSubtask = await taskProvider.getTask(subtaskId); // Assuming getTask works for subtasks
		if (!targetSubtask) {
			throw new Error(`Subtask with ID/Key "${subtaskId}" not found via provider.`);
		}
        report(`Found Subtask ${subtaskId}: "${targetSubtask.title}".`, 'debug');

		// 2. Prepare the updated data object
		const timestamp = new Date().toISOString();
		const contentToAppend = `\n\n---\n*Update added at ${timestamp}:*\n${prompt}\n---`;
		const updatedDetails = (targetSubtask.details || '') + contentToAppend;

        // Create update payload - only update the details field
        const updatePayload = {
            details: updatedDetails
            // For Jira, this needs mapping to the 'description' field potentially
        };

        // TODO: Adapt payload for Jira if `details` maps to `description`
        // if (TASK_PROVIDER_TYPE === 'jira') {
        //    updatePayload = { description: updatedDetails };
        // }

		// 3. Update the subtask using the provider
		await taskProvider.updateTask(subtaskId, updatePayload);
        report(`Successfully updated details for subtask ${subtaskId} via provider.`, 'success');

		// ... UI feedback ...

		// Return updated task (fetch again?) or just success indicator
        const updatedTask = await taskProvider.getTask(subtaskId); // Fetch again to confirm
		return outputFormat === 'json' ? { subtask: updatedTask } : true;

	} catch (error) {
        report(`Error updating subtask ${subtaskId}: ${error.message}`, 'error');
        // ... error handling ...
        throw error;
	}
}


/**
 * Expand a task into subtasks using AI.
 * Reads parent task (provider-specific), calls AI, adds subtasks (provider-specific).
 * @param {string} tasksPath - Path for local provider context
 * @param {string} taskId - ID/Key of the task to expand
 * @param {number} numSubtasks - Desired number of subtasks
 * @param {boolean} useResearch - Whether to use Perplexity AI
 * @param {string} additionalContext - Additional context for the AI
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider, force }
 */
async function expandTask(
	tasksPath, // May be unused by Jira provider
	taskId,
	numSubtasks,
	useResearch = false,
	additionalContext = '',
	{ reportProgress, mcpLog, session, taskProvider, force = false } = {} // Inject TaskProvider & force
) {
	// ... reporter setup ...
    const report = (message, level = 'info') => { /* ... */ };
	try {
		report(`Expanding task ID ${taskId} into ~${numSubtasks} subtasks.`);

		// Read the parent task using the provider
		const task = await taskProvider.getTask(taskId);
		if (!task) {
			throw new Error(`Task with ID/Key ${taskId} not found via provider.`);
		}

        // Check for existing subtasks - requires provider implementation
        // Assuming task object has a subtasks property/field if applicable
		if (!force && task.subtasks && task.subtasks.length > 0) {
            report(`Task ${taskId} already has subtasks. Use --force to overwrite.`, 'warn');
            // ... confirmation logic (CLI only) or return error for MCP ...
            // if (outputFormat === 'text') { ... prompt ... } else { return { error: ... }; }
             return { error: 'Task already has subtasks. Use force=true to overwrite.', task: task }; // Example MCP return
		}

        if (force && task.subtasks && task.subtasks.length > 0) {
             report(`Force flag set. Clearing existing subtasks for Task ${taskId}.`, 'info');
             // Call provider function to clear subtasks
             await taskProvider.clearSubtasks(tasksPath, [taskId]); // Assuming clearSubtasks exists
        }

		// ... progress tracking setup ...

        // Read complexity report (local file operation, independent of provider)
		let taskAnalysis = null;
		try {
             // ... read local complexity report ...
        } catch (reportError) { /* ... handle error ... */ }

		// Generate AI prompt (uses task data)
        updateProgress('Generating AI prompt');
		const prompt = generateSubtaskPrompt(task, numSubtasks, additionalContext, taskAnalysis);

		// Call AI for subtasks
        updateProgress('Calling AI for subtasks');
        const spinner = startLoadingIndicator('Generating subtasks with AI...');
		let subtasks;
        try {
             // ... AI call logic (generateSubtasks / generateSubtasksWithPerplexity) ...
             subtasks = await generateSubtasks(prompt, task.id, session, mcpLog); // Example
             stopLoadingIndicator(spinner, 'Subtask generation complete.', 'succeed');
        } catch (aiError) {
            stopLoadingIndicator(spinner, 'Subtask generation failed.', 'fail');
            handleClaudeError(aiError, report);
            throw aiError;
        }

        if (!subtasks || subtasks.length === 0) {
            report('AI did not generate any subtasks.', 'warn');
            return { task: task }; // Return original task data
        }

		// Add subtasks using the provider
        report(`Adding ${subtasks.length} generated subtasks to task ${taskId} via provider...`);
        let addedCount = 0;
        for (const subtaskData of subtasks) {
            try {
                // Provider needs an addSubtask method
                await taskProvider.addSubtask(taskId, null, subtaskData); // Assumes addSubtask format
                addedCount++;
            } catch (addSubtaskError) {
                report(`Failed to add generated subtask "${subtaskData.title}": ${addSubtaskError.message}`, 'error');
            }
        }
        report(`Successfully added ${addedCount} subtasks to task ${taskId} via provider.`, 'success');

		// ... UI feedback ...

        // Fetch updated parent task to return?
        const updatedTask = await taskProvider.getTask(taskId);
		return { task: updatedTask };

		} catch (error) {
        // ... error handling ...
		throw error;
	}
}


/**
 * Expand all pending tasks into subtasks using AI.
 * Fetches tasks (provider-specific), analyzes, calls AI, adds subtasks (provider-specific).
 * @param {string} tasksPath - Path for local provider context
 * @param {number} numSubtasks - Default number of subtasks per task
 * @param {boolean} useResearch - Whether to use Perplexity AI
 * @param {string} additionalContext - General additional context
 * @param {boolean} forceFlag - Whether to force overwrite existing subtasks
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider }
 */
async function expandAllTasks(
	tasksPath, // May be unused
	numSubtasks = CONFIG.defaultSubtasks,
	useResearch = false,
	additionalContext = '',
	forceFlag = false,
	{ reportProgress, mcpLog, session, taskProvider } = {} // Inject TaskProvider
) {
	// ... reporter setup ...
    const report = (message, level = 'info') => { /* ... */ };
	try {
		report('Starting expansion of all pending tasks.');

		// Read pending tasks using provider
        const allTasksData = await taskProvider.getTasks({ status: 'pending' }); // Assuming getTasks supports status filter
		if (!allTasksData || !allTasksData.tasks) {
			throw new Error('Could not fetch tasks from provider.');
		}
        const pendingTasks = allTasksData.tasks;

		if (pendingTasks.length === 0) {
            report('No pending tasks found to expand.', 'info');
            // ... return appropriate info ...
             return { updated: false, count: 0, skipped: 0 };
		}

		// ... check for existing subtasks and handle force/confirmation ...

        // Read complexity report (local file operation)
        let complexityReport = null;
        // ... read report logic ...

        // Loop through pending tasks and call expandTask logic (or adapted logic)
        let updatedCount = 0;
        let failedCount = 0;
        for (const task of pendingTasks) {
             // Skip if needed based on force flag and existing subtasks
             // ... skip logic ...

             try {
                 // Find complexity analysis
                 const taskAnalysis = findTaskInComplexityReport(complexityReport, task.id);
                 // Use the requested number of subtasks or a default (assuming options is in scope)
                 const effectiveNumSubtasks = options?.num || 5;

                 // Generate AI prompt
                 const prompt = generateSubtaskPrompt(task, effectiveNumSubtasks, additionalContext, taskAnalysis);

                 // Call AI
                 let subtasks = await generateSubtasks(prompt, task.id, session, mcpLog); // Or with Perplexity

                 if (subtasks && subtasks.length > 0) {
                     // Add subtasks via provider
                     for (const subtaskData of subtasks) {
                         await taskProvider.addSubtask(task.id, null, subtaskData);
                     }
                     updatedCount++;
				} else {
                    failedCount++;
                 }
             } catch (taskError) {
                 report(`Failed to expand task ${task.id}: ${taskError.message}`, 'error');
                 failedCount++;
             }
        }

		// ... final reporting and UI feedback ...

		return { updated: updatedCount > 0, count: updatedCount, skipped: failedCount };

	} catch (error) {
        // ... error handling ...
		throw error;
	}
}


/**
 * Add a new task using AI or manual data.
 * Calls AI (if needed), then adds task via provider.
 * @param {string} tasksPath - Path for local provider context
 * @param {string} prompt - Prompt describing the task
 * @param {Array<string>} dependencies - Array of dependency IDs/Keys
 * @param {string} priority - Task priority
 * @param {object} options - Additional options { reportProgress, mcpLog, session, taskProvider }
 * @param {string} outputFormat - 'text' or 'json'
 * @param {object} customEnv - Custom environment vars for AI (optional)
 * @param {object} manualTaskData - Pre-defined task data to bypass AI (optional)
 */
async function addTask(
	tasksPath, // Maybe unused
	prompt,
	dependencies = [],
	priority = 'medium',
	{ reportProgress, mcpLog, session, taskProvider } = {}, // Inject provider
	outputFormat = 'text',
	customEnv = null,
	manualTaskData = null
) {
	// ... reporter setup ...
    const report = (message, level = 'info') => { /* ... */ };
	try {
        let newTaskDataPayload;

        if (manualTaskData && manualTaskData.title && manualTaskData.description) {
            report('Using provided manual task data.', 'info');
            newTaskDataPayload = {
                // id: handled by provider? or generate here?
                title: manualTaskData.title,
                description: manualTaskData.description,
                details: manualTaskData.details || '',
                testStrategy: manualTaskData.testStrategy || '',
                status: 'pending', // Default status
                priority: priority || CONFIG.defaultPriority,
                dependencies: dependencies || [],
                subtasks: [],
                // complexityScore: manualTaskData.complexityScore
            };
        } else if (prompt) {
             report('Generating new task details with AI...');
             // ... spinner setup ...
             // ... progress tracking setup ...

             // Get context (e.g., recent tasks) - Needs provider?
             // const recentTasks = (await taskProvider.getTasks({ limit: 5 })).tasks || [];
             const recentTasks = []; // Simplify for now

             // Prepare AI prompt
             const fullPrompt = ` ... New Task Request: ${prompt} ... Instructions ... `;

             let taskDetailsJson;
             try {
                 // ... AI call logic (Claude/Perplexity) ...
                 taskDetailsJson = /* AI Result */ '';
                 // ... stop spinner ...
             } catch (aiError) {
                 // ... handle AI error ...
                 throw aiError;
             }

             // Parse AI response
             let parsedDetails = null;
             // ... robust parsing ...
             try { parsedDetails = JSON.parse(taskDetailsJson); } catch(e) { /* ... */ }

             if (!parsedDetails || !parsedDetails.title || !parsedDetails.description) {
                  throw new Error('AI response missing required fields: title or description.');
             }

             newTaskDataPayload = {
                title: parsedDetails.title,
                description: parsedDetails.description,
                details: parsedDetails.details || '',
                testStrategy: parsedDetails.testStrategy || '',
			status: 'pending',
                priority: priority || CONFIG.defaultPriority,
                dependencies: dependencies || [],
                subtasks: [],
             };

								} else {
             throw new Error('Either a prompt or manual task data must be provided.');
        }

		// Add the new task using the provider
        updateProgress('Saving new task via provider');
        const newTask = await taskProvider.addTask(newTaskDataPayload);
		report(`Successfully added Task ${newTask.id}: "${newTask.title}" via provider`, 'success');

		// ... UI feedback ...
		return outputFormat === 'json' ? { task: newTask } : true;

	} catch (error) {
        // ... error handling ...
		throw error;
	}
}


/**
 * Analyze task complexity using AI.
 * Fetches tasks (provider-specific), calls AI, saves report (local).
 * @param {object} options - Command options including provider
 * @param {object} context - Additional context { reportProgress, mcpLog, session, taskProvider }
 */
async function analyzeTaskComplexity(
	options,
	{ reportProgress, mcpLog, session, taskProvider } = {} // Inject provider
) {
	const {
		file: tasksPath, // Used for context potentially, not direct read
		output: reportPath, // Local report file
		threshold,
		research: useResearch,
		model: specificModel
	} = options;

    // ... reporter setup ...
    const reportLog = (message, level = 'info') => { /* ... */ };
	let spinner;
    // ... spinner setup ...

	try {
		// Fetch tasks using the provider
        reportLog('Fetching tasks for analysis via provider...', 'info');
        const data = await taskProvider.getTasks(); // Fetch all tasks
		if (!data || !data.tasks || data.tasks.length === 0) {
			throw new Error('No tasks found via provider to analyze.');
		}

		// ... Select AI Model ...
		// ... Progress Tracking Setup ...

		// Call AI (Claude or Perplexity) with fetched task data
        let analysisResultText;
        try {
            const analysisPrompt = generateComplexityAnalysisPrompt(data.tasks, useResearch);
            // ... make AI call using useResearch flag ...
             analysisResultText = /* AI Result */ '';
        } catch (aiError) {
            // ... handle AI error ...
            throw aiError;
        }

		// Parse AI response
        let analysisData = [];
        // ... robust parsing logic ...
        try { analysisData = JSON.parse(analysisResultText); } catch(e) { /* ... */ }

        // Process and Validate Analysis Data
        // ... add recommendations, validate scores, add titles ...
         const validatedAnalysis = analysisData.map(item => { /* ... */ }).filter(item => item !== null);

		// Save Report (Conditional based on provider)
		if (taskProvider instanceof LocalTaskManager) {
			updateProgress('Saving complexity report locally...');
			const reportDir = path.dirname(reportPath);
			if (!fs.existsSync(reportDir)) {
				fs.mkdirSync(reportDir, { recursive: true });
			}
			try {
				writeJSON(reportPath, { analysis: validatedAnalysis });
				reportLog(`Complexity report saved to: ${reportPath}`, 'info');
			} catch (writeError) {
				reportLog(`Error saving complexity report: ${writeError.message}`, 'error');
				// Don't throw, just log the error, as analysis itself succeeded
			}
		} else if (taskProvider instanceof JiraTaskManager) {
			updateProgress('Saving complexity report to Jira comment...');
			const targetIssueKey = 'DEVB-1748'; // Target the parent task for this feature
			try {
				const reportJson = JSON.stringify({ analysis: validatedAnalysis }, null, 2);
				const commentBody = 
`## Task Complexity Analysis Report (Generated)

Timestamp: ${new Date().toISOString()}

{code:json}
${reportJson}
{code}`;

				// Ensure the provider has the addComment method
				if (typeof taskProvider.addComment === 'function') {
					await taskProvider.addComment(targetIssueKey, commentBody);
					reportLog(`Complexity report added as comment to Jira issue ${targetIssueKey}`, 'info');
					} else {
					reportLog('Task provider does not support adding comments.', 'warn');
				}
			} catch (commentError) {
				reportLog(`Error adding complexity report comment to Jira ${targetIssueKey}: ${commentError.message}`, 'error');
				// Don't throw, just log the error
									}
								} else {
			reportLog('Unsupported task provider for saving complexity report.', 'warn');
		}

		// ... UI Feedback (summary table, etc.) ...

		return { analysis: validatedAnalysis }; // Return report data

			} catch (error) {
        // ... error handling ...
				throw error;
			}
}


/**
 * Find the next task to work on based on dependencies and status.
 * Fetches tasks (provider-specific) and applies logic.
 * @param {string} tasksPath - Path for local provider context (unused by Jira)
 * @param {object} options - Additional options { taskProvider }
 * @returns {Promise<Object|null>} The next task object or null if none found
 */
async function findNextTask(tasksPath, { taskProvider } = {}) {
    log('debug', 'Finding next task using provider...');
    try {
        const data = await taskProvider.getTasks({ status: 'pending' }); // Fetch pending tasks
        if (!data || !data.tasks || data.tasks.length === 0) {
            log('debug', 'No pending tasks found via provider.');
			return null;
		}

        const allTasks = await taskProvider.getTasks(); // Fetch all tasks for dependency check
        if (!allTasks || !allTasks.tasks) {
             log('warn', 'Could not fetch all tasks for dependency check.');
             return null; // Or proceed with potentially incomplete checks?
        }

        // Filter tasks whose dependencies are met
        const availableTasks = data.tasks.filter((task) => {
            if (!task.dependencies || task.dependencies.length === 0) {
                return true; // No dependencies
            }
            // Check if all dependencies are 'done'
            return task.dependencies.every((depId) => {
                // Need findTaskById equivalent for the provider, or fetch all and filter
                const { task: depTask } = findTaskById(allTasks.tasks, depId); // Use local find for now
                // TODO: Adapt dependency checking based on provider capabilities (e.g., Jira link status)
                return depTask && depTask.status === 'done';
            });
        });

        if (availableTasks.length === 0) {
            log('debug', 'No pending tasks with met dependencies found.');
		return null;
        }

        // Prioritize tasks
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        availableTasks.sort((a, b) => {
            // ... sorting logic (priority, deps count, id) ...
            // Note: ID sort might need adjustment for Jira keys (string vs number)
             const priorityA = priorityOrder[a.priority?.toLowerCase()] || 2;
             const priorityB = priorityOrder[b.priority?.toLowerCase()] || 2;
             if (priorityA !== priorityB) return priorityB - priorityA;
             const depsA = a.dependencies?.length || 0;
             const depsB = b.dependencies?.length || 0;
             if (depsA !== depsB) return depsA - depsB;
             // Simple string comparison for IDs/Keys
             return String(a.id).localeCompare(String(b.id));
        });

        log('debug', `Found next task: ${availableTasks[0].id}`);
        return availableTasks[0];

	} catch (error) {
        log('error', `Error finding next task: ${error.message}`);
        // Depending on desired behavior, either return null or rethrow
        // return null;
        throw error;
    }
}


/**
 * Gets a single task by ID/Key using the provider.
 * @param {string} taskId - The ID/Key of the task.
 * @param {object} options - Additional options { taskProvider }
 * @returns {Promise<Object|null>} - The task object or null.
 */
async function getTask(taskId, { taskProvider } = {}) {
    log('debug', `Getting task ${taskId} using provider...`);
    try {
        const task = await taskProvider.getTask(taskId);
        return task;
    } catch (error) {
        log('error', `Error getting task ${taskId}: ${error.message}`);
        throw error;
    }
}


// --- Functions that might remain or be moved elsewhere --- 

// isTaskDependentOn - operates on task structure, maybe utils?
// generateSubtaskPrompt - AI specific, maybe ai-services?
// getSubtasksFromAI - AI specific, maybe ai-services?

// Export the functions that remain in this module
export {
	parsePRD, // Keep here for now as it orchestrates AI+Write
	updateTasks, // Keep here as it orchestrates Read(Provider)+AI+Update(Provider)
	updateTaskById, // Keep here - Read(Provider)+AI+Update(Provider)
	updateSubtaskById, // Keep here - Read(Provider)+Update(Provider)
	expandTask, // Keep here - Read(Provider)+AI+Add(Provider)
	expandAllTasks, // Keep here - Read(Provider)+AI+Add(Provider)
	addTask, // Keep here - AI+Add(Provider)
	analyzeTaskComplexity, // Keep here - Read(Provider)+AI+WriteReport(Local)
    findNextTask, // Keep here - Read(Provider)+Logic
    getTask, // Keep here - Read(Provider)
    // --- Potentially move these --- 
    // generateSubtaskPrompt,
    // getSubtasksFromAI,
};
