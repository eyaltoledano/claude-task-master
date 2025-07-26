import * as fs from 'fs';
import * as path from 'path';

export interface TaskFileData {
	details?: string;
	testStrategy?: string;
}

export interface TasksJsonStructure {
	[tagName: string]: {
		tasks: TaskWithDetails[];
		metadata: {
			createdAt: string;
			description?: string;
		};
	};
}

export interface TaskWithDetails {
	id: string | number;
	title: string;
	description: string;
	status: string;
	priority: string;
	dependencies?: (string | number)[];
	details?: string;
	testStrategy?: string;
	subtasks?: TaskWithDetails[];
}

/**
 * Reads tasks.json file directly and extracts implementation details and test strategy
 * @param taskId - The ID of the task to read (e.g., "1" or "1.2" for subtasks)
 * @param tagName - The tag/context name (defaults to "master")
 * @returns TaskFileData with details and testStrategy fields
 */
export async function readTaskFileData(
	taskId: string,
	tagName: string = 'master'
): Promise<TaskFileData> {
	try {
		// Check if we're in a VS Code webview context
		if (typeof window !== 'undefined' && (window as any).vscode) {
			// Use VS Code API to read the file
			const vscode = (window as any).vscode;

			// Request file content from the extension
			return new Promise((resolve, reject) => {
				const messageId = Date.now().toString();

				// Listen for response
				const messageHandler = (event: MessageEvent) => {
					const message = event.data;
					if (
						message.type === 'taskFileData' &&
						message.messageId === messageId
					) {
						window.removeEventListener('message', messageHandler);
						if (message.error) {
							reject(new Error(message.error));
						} else {
							resolve(message.data);
						}
					}
				};

				window.addEventListener('message', messageHandler);

				// Send request to extension
				vscode.postMessage({
					type: 'readTaskFileData',
					messageId,
					taskId,
					tagName
				});

				// Timeout after 5 seconds
				setTimeout(() => {
					window.removeEventListener('message', messageHandler);
					reject(new Error('Timeout reading task file data'));
				}, 5000);
			});
		} else {
			// Fallback for non-VS Code environments
			return { details: undefined, testStrategy: undefined };
		}
	} catch (error) {
		console.error('Error reading task file data:', error);
		return { details: undefined, testStrategy: undefined };
	}
}

/**
 * Finds a task by ID within a tasks array, supporting subtask notation (e.g., "1.2")
 * @param tasks - Array of tasks to search
 * @param taskId - ID to search for
 * @returns The task object if found, undefined otherwise
 */
export function findTaskById(
	tasks: TaskWithDetails[],
	taskId: string
): TaskWithDetails | undefined {
	// Check if this is a subtask ID with dotted notation (e.g., "1.2")
	if (taskId.includes('.')) {
		const [parentId, subtaskId] = taskId.split('.');
		console.log('🔍 Looking for subtask:', { parentId, subtaskId, taskId });

		// Find the parent task first
		const parentTask = tasks.find((task) => String(task.id) === parentId);
		if (!parentTask || !parentTask.subtasks) {
			console.log('❌ Parent task not found or has no subtasks:', parentId);
			return undefined;
		}

		console.log(
			'📋 Parent task found with',
			parentTask.subtasks.length,
			'subtasks'
		);
		console.log(
			'🔍 Subtask IDs in parent:',
			parentTask.subtasks.map((st) => st.id)
		);

		// Find the subtask within the parent
		const subtask = parentTask.subtasks.find(
			(st) => String(st.id) === subtaskId
		);
		if (subtask) {
			console.log('✅ Subtask found:', subtask.id);
		} else {
			console.log('❌ Subtask not found:', subtaskId);
		}
		return subtask;
	}

	// For regular task IDs (not dotted notation)
	for (const task of tasks) {
		// Convert both to strings for comparison to handle string vs number IDs
		if (String(task.id) === String(taskId)) {
			return task;
		}
	}

	return undefined;
}

/**
 * Parses tasks.json content and extracts task file data (details and testStrategy only)
 * @param content - Raw tasks.json content
 * @param taskId - Task ID to find
 * @param tagName - Tag name to use
 * @param workspacePath - Path to workspace root (not used anymore but kept for compatibility)
 * @returns TaskFileData with details and testStrategy only
 */
export function parseTaskFileData(
	content: string,
	taskId: string,
	tagName: string,
	workspacePath?: string
): TaskFileData {
	console.log('🔍 parseTaskFileData called with:', {
		taskId,
		tagName,
		contentLength: content.length
	});

	try {
		const tasksJson: TasksJsonStructure = JSON.parse(content);
		console.log('📊 Available tags:', Object.keys(tasksJson));

		// Get the tag data
		const tagData = tasksJson[tagName];
		if (!tagData || !tagData.tasks) {
			console.log('❌ Tag not found or no tasks in tag:', tagName);
			return { details: undefined, testStrategy: undefined };
		}

		console.log('📋 Tag found with', tagData.tasks.length, 'tasks');
		console.log(
			'🔍 Available task IDs:',
			tagData.tasks.map((t) => t.id)
		);

		// Find the task
		const task = findTaskById(tagData.tasks, taskId);
		if (!task) {
			console.log('❌ Task not found:', taskId);
			return { details: undefined, testStrategy: undefined };
		}

		console.log('✅ Task found:', task.id);
		console.log(
			'📝 Task has details:',
			!!task.details,
			'length:',
			task.details?.length
		);
		console.log(
			'🧪 Task has testStrategy:',
			!!task.testStrategy,
			'length:',
			task.testStrategy?.length
		);

		return {
			details: task.details,
			testStrategy: task.testStrategy
		};
	} catch (error) {
		console.error('❌ Error parsing tasks.json:', error);
		return { details: undefined, testStrategy: undefined };
	}
}
