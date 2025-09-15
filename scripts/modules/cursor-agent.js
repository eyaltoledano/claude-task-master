/**
 * cursor-agent.js
 * Integration with Cursor-Agent CLI tool for automated task execution
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { 
	log, 
	readJSON, 
	writeJSON, 
	findTaskById,
	isSilentMode,
	getCurrentTag
} from './utils.js';
import { setTaskStatus } from './task-manager.js';
import { TASKMASTER_TASKS_FILE } from '../../src/constants/paths.js';

/**
 * Check if cursor-agent is available in the system
 * @returns {Promise<boolean>} True if cursor-agent is available
 */
async function isCursorAgentAvailable() {
	return new Promise((resolve) => {
		const process = spawn('cursor-agent', ['--version'], {
			stdio: ['ignore', 'pipe', 'pipe']
		});
		
		process.on('error', () => {
			resolve(false);
		});
		
		process.on('close', (code) => {
			resolve(code === 0);
		});
		
		// Timeout after 5 seconds
		setTimeout(() => {
			process.kill();
			resolve(false);
		}, 5000);
	});
}

/**
 * Generate the directive prompt for cursor-agent
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {boolean} silentMode - Whether to run in silent mode
 * @returns {string} The directive prompt
 */
function generateDirectivePrompt(tasksPath, silentMode = false) {
	const silentModeInstruction = silentMode 
		? '\n6. Silent Mode\n• If Task-Master was started with --silent, do not output descriptive logs.\n• Instead, emit minimal status (spinner: / - \\ | rotating).\n• All task updates should still be written back into .taskmaster/tasks/tasks.json.'
		: '';

	return `You are Cursor Agent integrated into the Task-Master CLI tool.

Purpose

You will take tasks from the Task-Master JSON file and automatically execute them in the user's repository (this repo: task-master).
Your role is to work through all pending tasks, implement their code changes, and update their status as you go.

Input
	•	Tasks file: ${tasksPath}
	•	Repository: the current working directory is the task-master repo
	•	Tasks are structured with: id, title, description, details, testStrategy, dependencies, status, subtasks

Execution Rules
	1.	Sequential Execution
	•	Begin with the first "status": "pending" task that has no unmet dependencies.
	•	Mark each task "in_progress", implement it, then mark "done".
	•	Continue until all tasks are complete.
	2.	Subtasks
	•	If a task contains subtasks, handle them in order.
	•	Mark subtasks as "in_progress" and "done" individually.
	3.	Discovery
	•	If you discover additional work needed, create new tasks or subtasks and append them to ${tasksPath} in the same schema.
	4.	Status Updates
	•	Send structured tool calls (update_todos) to update progress.
	•	Use this exact JSON format for status updates:
	•	{"type": "tool_call", "toolName": "update_todos", "args": {"id": "22", "status": "in-progress"}}
	•	{"type": "tool_call", "toolName": "update_todos", "args": {"id": "22", "status": "done"}}
	•	For subtasks, use dot notation: {"id": "22.1", "status": "done"}
	•	Valid statuses: pending, in-progress, done, review, deferred, cancelled
	•	Example:
	•	<Task 22 : in progress>
	•	Currently: implementing AppleScript window bounds retrieval
	•	<Task 22 : completed ✅>
	5.	Silent Mode${silentModeInstruction}
	6.	Error Handling
	•	If a task cannot be completed, mark it "failed" with an error note in its details.
	•	Continue with other independent tasks.
	7.	Completion
	•	End only when:
	•	All tasks are "done" or "failed".
	•	Or no further progress is possible.

Output
	•	In normal mode: Print human-readable progress updates for each task/subtask.
	•	In --silent mode: Print only a rotating spinner until finished.
	•	Always ensure ${tasksPath} is up to date with task statuses and any new tasks.`;
}

/**
 * Parse JSON stream from cursor-agent output
 * @param {string} data - Raw data chunk from cursor-agent
 * @returns {Array} Array of parsed JSON objects
 */
function parseJsonStream(data) {
	const lines = data.split('\n');
	const jsonObjects = [];
	
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (trimmedLine) {
			try {
				const parsed = JSON.parse(trimmedLine);
				jsonObjects.push(parsed);
			} catch (error) {
				// Skip invalid JSON lines
				continue;
			}
		}
	}
	
	return jsonObjects;
}

/**
 * Check if message is an update_todos tool call
 * @param {Object} message - Parsed message object
 * @returns {Object|null} Tool call data if it's an update_todos call, null otherwise
 */
function isUpdateTodosToolCall(message) {
	if (message.type === 'tool_call' && 
		message.toolName === 'update_todos' && 
		message.args && 
		message.args.id && 
		message.args.status) {
		return {
			taskId: message.args.id,
			status: message.args.status
		};
	}
	return null;
}

/**
 * Extract text content from cursor-agent message
 * @param {Object} message - Parsed message object
 * @returns {string} Extracted text content
 */
function extractTextContent(message) {
	if (message.type === 'assistant' && message.message && message.message.content) {
		const content = message.message.content;
		if (Array.isArray(content)) {
			return content
				.filter(item => item.type === 'text')
				.map(item => item.text)
				.join('');
		}
	}
	return '';
}

/**
 * Check if message indicates tool call start
 * @param {Object} message - Parsed message object
 * @returns {boolean} True if tool call started
 */
function isToolCallStart(message) {
	return message.type === 'tool_call' && message.subtype === 'started';
}

/**
 * Update task status in tasks.json atomically
 * @param {string} tasksPath - Path to tasks.json
 * @param {string} taskId - Task ID to update
 * @param {string} status - New status
 * @param {string} projectRoot - Project root path
 * @param {boolean} debug - Whether to log debug information
 * @returns {Promise<boolean>} Success status
 */
async function updateTaskStatusInFile(tasksPath, taskId, status, projectRoot, debug = false) {
	try {
		// Resolve the current tag for the project
		const currentTag = getCurrentTag(projectRoot) || 'master';
		
		// Use setTaskStatus which handles atomic updates and tag resolution
		await setTaskStatus(tasksPath, taskId, status, { 
			projectRoot,
			tag: currentTag,
			mcpLog: null // Use CLI mode
		});
		
		if (debug) {
			log(`Successfully updated task ${taskId} to status: ${status} in tag: ${currentTag}`, 'info');
		}
		return true;
	} catch (error) {
		if (debug) {
			log(`Error updating task ${taskId} status: ${error.message}`, 'error');
		}
		return false;
	}
}

/**
 * Display progress in normal mode
 * @param {string} taskId - Current task ID
 * @param {string} status - Current status
 * @param {string} currentText - Current text being processed
 */
function displayProgress(taskId, status, currentText) {
	if (isSilentMode()) return;
	
	const statusColor = status === 'in_progress' ? 'yellow' : 
					   status === 'done' ? 'green' : 'red';
	const statusSymbol = status === 'done' ? '✅' : 
						status === 'in_progress' ? '⏳' : '❌';
	
	// Clear current line and display progress
	process.stdout.write('\r\x1b[K');
	process.stdout.write(
		chalk[statusColor](`<Task ${taskId} : ${status} ${statusSymbol}>`)
	);
	
	if (currentText && currentText.length > 0) {
		process.stdout.write(chalk.gray(` Currently: ${currentText}`));
	}
}

/**
 * Create and manage spinner for silent mode
 * Uses ora package for proper spinner animation
 * @returns {Object} Spinner object with update method
 */
function createSilentSpinner() {
	if (!isSilentMode()) return null;
	
	const spinner = ora({
		text: 'Processing tasks with Cursor Agent...',
		color: 'cyan',
		spinner: 'dots'
	}).start();
	
	return {
		spinner,
		update: (text) => {
			if (spinner) {
				spinner.text = text || 'Processing tasks with Cursor Agent...';
			}
		},
		stop: () => {
			if (spinner) {
				spinner.stop();
			}
		},
		showError: (errorMessage) => {
			if (spinner) {
				spinner.fail(chalk.red(`Error: ${errorMessage}`));
			}
		},
		showSuccess: (message) => {
			if (spinner) {
				spinner.succeed(chalk.green(message));
			}
		}
	};
}

/**
 * Main function to run cursor-agent integration
 * @param {string} tasksPath - Path to tasks.json file
 * @param {boolean} silent - Whether to run in silent mode
 * @param {string} projectRoot - Project root path
 * @returns {Promise<Object>} Result object
 */
export async function runCursorAgent(tasksPath = TASKMASTER_TASKS_FILE, silent = false, projectRoot = process.cwd()) {
	// Check if cursor-agent is available
	if (!(await isCursorAgentAvailable())) {
		throw new Error('cursor-agent is not installed or not available in PATH. Please install cursor-agent first.');
	}
	
	// Check if tasks file exists
	if (!fs.existsSync(tasksPath)) {
		throw new Error(`Tasks file not found: ${tasksPath}`);
	}
	
	// Generate directive prompt
	const directive = generateDirectivePrompt(tasksPath, silent);
	
	// Create spinner for silent mode
	const spinner = createSilentSpinner();
	
	let currentTaskId = null;
	let currentStatus = null;
	let currentText = '';
	let buffer = '';
	
	return new Promise((resolve, reject) => {
		// Spawn cursor-agent process
		const cursorAgent = spawn('cursor-agent', ['--print'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: projectRoot
		});
		
		// Send directive to cursor-agent
		cursorAgent.stdin.write(directive);
		cursorAgent.stdin.end();
		
		// Handle stdout data
		cursorAgent.stdout.on('data', async (data) => {
			buffer += data.toString();
			
			// Parse JSON objects from buffer
			const jsonObjects = parseJsonStream(buffer);
			
			for (const message of jsonObjects) {
				// Check for update_todos tool calls first
				const updateTodosData = isUpdateTodosToolCall(message);
				if (updateTodosData) {
					// Update the task status in the file
					const success = await updateTaskStatusInFile(
						tasksPath, 
						updateTodosData.taskId, 
						updateTodosData.status, 
						projectRoot,
						!isSilentMode() // Enable debug logging in non-silent mode
					);
					
					if (success) {
						// Update our tracking variables for display
						currentTaskId = updateTodosData.taskId;
						currentStatus = updateTodosData.status;
						
						// Display progress update
						if (!isSilentMode()) {
							displayProgress(currentTaskId, currentStatus, '');
						} else if (spinner) {
							// Update spinner in silent mode to show task progress
							spinner.update(`Processing task ${updateTodosData.taskId} (${updateTodosData.status})`);
						}
					}
					continue;
				}
				
				// Check if this is a tool call start (stop displaying text)
				if (isToolCallStart(message)) {
					if (currentText) {
						// Clear the current line
						if (!isSilentMode()) {
							process.stdout.write('\r\x1b[K');
						}
						currentText = '';
					}
					continue;
				}
				
				// Extract text content
				const textContent = extractTextContent(message);
				if (textContent) {
					currentText += textContent;
					
					// Display progress
					if (currentTaskId && currentStatus) {
						displayProgress(currentTaskId, currentStatus, currentText);
					}
					
					// Update spinner in silent mode to show activity
					if (spinner && currentText.length > 0) {
						// Show that we're receiving data from cursor-agent
						spinner.update('Processing tasks with Cursor Agent... (receiving data)');
					}
				}
			}
			
			// Clear buffer of processed data
			const lastNewlineIndex = buffer.lastIndexOf('\n');
			if (lastNewlineIndex !== -1) {
				buffer = buffer.substring(lastNewlineIndex + 1);
			}
		});
		
		// Handle stderr data
		cursorAgent.stderr.on('data', (data) => {
			const errorText = data.toString();
			if (isSilentMode()) {
				// Show error in silent mode
				if (spinner) {
					spinner.showError(`Cursor Agent Error: ${errorText}`);
				}
			} else {
				console.log(chalk.red(`Cursor Agent Error: ${errorText}`));
			}
		});
		
		// Handle process completion
		cursorAgent.on('close', (code) => {
			// Stop spinner
			if (spinner) {
				spinner.stop();
			}
			
			// Clear any remaining progress display
			if (!isSilentMode()) {
				process.stdout.write('\r\x1b[K');
			}
			
			if (code === 0) {
				if (isSilentMode()) {
					// Show success in silent mode
					if (spinner) {
						spinner.showSuccess('Cursor Agent completed successfully!');
					}
				} else {
					console.log(chalk.green('\n✅ Cursor Agent completed successfully!'));
				}
				resolve({ success: true, exitCode: code });
			} else {
				const errorMsg = `Cursor Agent exited with code ${code}`;
				if (isSilentMode()) {
					// Show error in silent mode
					if (spinner) {
						spinner.showError(errorMsg);
					}
				} else {
					console.log(chalk.red(`\n❌ ${errorMsg}`));
				}
				reject(new Error(errorMsg));
			}
		});
		
		// Handle process errors
		cursorAgent.on('error', (error) => {
			if (isSilentMode()) {
				// Show error in silent mode
				if (spinner) {
					spinner.showError(`Failed to start cursor-agent: ${error.message}`);
				}
			} else {
				if (spinner) {
					spinner.stop();
				}
			}
			reject(new Error(`Failed to start cursor-agent: ${error.message}`));
		});
		
		// Handle timeout (30 minutes)
		const timeout = setTimeout(() => {
			cursorAgent.kill();
			if (isSilentMode()) {
				// Show timeout error in silent mode
				if (spinner) {
					spinner.showError('Cursor Agent execution timed out after 30 minutes');
				}
			} else {
				if (spinner) {
					spinner.stop();
				}
			}
			reject(new Error('Cursor Agent execution timed out after 30 minutes'));
		}, 30 * 60 * 1000);
		
		// Clear timeout on completion
		cursorAgent.on('close', () => {
			clearTimeout(timeout);
		});
	});
}

export { isCursorAgentAvailable, generateDirectivePrompt, isUpdateTodosToolCall };
