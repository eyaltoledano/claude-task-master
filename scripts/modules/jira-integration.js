/**
 * jira-integration.js
 * Enhanced Jira integration service with reference ID support
 */

import { log } from './utils.js';
import { getConfig, getJiraProjectKey } from './config-manager.js';
import {
	extractRefIdFromTitle,
	formatTitleForJira,
	getRefId
} from './reference-id-service.js';
import { getJiraIntegrationEnabled } from './config-manager.js';
import { findTaskById } from './utils.js';

// API version to use
const JIRA_API_VERSION = '2';

/**
 * Check if Jira integration is configured
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {boolean} True if Jira is configured, false otherwise
 */
function isJiraConfigured(explicitRoot = null) {
	const jiraProjectKey = getJiraProjectKey(explicitRoot);
	const config = getConfig(explicitRoot);
	const jiraBaseUrl = config?.global?.jiraBaseUrl;
	const jiraEmail = config?.global?.jiraEmail;
	const jiraApiToken = config?.global?.jiraApiToken;

	return !!jiraProjectKey && !!jiraBaseUrl && !!jiraEmail && !!jiraApiToken;
}

/**
 * Validate Jira configuration and log warnings if invalid
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Object|null} Jira configuration object or null if invalid
 */
function validateJiraConfig(explicitRoot = null) {
	if (!isJiraConfigured(explicitRoot)) {
		log('warn', 'Jira is not configured. Skipping Jira operation.');
		return null;
	}

	const config = getJiraConfig(explicitRoot);
	const { projectKey, baseUrl, email, apiToken } = config;

	if (
		!baseUrl ||
		baseUrl.includes('{{') ||
		!email ||
		email.includes('{{') ||
		!apiToken ||
		apiToken.includes('{{')
	) {
		log(
			'warn',
			'Jira configuration contains placeholder values. Please update your .taskmasterconfig file.'
		);
		return null;
	}

	return config;
}

/**
 * Get Jira configuration
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Object} Jira configuration object
 */
function getJiraConfig(explicitRoot = null) {
	const config = getConfig(explicitRoot);
	const projectKey = getJiraProjectKey(explicitRoot);
	const baseUrl = config?.global?.jiraBaseUrl;
	const email = config?.global?.jiraEmail;
	const apiToken = config?.global?.jiraApiToken;

	return { projectKey, baseUrl, email, apiToken };
}

/**
 * Create Atlassian Document Format (ADF) description
 * @param {string} description - Main description text
 * @param {string} details - Additional details text
 * @returns {Object} ADF formatted description
 */
function createADFDescription(description, details) {
	const adf = {
		version: 1,
		type: 'doc',
		content: [
			{
				type: 'paragraph',
				content: [
					{
						type: 'text',
						text: description || ''
					}
				]
			}
		]
	};

	// Add details as a separate paragraph if available
	if (details && details.trim()) {
		adf.content.push({
			type: 'paragraph',
			content: [
				{
					type: 'text',
					text: ''
				}
			]
		});
		adf.content.push({
			type: 'paragraph',
			content: [
				{
					type: 'text',
					text: details
				}
			]
		});
	}

	return adf;
}

/**
 * Create a user story in Jira
 * @param {Object} taskData - Task data
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<Object>} Created issue data
 */
async function createUserStory(taskData, explicitRoot = null) {
	// Validate configuration
	const config = validateJiraConfig(explicitRoot);
	if (!config) return null;

	const { projectKey, baseUrl, email, apiToken } = config;

	try {
		// For API version 2, use plain text description instead of ADF
		// Combine description and details with a separator if both exist
		const description = taskData.details
			? `${taskData.description}

${taskData.details}`
			: taskData.description;

		// Format title with reference ID for Jira if available
		const summary = formatTitleForJira(taskData);

		const response = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/issue`,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					fields: {
						project: {
							key: projectKey
						},
						summary: summary,
						description: description,
						issuetype: {
							name: 'Story'
						}
						// Priority is removed as it's causing API errors
						// Some Jira instances don't allow setting priority via API
					}
				})
			}
		);

		if (!response.ok) {
			const errorData = await response.json();
			log(
				'error',
				`Error creating Jira user story: ${JSON.stringify(errorData)}`
			);
			return null;
		}

		const data = await response.json();
		log('success', `Created Jira user story: ${data.key}`);
		return data;
	} catch (error) {
		log('error', `Error creating Jira user story: ${error.message}`);
		return null;
	}
}

/**
 * Create a subtask in Jira
 * @param {Object} subtaskData - Subtask data
 * @param {string} parentKey - Parent issue key in Jira
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<Object>} Created issue data
 */
async function createSubtask(subtaskData, parentKey, explicitRoot = null) {
	// Validate inputs and configuration
	const config = validateJiraConfig(explicitRoot);
	if (!config) return null;

	if (!parentKey || typeof parentKey !== 'string' || !parentKey.includes('-')) {
		log('warn', `Invalid parent Jira issue key format: ${parentKey}`);
		return null;
	}

	const { projectKey, baseUrl, email, apiToken } = config;

	// Check if parent issue exists before creating the subtask
	const parentExists = await issueExists(parentKey, explicitRoot);
	if (!parentExists) {
		log(
			'error',
			`Parent issue ${parentKey} does not exist in Jira. Cannot create subtask.`
		);
		return null;
	}

	try {
		// For API version 2, use plain text description instead of ADF
		// Combine description and details with a separator if both exist
		const description = subtaskData.details
			? `${subtaskData.description}

${subtaskData.details}`
			: subtaskData.description;

		// Format title with reference ID for Jira if available
		const summary = formatTitleForJira(subtaskData);

		// Try with different subtask type names that are commonly used across Jira instances
		const subtaskTypeNames = ['Subtask', 'Sub-task', 'Sub task'];
		let response = null;
		let errorData = null;
		let success = false;

		// Try each issue type name until one works
		for (const typeName of subtaskTypeNames) {
			try {
				response = await fetch(
					`${baseUrl}/rest/api/${JIRA_API_VERSION}/issue`,
					{
						method: 'POST',
						headers: {
							Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
							Accept: 'application/json',
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							fields: {
								project: {
									key: projectKey
								},
								parent: {
									key: parentKey
								},
								summary: summary,
								description: description,
								issuetype: {
									name: typeName
								}
								// Priority is removed as it's causing API errors
								// Some Jira instances don't allow setting priority via API
							}
						})
					}
				);

				if (response.ok) {
					success = true;
					log(
						'info',
						`Subtask created successfully using issue type name: ${typeName}`
					);
					break;
				} else {
					errorData = await response.json();
					log(
						'info',
						`Attempted with issue type '${typeName}', got error: ${JSON.stringify(errorData)}`
					);
				}
			} catch (typeError) {
				log(
					'info',
					`Error trying issue type '${typeName}': ${typeError.message}`
				);
			}
		}

		if (!success) {
			log(
				'error',
				`Error creating Jira subtask after trying all issue type names: ${JSON.stringify(errorData)}`
			);
			return null;
		}

		const data = await response.json();
		log('success', `Created Jira subtask: ${data.key}`);
		return data;
	} catch (error) {
		log('error', `Error creating Jira subtask: ${error.message}`);
		return null;
	}
}

/**
 * Create a missing Jira issue based on task data
 * @param {string} issueKey - Original issue key that doesn't exist
 * @param {Object} taskData - Task data for creating the issue
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<string|null>} New issue key if created successfully, null otherwise
 */
async function createMissingJiraIssue(issueKey, taskData, explicitRoot = null) {
	// Determine if this is a user story or a subtask based on the task data
	const isSubtask = taskData.parentId || taskData.parentJiraKey;

	if (isSubtask && taskData.parentJiraKey) {
		return await createMissingSubtask(issueKey, taskData, explicitRoot);
	} else {
		return await createMissingUserStory(issueKey, taskData, explicitRoot);
	}
}

/**
 * Create a missing user story in Jira
 * @param {string} issueKey - Original issue key that doesn't exist
 * @param {Object} taskData - Task data for creating the user story
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<string|null>} New issue key if created successfully, null otherwise
 */
async function createMissingUserStory(issueKey, taskData, explicitRoot = null) {
	// Create the user story
	const createdIssue = await createUserStory(
		{
			title: taskData.title,
			description: taskData.description,
			details: taskData.details,
			priority: taskData.priority || 'medium'
		},
		explicitRoot
	);

	if (!createdIssue) {
		log('error', `Failed to create Jira user story for ${issueKey}`);
		return null;
	}

	log('success', `Created Jira user story ${createdIssue.key} for ${issueKey}`);
	return createdIssue.key;
}

/**
 * Create a missing subtask in Jira
 * @param {string} issueKey - Original issue key that doesn't exist
 * @param {Object} taskData - Task data for creating the subtask
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<string|null>} New issue key if created successfully, null otherwise
 */
async function createMissingSubtask(issueKey, taskData, explicitRoot = null) {
	// Find the parent issue key
	let parentKey = taskData.parentJiraKey;
	let parentExists = await issueExists(parentKey, explicitRoot);

	// If the parent doesn't exist with the original key, check if it was created with a new key
	if (
		!parentExists &&
		taskData.parentId &&
		taskData.tasksData &&
		taskData.tasksData.tasks
	) {
		try {
			const parentTask = taskData.tasksData.tasks.find(
				(t) => t.id === taskData.parentId
			);
			if (parentTask && parentTask.metadata && parentTask.metadata.jiraKey) {
				// Use the new Jira key from the parent task's metadata
				const newParentKey = parentTask.metadata.jiraKey;
				parentExists = await issueExists(newParentKey, explicitRoot);
				if (parentExists) {
					parentKey = newParentKey;
					log(
						'info',
						`Found parent issue with new key ${parentKey} instead of ${taskData.parentJiraKey}`
					);
				}
			}

			// If still not found, try to find by reference ID in the title
			if (!parentExists && parentTask) {
				const parentRefId = extractRefIdFromTitle(parentTask.title);
				if (parentRefId) {
					// Try to search for the issue in Jira by reference ID
					const parentIssueKey = await findIssueKeyByRefId(
						parentRefId,
						explicitRoot
					);
					if (parentIssueKey) {
						parentKey = parentIssueKey;
						parentExists = true;
						log(
							'info',
							`Found parent issue with key ${parentKey} by reference ID ${parentRefId}`
						);
					}
				}
			}
		} catch (e) {
			log('warn', `Error finding parent task: ${e.message}`);
		}
	}

	// If parent exists, create the subtask
	if (parentExists) {
		// Create the subtask under the parent
		const createdIssue = await createSubtask(
			{
				title: taskData.title,
				description: taskData.description,
				details: taskData.details || '',
				priority: taskData.priority || 'medium'
			},
			parentKey,
			explicitRoot
		);

		if (!createdIssue) {
			log('error', `Failed to create Jira task for ${issueKey}`);
			return null;
		}

		log('success', `Created Jira task ${createdIssue.key} for ${issueKey}`);
		return createdIssue.key;
	} else {
		log(
			'error',
			`Parent issue not found with key ${taskData.parentJiraKey} or any new key. Cannot create subtask.`
		);
		return null;
	}
}

/**
 * Find a Jira issue key by reference ID
 * @param {string} refId - Reference ID to search for
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<string|null>} Issue key if found, null otherwise
 */
async function findIssueKeyByRefId(refId, explicitRoot = null) {
	const config = validateJiraConfig(explicitRoot);
	if (!config) return null;

	const { projectKey, baseUrl, email, apiToken } = config;

	try {
		// Search for issues with the reference ID in the summary
		// Match the format: REFID-Title (e.g., US001-Task Title)
		const jql = `project = ${projectKey} AND summary ~ "${refId}-" ORDER BY created DESC`;

		const response = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/search?jql=${encodeURIComponent(jql)}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json'
				}
			}
		);

		if (!response.ok) {
			const errorData = await response.json();
			log(
				'error',
				`Error searching for Jira issue by reference ID: ${JSON.stringify(errorData)}`
			);
			return null;
		}

		const data = await response.json();

		if (data.issues && data.issues.length > 0) {
			return data.issues[0].key;
		}

		return null;
	} catch (error) {
		log(
			'error',
			`Error searching for Jira issue by reference ID: ${error.message}`
		);
		return null;
	}
}

/**
 * Check if a Jira issue exists
 * @param {string} issueKey - Issue key in Jira
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<boolean>} True if the issue exists, false otherwise
 */
async function issueExists(issueKey, explicitRoot = null) {
	if (!isJiraConfigured(explicitRoot)) {
		log('warn', 'Jira is not configured. Cannot check if issue exists.');
		return false;
	}

	if (!issueKey || typeof issueKey !== 'string' || !issueKey.includes('-')) {
		log('warn', `Invalid Jira issue key format: ${issueKey}`);
		return false;
	}

	try {
		const { baseUrl, email, apiToken } = getJiraConfig(explicitRoot);

		const response = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/issue/${issueKey}`,
			{
				method: 'GET',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json'
				}
			}
		);

		return response.status === 200;
	} catch (error) {
		log('error', `Error checking if Jira issue exists: ${error.message}`);
		return false;
	}
}

/**
 * Create a link between two Jira issues
 * @param {string} fromIssueKey - From issue key in Jira
 * @param {string} toIssueKey - To issue key in Jira
 * @param {string} linkType - Link type (e.g., 'Blocks', 'Relates to')
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function createIssueLink(
	fromIssueKey,
	toIssueKey,
	linkType,
	explicitRoot = null
) {
	const config = validateJiraConfig(explicitRoot);
	if (!config) return false;

	if (!fromIssueKey || !toIssueKey) {
		log('warn', 'Missing issue keys for link creation');
		return false;
	}

	const { baseUrl, email, apiToken } = config;

	// Default link type if not specified
	const effectiveLinkType = linkType || 'Relates';

	try {
		const response = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/issueLink`,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					type: {
						name: effectiveLinkType
					},
					inwardIssue: {
						key: fromIssueKey
					},
					outwardIssue: {
						key: toIssueKey
					}
				})
			}
		);

		if (response.status === 404) {
			// If the link type doesn't exist, try with a fallback link type
			if (effectiveLinkType !== 'Relates') {
				log(
					'warn',
					`Link type '${effectiveLinkType}' not found. Trying with 'Relates'...`
				);
				return await createIssueLink(
					fromIssueKey,
					toIssueKey,
					'Relates',
					explicitRoot
				);
			}
		}

		if (!response.ok) {
			const errorText = await response.text();
			log('error', `Error creating issue link: ${errorText}`);
			return false;
		}

		log(
			'success',
			`Created link from ${fromIssueKey} to ${toIssueKey} with type ${effectiveLinkType}`
		);
		return true;
	} catch (error) {
		log('error', `Error creating issue link: ${error.message}`);
		return false;
	}
}

/**
 * Update issue status in Jira
 * @param {string} issueKey - Issue key in Jira
 * @param {string} status - New status
 * @param {string|null} explicitRoot - Optional explicit path to the project root
 * @param {Object} taskData - Task data for creating the issue if it doesn't exist
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function updateIssueStatus(
	issueKey,
	status,
	explicitRoot = null,
	taskData = null
) {
	// Validate configuration and inputs
	const config = validateJiraConfig(explicitRoot);
	if (!config) return false;

	// Validate issue key format
	if (!issueKey || typeof issueKey !== 'string' || !issueKey.includes('-')) {
		log('warn', `Invalid Jira issue key format: ${issueKey}`);
		return false;
	}

	const { projectKey, baseUrl, email, apiToken } = config;

	try {
		// Check if the issue exists
		const exists = await issueExists(issueKey, explicitRoot);

		// If the issue doesn't exist and we have task data, create it
		if (!exists) {
			log(
				'warn',
				`Jira issue ${issueKey} does not exist. Attempting to create it...`
			);

			if (!taskData) {
				log(
					'error',
					`Cannot create Jira issue ${issueKey}: No task data provided.`
				);
				return false;
			}

			// Create the issue in Jira
			const newIssueKey = await createMissingJiraIssue(
				issueKey,
				taskData,
				explicitRoot
			);
			if (!newIssueKey) {
				return false;
			}

			// Continue with the newly created issue key
			issueKey = newIssueKey;
		}

		// First, get available transitions for the issue
		const transitionsResponse = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/issue/${issueKey}/transitions`,
			{
				method: 'GET',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json'
				}
			}
		);

		if (!transitionsResponse.ok) {
			const errorData = await transitionsResponse.json();
			log('error', `Error getting transitions: ${JSON.stringify(errorData)}`);
			return false;
		}

		const transitionsData = await transitionsResponse.json();

		// Map Taskmaster status to Jira status
		const jiraStatus = mapStatusToJira(status);

		// Find the transition ID for the target status
		const transition = transitionsData.transitions.find(
			(t) =>
				t.name.toLowerCase() === jiraStatus.toLowerCase() ||
				t.to.name.toLowerCase() === jiraStatus.toLowerCase()
		);

		if (!transition) {
			log(
				'warn',
				`No transition found for status '${status}' (mapped to '${jiraStatus}'). Available transitions: ${transitionsData.transitions.map((t) => t.name).join(', ')}`
			);
			return false;
		}

		// Execute the transition
		const updateResponse = await fetch(
			`${baseUrl}/rest/api/${JIRA_API_VERSION}/issue/${issueKey}/transitions`,
			{
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					transition: {
						id: transition.id
					}
				})
			}
		);

		if (!updateResponse.ok) {
			const errorText = await updateResponse.text();
			log('error', `Error updating issue status: ${errorText}`);
			return false;
		}

		log('success', `Updated issue ${issueKey} status to ${status}`);
		return true;
	} catch (error) {
		log('error', `Error updating issue status: ${error.message}`);
		return false;
	}
}

/**
 * Map Taskmaster priority to Jira priority
 * @param {string} priority - Taskmaster priority (high, medium, low)
 * @returns {string} Jira priority
 */
function mapPriorityToJira(priority) {
	switch (priority?.toLowerCase()) {
		case 'high':
			return 'High';
		case 'low':
			return 'Low';
		case 'medium':
		default:
			return 'Medium';
	}
}

/**
 * Map Taskmaster status to Jira transition/status
 * @param {string} status - Taskmaster status (pending, in-progress, review, done, etc.)
 * @returns {string} Jira status/transition name
 */
function mapStatusToJira(status) {
	switch (status?.toLowerCase()) {
		case 'pending':
			return 'To Do';
		case 'in-progress':
			return 'In Progress';
		case 'review':
		case 'in-review':
			return 'In Progress'; // No direct mapping, use In Progress
		case 'done':
		case 'completed':
			return 'Done';
		case 'cancelled':
		case 'deferred':
			return 'To Do'; // No direct mapping, reset to To Do
		default:
			return status; // Try with original status if no mapping exists
	}
}

/**
 * Store Jira key in task metadata
 * @param {Object} task - Task object
 * @param {string} jiraKey - Jira issue key
 * @returns {Object} Updated task object
 */
function storeJiraKey(task, jiraKey) {
	if (!task) return task;

	// Initialize metadata if it doesn't exist
	if (!task.metadata) {
		task.metadata = {};
	}

	// Store Jira key
	task.metadata.jiraKey = jiraKey;

	return task;
}

/**
 * Get Jira key from task metadata
 * @param {Object} task - Task object
 * @returns {string|null} Jira issue key or null if not found
 */
function getJiraKey(task) {
	return task?.metadata?.jiraKey || null;
}

/**
 * Updates Jira task status if Jira integration is enabled
 * @param {string} taskId - Task ID to update
 * @param {string} newStatus - New status
 * @param {Object} data - Tasks data object
 * @param {string} tasksPath - Path to tasks.json file
 * @param {Object} options - Additional options
 */
async function updateJiraTaskStatus(
	taskId,
	newStatus,
	data,
	tasksPath,
	options = {}
) {
	// Skip all Jira operations if integration is not enabled or not configured
	const projectRoot = options?.projectRoot;
	if (
		!getJiraIntegrationEnabled(projectRoot) ||
		!isJiraConfigured(projectRoot)
	) {
		return;
	}

	log(
		'info',
		`Jira integration is enabled. Updating issue status for task ${taskId}...`
	);

	// Find the task in the data
	const taskResult = findTaskById(data.tasks, taskId);
	const task = taskResult.task;

	if (!task) {
		log('warn', `Task ${taskId} not found. Skipping Jira status update.`);
		return;
	}

	// Get Jira key from task metadata
	let jiraKey = getJiraKey(task);

	// If no Jira key in metadata, try to find it by reference ID in metadata
	if (!jiraKey) {
		const refId = getRefId(task);
		log(
			'info',
			`Task ${taskId} - Reference ID: ${refId || 'NONE'}, Title: ${task.title || 'UNTITLED'}`
		);
		if (refId) {
			log(
				'info',
				`No Jira key found in metadata. Searching for issue by reference ID ${refId}...`
			);
			jiraKey = await findIssueKeyByRefId(refId, projectRoot);
			if (jiraKey) {
				log('success', `Found Jira issue ${jiraKey} by reference ID ${refId}`);
				// Store the found Jira key in task metadata for future use
				storeJiraKey(task, jiraKey);
				// Save the updated metadata to the file - requires writeJSON from the calling module
				options.writeJSON?.(tasksPath, data) ||
					(typeof writeJSON === 'function' && writeJSON(tasksPath, data));
			}
		}
	}

	if (jiraKey) {
		try {
			// Update issue status in Jira
			const success = await updateIssueStatus(jiraKey, newStatus, projectRoot, {
				...task,
				tasksData: data
			});

			if (success) {
				log('success', `Updated Jira issue ${jiraKey} status to ${newStatus}`);
			} else {
				log('warn', `Failed to update Jira issue ${jiraKey} status`);
			}
		} catch (jiraError) {
			log('error', `Error updating Jira issue status: ${jiraError.message}`);
		}
	} else {
		log(
			'warn',
			`No Jira key found for task ${taskId}. Skipping Jira status update.`
		);
	}

	// Also update any subtasks if this is a parent task
	if (task && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
		log(
			'info',
			`Updating Jira status for ${task.subtasks.length} subtasks of task ${taskId}...`
		);

		for (const subtask of task.subtasks) {
			// Get Jira key from subtask metadata
			let subtaskJiraKey = subtask.metadata?.jiraKey;

			// If no Jira key in metadata, try to find it by reference ID in metadata
			if (!subtaskJiraKey) {
				const subtaskRefId = getRefId(subtask);
				log(
					'info',
					`Subtask ${subtask.id} - Reference ID: ${subtaskRefId || 'NONE'}, Title: ${subtask.title || 'UNTITLED'}`
				);
				if (subtaskRefId) {
					log(
						'info',
						`No Jira key found in metadata for subtask ${subtask.id}. Searching for issue by reference ID ${subtaskRefId}...`
					);
					subtaskJiraKey = await findIssueKeyByRefId(subtaskRefId, projectRoot);
					if (subtaskJiraKey) {
						log(
							'success',
							`Found Jira issue ${subtaskJiraKey} by reference ID ${subtaskRefId}`
						);
						// Store the found Jira key in subtask metadata for future use
						storeJiraKey(subtask, subtaskJiraKey);
						// Save the updated metadata
						options.writeJSON?.(tasksPath, data) ||
							(typeof writeJSON === 'function' && writeJSON(tasksPath, data));
					}
				}
			}

			if (subtaskJiraKey) {
				try {
					// Prepare subtask data with parent information for Jira
					const subtaskData = {
						...subtask,
						parentId: task.id,
						parentJiraKey: jiraKey,
						tasksData: data
					};

					// Update subtask status in Jira, passing the subtask data in case the issue needs to be created
					const success = await updateIssueStatus(
						subtaskJiraKey,
						newStatus,
						projectRoot,
						subtaskData
					);
					if (success) {
						log(
							'success',
							`Updated Jira issue ${subtaskJiraKey} status for subtask ${subtask.id}`
						);
					} else {
						log(
							'warn',
							`Failed to update Jira issue ${subtaskJiraKey} status for subtask ${subtask.id}`
						);
					}
				} catch (jiraError) {
					log(
						'error',
						`Error updating Jira issue status for subtask ${subtask.id}: ${jiraError.message}`
					);
				}
			} else {
				log(
					'warn',
					`No Jira key found for subtask ${subtask.id}. Skipping Jira status update.`
				);
			}
		}
	}
}

// Export public functions
export {
	// Core configuration functions
	isJiraConfigured,
	getJiraConfig,
	validateJiraConfig,

	// Issue creation functions
	createUserStory,
	createSubtask as createTask, // Export as createTask for backward compatibility

	// Issue management functions
	createIssueLink,
	updateIssueStatus,
	updateJiraTaskStatus,

	// Utility functions
	storeJiraKey,
	getJiraKey,
	issueExists,
	createADFDescription,
	findIssueKeyByRefId
};

// Private helper functions (not exported):
// - createMissingJiraIssue
// - createMissingUserStory
// - createMissingSubtask
// - mapPriorityToJira
// - mapStatusToJira

/**
 * This module provides a complete integration between Taskmaster and Jira.
 * It handles authentication, issue creation, status updates, and more.
 *
 * The integration maps Taskmaster concepts to Jira as follows:
 * - Tasks in Taskmaster = User Stories in Jira
 * - Subtasks in Taskmaster = Subtasks in Jira
 *
 * The module uses reference IDs in task titles to maintain a consistent mapping between
 * Taskmaster tasks and Jira issues, even if the Jira issues are recreated.
 *
 * The module automatically handles cases where:
 * - Issues don't exist in Jira and need to be created
 * - Parent issues have different keys than expected
 * - Configuration is missing or contains placeholders
 */
