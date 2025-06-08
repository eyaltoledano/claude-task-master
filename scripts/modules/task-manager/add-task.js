import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { z } from 'zod';
import Fuse from 'fuse.js'; // Import Fuse.js for advanced fuzzy search

import {
	displayBanner,
	getStatusWithColor,
	startLoadingIndicator,
	stopLoadingIndicator,
	succeedLoadingIndicator,
	failLoadingIndicator,
	displayAiUsageSummary
} from '../ui.js';
import { readJSON, writeJSON, log as consoleLog, truncate } from '../utils.js';
import { generateObjectService } from '../ai-services-unified.js';
import { getDefaultPriority } from '../config-manager.js';
import generateTaskFiles from './generate-task-files.js';

// Define Zod schema for the expected AI output object
const AiTaskDataSchema = z.object({
	title: z.string().describe('Clear, concise title for the task'),
	description: z
		.string()
		.describe('A one or two sentence description of the task'),
	details: z
		.string()
		.describe('In-depth implementation details, considerations, and guidance'),
	testStrategy: z
		.string()
		.describe('Detailed approach for verifying task completion'),
	dependencies: z
		.array(z.number())
		.optional()
		.describe(
			'Array of task IDs that this task depends on (must be completed before this task can start)'
		)
});

/**
 * Add a new task using AI
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} prompt - Description of the task to add (required for AI-driven creation)
 * @param {Array} dependencies - Task dependencies
 * @param {string} priority - Task priority
 * @param {function} reportProgress - Function to report progress to MCP server (optional)
 * @param {Object} mcpLog - MCP logger object (optional)
 * @param {Object} session - Session object from MCP server (optional)
 * @param {string} outputFormat - Output format (text or json)
 * @param {Object} customEnv - Custom environment variables (optional) - Note: AI params override deprecated
 * @param {Object} manualTaskData - Manual task data (optional, for direct task creation without AI)
 * @param {boolean} useResearch - Whether to use the research model (passed to unified service)
 * @param {Object} context - Context object containing session and potentially projectRoot
 * @param {string} [context.projectRoot] - Project root path (for MCP/env fallback)
 * @param {string} [context.commandName] - The name of the command being executed (for telemetry)
 * @param {string} [context.outputType] - The output type ('cli' or 'mcp', for telemetry)
 * @returns {Promise<object>} An object containing newTaskId and telemetryData
 */
async function addTask(
	tasksPath,
	prompt,
	dependencies = [],
	priority = null,
	context = {},
	outputFormat = 'text', // Default to text for CLI
	manualTaskData = null,
	useResearch = false
) {
	const { session, mcpLog, projectRoot, commandName, outputType } = context;
	const isMCP = !!mcpLog;

	// Create a consistent logFn object regardless of context
	const logFn = isMCP
		? mcpLog // Use MCP logger if provided
		: {
				// Create a wrapper around consoleLog for CLI
				info: (...args) => consoleLog('info', ...args),
				warn: (...args) => consoleLog('warn', ...args),
				error: (...args) => consoleLog('error', ...args),
				debug: (...args) => consoleLog('debug', ...args),
				success: (...args) => consoleLog('success', ...args)
			};

	const effectivePriority = priority || getDefaultPriority(projectRoot);

	logFn.info(
		`Adding new task with prompt: "${prompt}", Priority: ${effectivePriority}, Dependencies: ${dependencies.join(', ') || 'None'}, Research: ${useResearch}, ProjectRoot: ${projectRoot}`
	);

	let loadingIndicator = null;
	let aiServiceResponse = null; // To store the full response from AI service

	// Create custom reporter that checks for MCP log
	const report = (message, level = 'info') => {
		if (mcpLog) {
			mcpLog[level](message);
		} else if (outputFormat === 'text') {
			consoleLog(level, message);
		}
	};

	/**
	 * Recursively builds a dependency graph for a given task
	 * @param {Array} tasks - All tasks from tasks.json
	 * @param {number} taskId - ID of the task to analyze
	 * @param {Set} visited - Set of already visited task IDs
	 * @param {Map} depthMap - Map of task ID to its depth in the graph
	 * @param {number} depth - Current depth in the recursion
	 * @return {Object} Dependency graph data
	 */
	function buildDependencyGraph(
		tasks,
		taskId,
		visited = new Set(),
		depthMap = new Map(),
		depth = 0
	) {
		// Skip if we've already visited this task or it doesn't exist
		if (visited.has(taskId)) {
			return null;
		}

		// Find the task
		const task = tasks.find((t) => t.id === taskId);
		if (!task) {
			return null;
		}

		// Mark as visited
		visited.add(taskId);

		// Update depth if this is a deeper path to this task
		if (!depthMap.has(taskId) || depth < depthMap.get(taskId)) {
			depthMap.set(taskId, depth);
		}

		// Process dependencies
		const dependencyData = [];
		if (task.dependencies && task.dependencies.length > 0) {
			for (const depId of task.dependencies) {
				const depData = buildDependencyGraph(
					tasks,
					depId,
					visited,
					depthMap,
					depth + 1
				);
				if (depData) {
					dependencyData.push(depData);
				}
			}
		}

		return {
			id: task.id,
			title: task.title,
			description: task.description,
			status: task.status,
			dependencies: dependencyData
		};
	}

	try {
		// Read the existing tasks
		let data = readJSON(tasksPath);

		// If tasks.json doesn't exist or is invalid, create a new one
		if (!data || !data.tasks) {
			report('tasks.json not found or invalid. Creating a new one.', 'info');
			// Create default tasks data structure
			data = {
				tasks: []
			};
			// Ensure the directory exists and write the new file
			writeJSON(tasksPath, data);
			report('Created new tasks.json file with empty tasks array.', 'info');
		}

		// Find the highest task ID to determine the next ID
		const highestId =
			data.tasks.length > 0 ? Math.max(...data.tasks.map((t) => t.id)) : 0;
		const newTaskId = highestId + 1;

		// Only show UI box for CLI mode
		if (outputFormat === 'text') {
			console.log(
				boxen(chalk.white.bold(`Creating New Task #${newTaskId}`), {
					padding: 1,
					borderColor: 'blue',
					borderStyle: 'round',
					margin: { top: 1, bottom: 1 }
				})
			);
		}

		// Validate dependencies before proceeding
		const invalidDeps = dependencies.filter((depId) => {
			// Ensure depId is parsed as a number for comparison
			const numDepId = parseInt(depId, 10);
			return isNaN(numDepId) || !data.tasks.some((t) => t.id === numDepId);
		});

		if (invalidDeps.length > 0) {
			report(
				`The following dependencies do not exist or are invalid: ${invalidDeps.join(', ')}`,
				'warn'
			);
			report('Removing invalid dependencies...', 'info');
			dependencies = dependencies.filter(
				(depId) => !invalidDeps.includes(depId)
			);
		}
		// Ensure dependencies are numbers
		const numericDependencies = dependencies.map((dep) => parseInt(dep, 10));

		// Build dependency graphs for explicitly specified dependencies
		const dependencyGraphs = [];
		const allRelatedTaskIds = new Set();
		const depthMap = new Map();

		// First pass: build a complete dependency graph for each specified dependency
		for (const depId of numericDependencies) {
			const graph = buildDependencyGraph(
				data.tasks,
				depId,
				new Set(),
				depthMap
			);
			if (graph) {
				dependencyGraphs.push(graph);
			}
		}

		// Second pass: build a set of all related task IDs for flat analysis
		for (const [taskId, depth] of depthMap.entries()) {
			allRelatedTaskIds.add(taskId);
		}

		let taskData;

		// Check if manual task data is provided
		if (manualTaskData) {
			report('Using manually provided task data', 'info');
			taskData = manualTaskData;
			report('DEBUG: Taking MANUAL task data path.', 'debug');

			// Basic validation for manual data
			if (
				!taskData.title ||
				typeof taskData.title !== 'string' ||
				!taskData.description ||
				typeof taskData.description !== 'string'
			) {
				throw new Error(
					'Manual task data must include at least a title and description.'
				);
			}
		} else {
			report('DEBUG: Taking AI task generation path.', 'debug');
			// --- Refactored AI Interaction ---
			report(`Generating task data with AI with prompt:\n${prompt}`, 'info');

			// Create context string for task creation prompt
			let contextTasks = '';

			// Create a dependency map for better understanding of the task relationships
			const taskMap = {};
			data.tasks.forEach((t) => {
				// For each task, only include id, title, description, and dependencies
				taskMap[t.id] = {
					id: t.id,
					title: t.title,
					description: t.description,
					dependencies: t.dependencies || [],
					status: t.status
				};
			});

			// CLI-only feedback for the dependency analysis
			if (outputFormat === 'text') {
				console.log(
					boxen(chalk.cyan.bold('Task Context Analysis'), {
						padding: { top: 0, bottom: 0, left: 1, right: 1 },
						margin: { top: 0, bottom: 0 },
						borderColor: 'cyan',
						borderStyle: 'round'
					})
				);
			}

			// Initialize variables that will be used in either branch
			let uniqueDetailedTasks = [];
			let dependentTasks = [];
			let promptCategory = null;

			if (numericDependencies.length > 0) {
				// If specific dependencies were provided, focus on them
				// Get all tasks that were found in the dependency graph
				dependentTasks = Array.from(allRelatedTaskIds)
					.map((id) => data.tasks.find((t) => t.id === id))
					.filter(Boolean);

				// Sort by depth in the dependency chain
				dependentTasks.sort((a, b) => {
					const depthA = depthMap.get(a.id) || 0;
					const depthB = depthMap.get(b.id) || 0;
					return depthA - depthB; // Lowest depth (root dependencies) first
				});

				// Limit the number of detailed tasks to avoid context explosion
				uniqueDetailedTasks = dependentTasks.slice(0, 8);

				contextTasks = `\nThis task relates to a dependency structure with ${dependentTasks.length} related tasks in the chain.\n\nDirect dependencies:`;
				const directDeps = data.tasks.filter((t) =>
					numericDependencies.includes(t.id)
				);
				contextTasks += `\n${directDeps.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`).join('\n')}`;

				// Add an overview of indirect dependencies if present
				const indirectDeps = dependentTasks.filter(
					(t) => !numericDependencies.includes(t.id)
				);
				if (indirectDeps.length > 0) {
					contextTasks += `\n\nIndirect dependencies (dependencies of dependencies):`;
					contextTasks += `\n${indirectDeps
						.slice(0, 5)
						.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
						.join('\n')}`;
					if (indirectDeps.length > 5) {
						contextTasks += `\n- ... and ${indirectDeps.length - 5} more indirect dependencies`;
					}
				}

				// Add more details about each dependency, prioritizing direct dependencies
				contextTasks += `\n\nDetailed information about dependencies:`;
				for (const depTask of uniqueDetailedTasks) {
					const depthInfo = depthMap.get(depTask.id)
						? ` (depth: ${depthMap.get(depTask.id)})`
						: '';
					const isDirect = numericDependencies.includes(depTask.id)
						? ' [DIRECT DEPENDENCY]'
						: '';

					contextTasks += `\n\n------ Task ${depTask.id}${isDirect}${depthInfo}: ${depTask.title} ------\n`;
					contextTasks += `Description: ${depTask.description}\n`;
					contextTasks += `Status: ${depTask.status || 'pending'}\n`;
					contextTasks += `Priority: ${depTask.priority || 'medium'}\n`;

					// List its dependencies
					if (depTask.dependencies && depTask.dependencies.length > 0) {
						const depDeps = depTask.dependencies.map((dId) => {
							const depDepTask = data.tasks.find((t) => t.id === dId);
							return depDepTask
								? `Task ${dId}: ${depDepTask.title}`
								: `Task ${dId}`;
						});
						contextTasks += `Dependencies: ${depDeps.join(', ')}\n`;
					} else {
						contextTasks += `Dependencies: None\n`;
					}

					// Add implementation details but truncate if too long
					if (depTask.details) {
						const truncatedDetails =
							depTask.details.length > 400
								? depTask.details.substring(0, 400) + '... (truncated)'
								: depTask.details;
						contextTasks += `Implementation Details: ${truncatedDetails}\n`;
					}
				}

				// Add dependency chain visualization
				if (dependencyGraphs.length > 0) {
					contextTasks += '\n\nDependency Chain Visualization:';

					// Helper function to format dependency chain as text
					function formatDependencyChain(
						node,
						prefix = '',
						isLast = true,
						depth = 0
					) {
						if (depth > 3) return ''; // Limit depth to avoid excessive nesting

						const connector = isLast ? '└── ' : '├── ';
						const childPrefix = isLast ? '    ' : '│   ';

						let result = `\n${prefix}${connector}Task ${node.id}: ${node.title}`;

						if (node.dependencies && node.dependencies.length > 0) {
							for (let i = 0; i < node.dependencies.length; i++) {
								const isLastChild = i === node.dependencies.length - 1;
								result += formatDependencyChain(
									node.dependencies[i],
									prefix + childPrefix,
									isLastChild,
									depth + 1
								);
							}
						}

						return result;
					}

					// Format each dependency graph
					for (const graph of dependencyGraphs) {
						contextTasks += formatDependencyChain(graph);
					}
				}

				// Show dependency analysis in CLI mode
				if (outputFormat === 'text') {
					if (directDeps.length > 0) {
						console.log(chalk.gray(`  Explicitly specified dependencies:`));
						directDeps.forEach((t) => {
							console.log(
								chalk.yellow(`  • Task ${t.id}: ${truncate(t.title, 50)}`)
							);
						});
					}

					if (indirectDeps.length > 0) {
						console.log(
							chalk.gray(
								`\n  Indirect dependencies (${indirectDeps.length} total):`
							)
						);
						indirectDeps.slice(0, 3).forEach((t) => {
							const depth = depthMap.get(t.id) || 0;
							console.log(
								chalk.cyan(
									`  • Task ${t.id} [depth ${depth}]: ${truncate(t.title, 45)}`
								)
							);
						});
						if (indirectDeps.length > 3) {
							console.log(
								chalk.cyan(
									`  • ... and ${indirectDeps.length - 3} more indirect dependencies`
								)
							);
						}
					}

					// Visualize the dependency chain
					if (dependencyGraphs.length > 0) {
						console.log(chalk.gray(`\n  Dependency chain visualization:`));

						// Convert dependency graph to ASCII art for terminal
						function visualizeDependencyGraph(
							node,
							prefix = '',
							isLast = true,
							depth = 0
						) {
							if (depth > 2) return; // Limit depth for display

							const connector = isLast ? '└── ' : '├── ';
							const childPrefix = isLast ? '    ' : '│   ';

							console.log(
								chalk.blue(
									`  ${prefix}${connector}Task ${node.id}: ${truncate(node.title, 40)}`
								)
							);

							if (node.dependencies && node.dependencies.length > 0) {
								for (let i = 0; i < node.dependencies.length; i++) {
									const isLastChild = i === node.dependencies.length - 1;
									visualizeDependencyGraph(
										node.dependencies[i],
										prefix + childPrefix,
										isLastChild,
										depth + 1
									);
								}
							}
						}

						// Visualize each dependency graph
						for (const graph of dependencyGraphs) {
							visualizeDependencyGraph(graph);
						}
					}

					console.log(); // Add spacing
				}
			} else {
				// If no dependencies provided, use Fuse.js to find semantically related tasks
				// Create fuzzy search index for all tasks
				const searchOptions = {
					includeScore: true, // Return match scores
					threshold: 0.4, // Lower threshold = stricter matching (range 0-1)
					keys: [
						{ name: 'title', weight: 1.5 }, // Title is most important
						{ name: 'description', weight: 2 }, // Description is very important
						{ name: 'details', weight: 3 }, // Details is most important
						// Search dependencies to find tasks that depend on similar things
						{ name: 'dependencyTitles', weight: 0.5 }
					],
					// Sort matches by score (lower is better)
					shouldSort: true,
					// Allow searching in nested properties
					useExtendedSearch: true,
					// Return up to 50 matches
					limit: 50
				};

				// Prepare task data with dependencies expanded as titles for better semantic search
				const searchableTasks = data.tasks.map((task) => {
					// Get titles of this task's dependencies if they exist
					const dependencyTitles =
						task.dependencies?.length > 0
							? task.dependencies
									.map((depId) => {
										const depTask = data.tasks.find((t) => t.id === depId);
										return depTask ? depTask.title : '';
									})
									.filter((title) => title)
									.join(' ')
							: '';

					return {
						...task,
						dependencyTitles
					};
				});

				// Create search index using Fuse.js
				const fuse = new Fuse(searchableTasks, searchOptions);

				// Extract significant words and phrases from the prompt
				const promptWords = prompt
					.toLowerCase()
					.replace(/[^\w\s-]/g, ' ') // Replace non-alphanumeric chars with spaces
					.split(/\s+/)
					.filter((word) => word.length > 3); // Words at least 4 chars

				// Use the user's prompt for fuzzy search
				const fuzzyResults = fuse.search(prompt);

				// Also search for each significant word to catch different aspects
				let wordResults = [];
				for (const word of promptWords) {
					if (word.length > 5) {
						// Only use significant words
						const results = fuse.search(word);
						if (results.length > 0) {
							wordResults.push(...results);
						}
					}
				}

				// Merge and deduplicate results
				const mergedResults = [...fuzzyResults];

				// Add word results that aren't already in fuzzyResults
				for (const wordResult of wordResults) {
					if (!mergedResults.some((r) => r.item.id === wordResult.item.id)) {
						mergedResults.push(wordResult);
					}
				}

				// Group search results by relevance
				const highRelevance = mergedResults
					.filter((result) => result.score < 0.25)
					.map((result) => result.item);

				const mediumRelevance = mergedResults
					.filter((result) => result.score >= 0.25 && result.score < 0.4)
					.map((result) => result.item);

				// Get recent tasks (newest first)
				const recentTasks = [...data.tasks]
					.sort((a, b) => b.id - a.id)
					.slice(0, 5);

				// Combine high relevance, medium relevance, and recent tasks
				// Prioritize high relevance first
				const allRelevantTasks = [...highRelevance];

				// Add medium relevance if not already included
				for (const task of mediumRelevance) {
					if (!allRelevantTasks.some((t) => t.id === task.id)) {
						allRelevantTasks.push(task);
					}
				}

				// Add recent tasks if not already included
				for (const task of recentTasks) {
					if (!allRelevantTasks.some((t) => t.id === task.id)) {
						allRelevantTasks.push(task);
					}
				}

				// Get top N results for context
				const relatedTasks = allRelevantTasks.slice(0, 8);

				// Format basic task overviews
				if (relatedTasks.length > 0) {
					contextTasks = `\nRelevant tasks identified by semantic similarity:\n${relatedTasks
						.map((t, i) => {
							const relevanceMarker = i < highRelevance.length ? '⭐ ' : '';
							return `- ${relevanceMarker}Task ${t.id}: ${t.title} - ${t.description}`;
						})
						.join('\n')}`;
				}

				if (
					recentTasks.length > 0 &&
					!contextTasks.includes('Recently created tasks')
				) {
					contextTasks += `\n\nRecently created tasks:\n${recentTasks
						.filter((t) => !relatedTasks.some((rt) => rt.id === t.id))
						.slice(0, 3)
						.map((t) => `- Task ${t.id}: ${t.title} - ${t.description}`)
						.join('\n')}`;
				}

				// Add detailed information about the most relevant tasks
				const allDetailedTasks = [...relatedTasks.slice(0, 25)];
				uniqueDetailedTasks = Array.from(
					new Map(allDetailedTasks.map((t) => [t.id, t])).values()
				).slice(0, 20);

				if (uniqueDetailedTasks.length > 0) {
					contextTasks += `\n\nDetailed information about relevant tasks:`;
					for (const task of uniqueDetailedTasks) {
						contextTasks += `\n\n------ Task ${task.id}: ${task.title} ------\n`;
						contextTasks += `Description: ${task.description}\n`;
						contextTasks += `Status: ${task.status || 'pending'}\n`;
						contextTasks += `Priority: ${task.priority || 'medium'}\n`;
						if (task.dependencies && task.dependencies.length > 0) {
							// Format dependency list with titles
							const depList = task.dependencies.map((depId) => {
								const depTask = data.tasks.find((t) => t.id === depId);
								return depTask
									? `Task ${depId} (${depTask.title})`
									: `Task ${depId}`;
							});
							contextTasks += `Dependencies: ${depList.join(', ')}\n`;
						}
						// Add implementation details but truncate if too long
						if (task.details) {
							const truncatedDetails =
								task.details.length > 400
									? task.details.substring(0, 400) + '... (truncated)'
									: task.details;
							contextTasks += `Implementation Details: ${truncatedDetails}\n`;
						}
					}
				}

				// Add a concise view of the task dependency structure
				contextTasks += '\n\nSummary of task dependencies in the project:';

				// Get pending/in-progress tasks that might be most relevant based on fuzzy search
				// Prioritize tasks from our similarity search
				const relevantTaskIds = new Set(uniqueDetailedTasks.map((t) => t.id));
				const relevantPendingTasks = data.tasks
					.filter(
						(t) =>
							(t.status === 'pending' || t.status === 'in-progress') &&
							// Either in our relevant set OR has relevant words in title/description
							(relevantTaskIds.has(t.id) ||
								promptWords.some(
									(word) =>
										t.title.toLowerCase().includes(word) ||
										t.description.toLowerCase().includes(word)
								))
					)
					.slice(0, 10);

				for (const task of relevantPendingTasks) {
					const depsStr =
						task.dependencies && task.dependencies.length > 0
							? task.dependencies.join(', ')
							: 'None';
					contextTasks += `\n- Task ${task.id}: depends on [${depsStr}]`;
				}

				// Additional analysis of common patterns
				const similarPurposeTasks = data.tasks.filter((t) =>
					prompt.toLowerCase().includes(t.title.toLowerCase())
				);

				let commonDeps = []; // Initialize commonDeps

				if (similarPurposeTasks.length > 0) {
					contextTasks += `\n\nCommon patterns for similar tasks:`;

					// Collect dependencies from similar purpose tasks
					const similarDeps = similarPurposeTasks
						.filter((t) => t.dependencies && t.dependencies.length > 0)
						.map((t) => t.dependencies)
						.flat();

					// Count frequency of each dependency
					const depCounts = {};
					similarDeps.forEach((dep) => {
						depCounts[dep] = (depCounts[dep] || 0) + 1;
					});

					// Get most common dependencies for similar tasks
					commonDeps = Object.entries(depCounts)
						.sort((a, b) => b[1] - a[1])
						.slice(0, 10);

					if (commonDeps.length > 0) {
						contextTasks += '\nMost common dependencies for similar tasks:';
						commonDeps.forEach(([depId, count]) => {
							const depTask = data.tasks.find((t) => t.id === parseInt(depId));
							if (depTask) {
								contextTasks += `\n- Task ${depId} (used by ${count} similar tasks): ${depTask.title}`;
							}
						});
					}
				}

				// Show fuzzy search analysis in CLI mode
				if (outputFormat === 'text') {
					console.log(
						chalk.gray(
							`  Context search across ${data.tasks.length} tasks using full prompt and ${promptWords.length} keywords`
						)
					);

					if (highRelevance.length > 0) {
						console.log(
							chalk.gray(`\n  High relevance matches (score < 0.25):`)
						);
						highRelevance.slice(0, 25).forEach((t) => {
							console.log(
								chalk.yellow(`  • ⭐ Task ${t.id}: ${truncate(t.title, 50)}`)
							);
						});
					}

					if (mediumRelevance.length > 0) {
						console.log(
							chalk.gray(`\n  Medium relevance matches (score < 0.4):`)
						);
						mediumRelevance.slice(0, 10).forEach((t) => {
							console.log(
								chalk.green(`  • Task ${t.id}: ${truncate(t.title, 50)}`)
							);
						});
					}

					// Show dependency patterns
					if (commonDeps && commonDeps.length > 0) {
						console.log(
							chalk.gray(`\n  Common dependency patterns for similar tasks:`)
						);
						commonDeps.slice(0, 3).forEach(([depId, count]) => {
							const depTask = data.tasks.find((t) => t.id === parseInt(depId));
							if (depTask) {
								console.log(
									chalk.blue(
										`  • Task ${depId} (${count}x): ${truncate(depTask.title, 45)}`
									)
								);
							}
						});
					}

					// Add information about which tasks will be provided in detail
					if (uniqueDetailedTasks.length > 0) {
						console.log(
							chalk.gray(
								`\n  Providing detailed context for ${uniqueDetailedTasks.length} most relevant tasks:`
							)
						);
						uniqueDetailedTasks.forEach((t) => {
							const isHighRelevance = highRelevance.some(
								(ht) => ht.id === t.id
							);
							const relevanceIndicator = isHighRelevance ? '⭐ ' : '';
							console.log(
								chalk.cyan(
									`  • ${relevanceIndicator}Task ${t.id}: ${truncate(t.title, 40)}`
								)
							);
						});
					}

					console.log(); // Add spacing
				}
			}

			// DETERMINE THE ACTUAL COUNT OF DETAILED TASKS BEING USED FOR AI CONTEXT
			let actualDetailedTasksCount = 0;
			if (numericDependencies.length > 0) {
				// In explicit dependency mode, we used 'uniqueDetailedTasks' derived from 'dependentTasks'
				// Ensure 'uniqueDetailedTasks' from THAT scope is used or re-evaluate.
				// For simplicity, let's assume 'dependentTasks' reflects the detailed tasks.
				actualDetailedTasksCount = dependentTasks.length;
			} else {
				// In fuzzy search mode, 'uniqueDetailedTasks' from THIS scope is correct.
				actualDetailedTasksCount = uniqueDetailedTasks
					? uniqueDetailedTasks.length
					: 0;
			}

			// Add a visual transition to show we're moving to AI generation - only for CLI
			if (outputFormat === 'text') {
				console.log(
					boxen(
						chalk.white.bold('AI Task Generation') +
							`\n\n${chalk.gray('Analyzing context and generating task details using AI...')}` +
							`\n${chalk.cyan('Context size: ')}${chalk.yellow(contextTasks.length.toLocaleString())} characters` +
							`\n${chalk.cyan('Dependency detection: ')}${chalk.yellow(numericDependencies.length > 0 ? 'Explicit dependencies' : 'Auto-discovery mode')}` +
							`\n${chalk.cyan('Detailed tasks: ')}${chalk.yellow(
								numericDependencies.length > 0
									? dependentTasks.length // Use length of tasks from explicit dependency path
									: uniqueDetailedTasks.length // Use length of tasks from fuzzy search path
							)}`,
						{
							padding: { top: 0, bottom: 1, left: 1, right: 1 },
							margin: { top: 1, bottom: 0 },
							borderColor: 'white',
							borderStyle: 'round'
						}
					)
				);
				console.log(); // Add spacing
			}

			// System Prompt - Enhanced for dependency awareness
			const systemPrompt =
				"You are a helpful assistant that creates well-structured tasks for a software development project. Generate a single new task based on the user's description, adhering strictly to the provided JSON schema. Pay special attention to dependencies between tasks, ensuring the new task correctly references any tasks it depends on.\n\n" +
				'When determining dependencies for a new task, follow these principles:\n' +
				'1. Select dependencies based on logical requirements - what must be completed before this task can begin.\n' +
				'2. Prioritize task dependencies that are semantically related to the functionality being built.\n' +
				'3. Consider both direct dependencies (immediately prerequisite) and indirect dependencies.\n' +
				'4. Avoid adding unnecessary dependencies - only include tasks that are genuinely prerequisite.\n' +
				'5. Consider the current status of tasks - prefer completed tasks as dependencies when possible.\n' +
				"6. Pay special attention to foundation tasks (1-5) but don't automatically include them without reason.\n" +
				'7. Recent tasks (higher ID numbers) may be more relevant for newer functionality.\n\n' +
				'The dependencies array should contain task IDs (numbers) of prerequisite tasks.\n';

			// Task Structure Description (for user prompt)
			const taskStructureDesc = `
      {
        "title": "Task title goes here",
        "description": "A concise one or two sentence description of what the task involves",
    "details": "Detailed implementation steps, considerations, code examples, or technical approach",
    "testStrategy": "Specific steps to verify correct implementation and functionality",
    "dependencies": [1, 3] // Example: IDs of tasks that must be completed before this task
  }
`;

			// Add any manually provided details to the prompt for context
			let contextFromArgs = '';
			if (manualTaskData?.title)
				contextFromArgs += `\n- Suggested Title: "${manualTaskData.title}"`;
			if (manualTaskData?.description)
				contextFromArgs += `\n- Suggested Description: "${manualTaskData.description}"`;
			if (manualTaskData?.details)
				contextFromArgs += `\n- Additional Details Context: "${manualTaskData.details}"`;
			if (manualTaskData?.testStrategy)
				contextFromArgs += `\n- Additional Test Strategy Context: "${manualTaskData.testStrategy}"`;

			// User Prompt
			const userPrompt = `You are generating the details for Task #${newTaskId}. Based on the user's request: "${prompt}", create a comprehensive new task for a software development project.
      
      ${contextTasks}
      ${contextFromArgs ? `\nConsider these additional details provided by the user:${contextFromArgs}` : ''}
      
      Based on the information about existing tasks provided above, include appropriate dependencies in the "dependencies" array. Only include task IDs that this new task directly depends on.
      
      Return your answer as a single JSON object matching the schema precisely:
      ${taskStructureDesc}
      
      Make sure the details and test strategy are comprehensive and specific. DO NOT include the task ID in the title.
      `;

			// Start the loading indicator - only for text mode
			if (outputFormat === 'text') {
				loadingIndicator = startLoadingIndicator(
					`Generating new task with ${useResearch ? 'Research' : 'Main'} AI... \n`
				);
			}

			try {
				const serviceRole = useResearch ? 'research' : 'main';
				report('DEBUG: Calling generateObjectService...', 'debug');

				aiServiceResponse = await generateObjectService({
					// Capture the full response
					role: serviceRole,
					session: session,
					projectRoot: projectRoot,
					schema: AiTaskDataSchema,
					objectName: 'newTaskData',
					systemPrompt: systemPrompt,
					prompt: userPrompt,
					commandName: commandName || 'add-task', // Use passed commandName or default
					outputType: outputType || (isMCP ? 'mcp' : 'cli') // Use passed outputType or derive
				});
				report('DEBUG: generateObjectService returned successfully.', 'debug');

				if (!aiServiceResponse || !aiServiceResponse.mainResult) {
					throw new Error(
						'AI service did not return the expected object structure.'
					);
				}

				// Prefer mainResult if it looks like a valid task object, otherwise try mainResult.object
				if (
					aiServiceResponse.mainResult.title &&
					aiServiceResponse.mainResult.description
				) {
					taskData = aiServiceResponse.mainResult;
				} else if (
					aiServiceResponse.mainResult.object &&
					aiServiceResponse.mainResult.object.title &&
					aiServiceResponse.mainResult.object.description
				) {
					taskData = aiServiceResponse.mainResult.object;
				} else {
					throw new Error('AI service did not return a valid task object.');
				}

				report('Successfully generated task data from AI.', 'success');

				// Success! Show checkmark
				if (loadingIndicator) {
					succeedLoadingIndicator(
						loadingIndicator,
						'Task generated successfully'
					);
					loadingIndicator = null; // Clear it
				}
			} catch (error) {
				// Failure! Show X
				if (loadingIndicator) {
					failLoadingIndicator(loadingIndicator, 'AI generation failed');
					loadingIndicator = null;
				}
				report(
					`DEBUG: generateObjectService caught error: ${error.message}`,
					'debug'
				);
				report(`Error generating task with AI: ${error.message}`, 'error');
				throw error; // Re-throw error after logging
			} finally {
				report('DEBUG: generateObjectService finally block reached.', 'debug');
				// Clean up if somehow still running
				if (loadingIndicator) {
					stopLoadingIndicator(loadingIndicator);
				}
			}
			// --- End Refactored AI Interaction ---
		}

		// Create the new task object
		const newTask = {
			id: newTaskId,
			title: taskData.title,
			description: taskData.description,
			details: taskData.details || '',
			testStrategy: taskData.testStrategy || '',
			status: 'pending',
			dependencies: taskData.dependencies?.length
				? taskData.dependencies
				: numericDependencies, // Use AI-suggested dependencies if available, fallback to manually specified
			priority: effectivePriority,
			subtasks: [] // Initialize with empty subtasks array
		};

		// Additional check: validate all dependencies in the AI response
		if (taskData.dependencies?.length) {
			const allValidDeps = taskData.dependencies.every((depId) => {
				const numDepId = parseInt(depId, 10);
				return !isNaN(numDepId) && data.tasks.some((t) => t.id === numDepId);
			});

			if (!allValidDeps) {
				report(
					'AI suggested invalid dependencies. Filtering them out...',
					'warn'
				);
				newTask.dependencies = taskData.dependencies.filter((depId) => {
					const numDepId = parseInt(depId, 10);
					return !isNaN(numDepId) && data.tasks.some((t) => t.id === numDepId);
				});
			}
		}

		// Add the task to the tasks array
		data.tasks.push(newTask);

		report('DEBUG: Writing tasks.json...', 'debug');
		// Write the updated tasks to the file
		writeJSON(tasksPath, data);
		report('DEBUG: tasks.json written.', 'debug');

		// Generate markdown task files
		report('Generating task files...', 'info');
		report('DEBUG: Calling generateTaskFiles...', 'debug');
		// Pass mcpLog if available to generateTaskFiles
		await generateTaskFiles(tasksPath, path.dirname(tasksPath), { mcpLog });
		report('DEBUG: generateTaskFiles finished.', 'debug');

		// Show success message - only for text output (CLI)
		if (outputFormat === 'text') {
			const table = new Table({
				head: [
					chalk.cyan.bold('ID'),
					chalk.cyan.bold('Title'),
					chalk.cyan.bold('Description')
				],
				colWidths: [5, 30, 50] // Adjust widths as needed
			});

			table.push([
				newTask.id,
				truncate(newTask.title, 27),
				truncate(newTask.description, 47)
			]);

			console.log(chalk.green('✓ New task created successfully:'));
			console.log(table.toString());

			// Helper to get priority color
			const getPriorityColor = (p) => {
				switch (p?.toLowerCase()) {
					case 'high':
						return 'red';
					case 'low':
						return 'gray';
					case 'medium':
					default:
						return 'yellow';
				}
			};

			// Check if AI added new dependencies that weren't explicitly provided
			const aiAddedDeps = newTask.dependencies.filter(
				(dep) => !numericDependencies.includes(dep)
			);

			// Check if AI removed any dependencies that were explicitly provided
			const aiRemovedDeps = numericDependencies.filter(
				(dep) => !newTask.dependencies.includes(dep)
			);

			// Get task titles for dependencies to display
			const depTitles = {};
			newTask.dependencies.forEach((dep) => {
				const depTask = data.tasks.find((t) => t.id === dep);
				if (depTask) {
					depTitles[dep] = truncate(depTask.title, 30);
				}
			});

			// Prepare dependency display string
			let dependencyDisplay = '';
			if (newTask.dependencies.length > 0) {
				dependencyDisplay = chalk.white('Dependencies:') + '\n';
				newTask.dependencies.forEach((dep) => {
					const isAiAdded = aiAddedDeps.includes(dep);
					const depType = isAiAdded ? chalk.yellow(' (AI suggested)') : '';
					dependencyDisplay +=
						chalk.white(
							`  - ${dep}: ${depTitles[dep] || 'Unknown task'}${depType}`
						) + '\n';
				});
			} else {
				dependencyDisplay = chalk.white('Dependencies: None') + '\n';
			}

			// Add info about removed dependencies if any
			if (aiRemovedDeps.length > 0) {
				dependencyDisplay +=
					chalk.gray('\nUser-specified dependencies that were not used:') +
					'\n';
				aiRemovedDeps.forEach((dep) => {
					const depTask = data.tasks.find((t) => t.id === dep);
					const title = depTask ? truncate(depTask.title, 30) : 'Unknown task';
					dependencyDisplay += chalk.gray(`  - ${dep}: ${title}`) + '\n';
				});
			}

			// Add dependency analysis summary
			let dependencyAnalysis = '';
			if (aiAddedDeps.length > 0 || aiRemovedDeps.length > 0) {
				dependencyAnalysis =
					'\n' + chalk.white.bold('Dependency Analysis:') + '\n';
				if (aiAddedDeps.length > 0) {
					dependencyAnalysis +=
						chalk.green(
							`AI identified ${aiAddedDeps.length} additional dependencies`
						) + '\n';
				}
				if (aiRemovedDeps.length > 0) {
					dependencyAnalysis +=
						chalk.yellow(
							`AI excluded ${aiRemovedDeps.length} user-provided dependencies`
						) + '\n';
				}
			}

			// Show success message box
			console.log(
				boxen(
					chalk.white.bold(`Task ${newTaskId} Created Successfully`) +
						'\n\n' +
						chalk.white(`Title: ${newTask.title}`) +
						'\n' +
						chalk.white(`Status: ${getStatusWithColor(newTask.status)}`) +
						'\n' +
						chalk.white(
							`Priority: ${chalk[getPriorityColor(newTask.priority)](newTask.priority)}`
						) +
						'\n\n' +
						dependencyDisplay +
						dependencyAnalysis +
						'\n' +
						chalk.white.bold('Next Steps:') +
						'\n' +
						chalk.cyan(
							`1. Run ${chalk.yellow(`task-master show ${newTaskId}`)} to see complete task details`
						) +
						'\n' +
						chalk.cyan(
							`2. Run ${chalk.yellow(`task-master set-status --id=${newTaskId} --status=in-progress`)} to start working on it`
						) +
						'\n' +
						chalk.cyan(
							`3. Run ${chalk.yellow(`task-master expand --id=${newTaskId}`)} to break it down into subtasks`
						),
					{ padding: 1, borderColor: 'green', borderStyle: 'round' }
				)
			);

			// Display AI Usage Summary if telemetryData is available
			if (
				aiServiceResponse &&
				aiServiceResponse.telemetryData &&
				(outputType === 'cli' || outputType === 'text')
			) {
				displayAiUsageSummary(aiServiceResponse.telemetryData, 'cli');
			}
		}

		report(
			`DEBUG: Returning new task ID: ${newTaskId} and telemetry.`,
			'debug'
		);
		return {
			newTaskId: newTaskId,
			telemetryData: aiServiceResponse ? aiServiceResponse.telemetryData : null
		};
	} catch (error) {
		// Stop any loading indicator on error
		if (loadingIndicator) {
			stopLoadingIndicator(loadingIndicator);
		}

		report(`Error adding task: ${error.message}`, 'error');
		if (outputFormat === 'text') {
			console.error(chalk.red(`Error: ${error.message}`));
		}
		// In MCP mode, we let the direct function handler catch and format
		throw error;
	}
}

export default addTask;
