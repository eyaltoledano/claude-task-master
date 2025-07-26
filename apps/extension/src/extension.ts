// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Restore full imports for MCP and utilities
import {
	MCPClientManager,
	createMCPConfigFromSettings
} from './utils/mcpClient';
import { ConfigManager } from './utils/configManager';
import { TaskMasterApi } from './utils/taskMasterApi';
import {
	ErrorHandler,
	getErrorHandler,
	MCPConnectionError,
	TaskLoadingError,
	NetworkError,
	UIRenderingError,
	ErrorCategory,
	ErrorSeverity,
	createErrorContext
} from './utils/errorHandler';
import { getToastDuration } from './utils/notificationPreferences';
import { parseTaskFileData } from './utils/taskFileReader';
import { TaskMasterTask } from './utils/taskMasterApi';

// Global MCP client manager instance
let mcpClient: MCPClientManager | null = null;
let configManager: ConfigManager | null = null;
let taskMasterApi: TaskMasterApi | null = null;
let activeWebviewPanels: vscode.WebviewPanel[] = [];

// Global error handler instance
let errorHandler: ErrorHandler;

// Polling state management
interface PollingState {
	timer?: NodeJS.Timeout;
	isPolling: boolean;
	interval: number;
	lastTaskData?: TaskMasterTask[];
	errorCount: number;
	maxErrors: number;
	// Adaptive frequency properties
	baseInterval: number;
	minInterval: number;
	maxInterval: number;
	lastUpdateTime?: number;
	consecutiveNoChanges: number;
	changeDetectionWindow: number[];
	// Network interruption handling
	reconnectAttempts: number;
	maxReconnectAttempts: number;
	reconnectBackoffMultiplier: number;
	lastSuccessfulConnection?: number;
	isOfflineMode: boolean;
	cachedTaskData?: TaskMasterTask[];
}

let pollingState: PollingState = {
	isPolling: false,
	interval: 5000, // 5 seconds default
	errorCount: 0,
	maxErrors: 5,
	// Adaptive frequency settings
	baseInterval: 5000, // 5 seconds base
	minInterval: 2000, // 2 seconds minimum
	maxInterval: 60000, // 1 minute maximum
	consecutiveNoChanges: 0,
	changeDetectionWindow: [], // Track recent change activity
	// Network interruption handling
	reconnectAttempts: 0,
	maxReconnectAttempts: 3,
	reconnectBackoffMultiplier: 1.5,
	lastSuccessfulConnection: undefined,
	isOfflineMode: false,
	cachedTaskData: []
};

// Initialize MCP components
async function initializeMCPComponents(context: vscode.ExtensionContext) {
	try {
		console.log('🔄 Initializing MCP components...');
		console.log(
			'🔍 DEBUGGING: initializeMCPComponents started at',
			new Date().toISOString()
		);

		// Initialize ConfigManager singleton
		configManager = ConfigManager.getInstance();

		// Get MCP configuration from VS Code settings
		const mcpConfig = createMCPConfigFromSettings();

		// Initialize MCP client
		console.log(
			'🔍 DEBUGGING: About to create MCPClientManager with config:',
			mcpConfig
		);
		mcpClient = new MCPClientManager(mcpConfig);

		// Initialize TaskMaster API first (even without connection)
		taskMasterApi = new TaskMasterApi(mcpClient, {
			timeout: 30000,
			retryAttempts: 3,
			cacheDuration: 5 * 60 * 1000, // 5 minutes
			projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		});

		// Try to connect to MCP server
		console.log('🔗 Connecting to Task Master MCP server...');
		try {
			await mcpClient.connect();

			// Test connection
			const connectionTest = await taskMasterApi.testConnection();
			if (connectionTest.success && connectionTest.data) {
				console.log('✅ Task Master MCP connection established');
				vscode.window.showInformationMessage(
					'Task Master connected successfully!'
				);
			} else {
				throw new Error(connectionTest.error || 'Connection test failed');
			}
		} catch (connectionError) {
			console.error('❌ Task Master MCP connection failed:', connectionError);
			console.error('Connection error details:', {
				message:
					connectionError instanceof Error
						? connectionError.message
						: 'Unknown error',
				stack:
					connectionError instanceof Error ? connectionError.stack : undefined,
				code: (connectionError as any)?.code,
				errno: (connectionError as any)?.errno,
				syscall: (connectionError as any)?.syscall
			});
			const errorMessage =
				connectionError instanceof Error
					? connectionError.message
					: 'Unknown connection error';

			if (errorMessage.includes('ENOENT') && errorMessage.includes('npx')) {
				vscode.window
					.showWarningMessage(
						'Task Master: npx not found. Please ensure Node.js is installed and accessible to VS Code. ' +
							'You may need to restart VS Code after installing Node.js.',
						'Open Settings'
					)
					.then((action) => {
						if (action === 'Open Settings') {
							vscode.commands.executeCommand(
								'workbench.action.openSettings',
								'@ext:taskr taskmaster'
							);
						}
					});
			} else {
				vscode.window.showWarningMessage(
					`Task Master connection failed: ${errorMessage}`
				);
			}

			// Initialize in offline mode
			pollingState.isOfflineMode = true;
			console.log(
				'📴 Starting in offline mode - some features will be unavailable'
			);
		}
	} catch (error) {
		// Use enhanced network error handling for polling
		handleNetworkError(error);
	}
}

// Polling functions
async function startPolling(): Promise<void> {
	if (pollingState.isPolling || !taskMasterApi) {
		return;
	}

	console.log('🔄 Starting task polling with interval:', pollingState.interval);
	pollingState.isPolling = true;
	pollingState.errorCount = 0;

	// Initial fetch
	await pollForUpdates();

	// Set up interval
	pollingState.timer = setInterval(pollForUpdates, pollingState.interval);
}

function stopPolling(): void {
	if (!pollingState.isPolling) {
		return;
	}

	console.log('⏹️ Stopping task polling');
	pollingState.isPolling = false;

	if (pollingState.timer) {
		clearInterval(pollingState.timer);
		pollingState.timer = undefined;
	}
}

async function pollForUpdates(): Promise<void> {
	if (!taskMasterApi || activeWebviewPanels.length === 0) {
		return;
	}

	try {
		console.log('📡 Polling for task updates...');

		const tasksResult = await taskMasterApi.getTasks({
			withSubtasks: true,
			projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
		});

		if (tasksResult.success && tasksResult.data) {
			const hasChanges = detectTaskChanges(tasksResult.data);

			if (hasChanges) {
				console.log('📋 Task changes detected, notifying webviews');

				// Track change for adaptive frequency
				pollingState.changeDetectionWindow.push(Date.now());
				pollingState.consecutiveNoChanges = 0;
				pollingState.lastUpdateTime = Date.now();

				// Update cached data
				pollingState.lastTaskData = tasksResult.data;

				// Notify all active webviews
				activeWebviewPanels.forEach((panel) => {
					panel.webview.postMessage({
						type: 'tasksUpdated',
						data: tasksResult.data,
						source: 'polling'
					});
				});
			} else {
				console.log('📋 No task changes detected');
				pollingState.consecutiveNoChanges++;
			}

			// Adjust polling frequency based on activity
			adjustPollingFrequency();

			// Reset error count on success
			pollingState.errorCount = 0;

			// Track successful connection
			pollingState.lastSuccessfulConnection = Date.now();
			pollingState.reconnectAttempts = 0;

			// If we were in offline mode, notify that we're back online
			if (pollingState.isOfflineMode) {
				pollingState.isOfflineMode = false;
				notifyConnectionStatus('online', 'Connected');
				console.log('✅ Reconnected successfully from offline mode');
			}
		} else {
			throw new Error(tasksResult.error || 'Failed to fetch tasks');
		}
	} catch (error) {
		// Use enhanced network error handling for polling
		handleNetworkError(error);
	}
}

function detectTaskChanges(newTasks: any[]): boolean {
	if (!pollingState.lastTaskData) {
		// First time, always consider as changed
		pollingState.lastTaskData = newTasks;
		return true;
	}

	// Quick check: different array lengths
	if (newTasks.length !== pollingState.lastTaskData.length) {
		return true;
	}

	// Deep comparison of task data
	try {
		const newTasksStr = JSON.stringify(sortTasksForComparison(newTasks));
		const oldTasksStr = JSON.stringify(
			sortTasksForComparison(pollingState.lastTaskData)
		);
		return newTasksStr !== oldTasksStr;
	} catch (error) {
		console.warn('⚠️ Error comparing tasks, assuming changed:', error);
		return true;
	}
}

function sortTasksForComparison(tasks: any[]): any[] {
	// Sort tasks by ID for consistent comparison
	return tasks
		.map((task) => ({
			...task,
			dependencies: task.dependencies ? [...task.dependencies].sort() : [],
			subtasks: task.subtasks
				? task.subtasks
						.map((st: any) => ({
							...st,
							dependencies: st.dependencies ? [...st.dependencies].sort() : []
						}))
						.sort((a: any, b: any) => a.id - b.id)
				: []
		}))
		.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// Adaptive polling frequency management
function adjustPollingFrequency(): void {
	const now = Date.now();
	const windowSize = 5; // Track last 5 polling intervals

	// Clean old entries from detection window (keep last 5 minutes)
	const fiveMinutesAgo = now - 5 * 60 * 1000;
	pollingState.changeDetectionWindow =
		pollingState.changeDetectionWindow.filter(
			(timestamp) => timestamp > fiveMinutesAgo
		);

	// Calculate change frequency in the recent window
	const recentChanges = pollingState.changeDetectionWindow.length;
	const windowDuration = Math.min(
		5 * 60 * 1000,
		now - (pollingState.changeDetectionWindow[0] || now)
	);
	const changesPerMinute =
		windowDuration > 0 ? (recentChanges / windowDuration) * 60 * 1000 : 0;

	let newInterval = pollingState.baseInterval;

	if (changesPerMinute > 2) {
		// High activity: poll more frequently
		newInterval = Math.max(
			pollingState.minInterval,
			pollingState.baseInterval * 0.5
		);
		console.log('📈 High activity detected, increasing polling frequency');
	} else if (changesPerMinute > 0.5) {
		// Moderate activity: use base interval
		newInterval = pollingState.baseInterval;
		console.log('📊 Moderate activity, using base polling interval');
	} else if (pollingState.consecutiveNoChanges > 3) {
		// Low activity: reduce polling frequency with exponential backoff
		const backoffMultiplier = Math.min(
			4,
			1.5 ** (pollingState.consecutiveNoChanges - 3)
		);
		newInterval = Math.min(
			pollingState.maxInterval,
			pollingState.baseInterval * backoffMultiplier
		);
		console.log(
			`📉 Low activity detected (${pollingState.consecutiveNoChanges} no-change cycles), reducing polling frequency`
		);
	}

	// Only restart polling if interval changed significantly (>500ms difference)
	if (
		Math.abs(newInterval - pollingState.interval) > 500 &&
		pollingState.isPolling
	) {
		console.log(
			`🔄 Adjusting polling interval from ${pollingState.interval}ms to ${newInterval}ms`
		);
		pollingState.interval = newInterval;

		// Restart polling with new interval
		if (pollingState.timer) {
			clearInterval(pollingState.timer);
			pollingState.timer = setInterval(pollForUpdates, pollingState.interval);
		}
	} else {
		pollingState.interval = newInterval;
	}
}

// Network interruption handling
function handleNetworkError(error: any): void {
	pollingState.errorCount++;
	pollingState.reconnectAttempts++;

	console.error(
		`❌ Network error (attempt ${pollingState.reconnectAttempts}/${pollingState.maxReconnectAttempts}):`,
		error
	);

	// Check if we should enter offline mode
	if (pollingState.reconnectAttempts >= pollingState.maxReconnectAttempts) {
		enterOfflineMode();
		return;
	}

	// Calculate exponential backoff delay
	const baseDelay = pollingState.interval;
	const backoffDelay =
		baseDelay *
		Math.pow(
			pollingState.reconnectBackoffMultiplier,
			pollingState.reconnectAttempts
		);
	const maxBackoffDelay = pollingState.maxInterval;
	const finalDelay = Math.min(backoffDelay, maxBackoffDelay);

	console.log(
		`🔄 Retrying connection in ${finalDelay}ms (attempt ${pollingState.reconnectAttempts})`
	);

	// Update UI with connection status
	notifyConnectionStatus(
		'reconnecting',
		`Reconnecting... (${pollingState.reconnectAttempts}/${pollingState.maxReconnectAttempts})`
	);

	// Retry with exponential backoff
	if (pollingState.timer) {
		clearInterval(pollingState.timer);
	}

	pollingState.timer = setTimeout(() => {
		// Try to resume normal polling
		pollingState.timer = setInterval(pollForUpdates, pollingState.interval);
	}, finalDelay);
}

function enterOfflineMode(): void {
	console.warn('⚠️ Entering offline mode due to persistent connection failures');

	pollingState.isOfflineMode = true;
	stopPolling();

	// Cache current task data for offline viewing
	if (pollingState.lastTaskData) {
		pollingState.cachedTaskData = [...pollingState.lastTaskData];
	}

	// Notify webviews about offline mode
	notifyConnectionStatus('offline', 'Offline - using cached data');

	activeWebviewPanels.forEach((panel) => {
		panel.webview.postMessage({
			type: 'networkOffline',
			data: {
				cachedTasks: pollingState.cachedTaskData,
				lastSuccessfulConnection: pollingState.lastSuccessfulConnection,
				reconnectAttempts: pollingState.reconnectAttempts
			}
		});
	});
}

function attemptReconnection(): void {
	if (!pollingState.isOfflineMode) {
		return;
	}

	console.log('🔄 Attempting to reconnect from offline mode...');

	// Reset connection state
	pollingState.isOfflineMode = false;
	pollingState.reconnectAttempts = 0;
	pollingState.errorCount = 0;

	// Notify UI about reconnection attempt
	notifyConnectionStatus('reconnecting', 'Attempting to reconnect...');

	// Try to restart polling
	startPolling().catch((error) => {
		console.error('Failed to reconnect:', error);
		enterOfflineMode();
	});
}

function notifyConnectionStatus(
	status: 'online' | 'offline' | 'reconnecting',
	message: string
): void {
	activeWebviewPanels.forEach((panel) => {
		panel.webview.postMessage({
			type: 'connectionStatusUpdate',
			data: {
				status,
				message,
				timestamp: Date.now(),
				isOfflineMode: pollingState.isOfflineMode,
				reconnectAttempts: pollingState.reconnectAttempts,
				maxReconnectAttempts: pollingState.maxReconnectAttempts
			}
		});
	});
}

// Error handling wrapper functions
async function handleExtensionError(
	error: Error | unknown,
	operation: string,
	context?: Record<string, any>
): Promise<void> {
	const errorContext = createErrorContext(error, operation, {
		category: ErrorCategory.EXTENSION_HOST,
		...context
	});

	console.error(`Extension Error [${operation}]:`, error);
	await errorHandler.handleError(
		error instanceof Error ? error : new Error(String(error)),
		context
	);
}

async function handleMCPError(
	error: Error | unknown,
	operation: string,
	context?: Record<string, any>
): Promise<void> {
	const mcpError = new MCPConnectionError(
		error instanceof Error ? error.message : String(error),
		'MCP_OPERATION_FAILED',
		context
	);

	console.error(`MCP Error [${operation}]:`, error);
	await errorHandler.handleError(mcpError, context);
}

async function handleTaskLoadingError(
	error: Error | unknown,
	operation: string,
	context?: Record<string, any>
): Promise<void> {
	const taskError = new TaskLoadingError(
		error instanceof Error ? error.message : String(error),
		'TASK_OPERATION_FAILED',
		context
	);

	console.error(`Task Loading Error [${operation}]:`, error);
	await errorHandler.handleError(taskError, context);
}

async function handleNetworkConnectionError(
	error: Error | unknown,
	operation: string,
	context?: Record<string, any>
): Promise<void> {
	const networkError = new NetworkError(
		error instanceof Error ? error.message : String(error),
		'NETWORK_OPERATION_FAILED',
		context
	);

	console.error(`Network Error [${operation}]:`, error);
	await errorHandler.handleError(networkError, context);
}

async function handleUIError(
	error: Error | unknown,
	operation: string,
	context?: Record<string, any>
): Promise<void> {
	const uiError = new UIRenderingError(
		error instanceof Error ? error.message : String(error),
		'UI_OPERATION_FAILED',
		context
	);

	console.error(`UI Error [${operation}]:`, error);
	await errorHandler.handleError(uiError, context);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('🎉 Task Master Kanban extension is now active!');
	console.log('🎉 Extension context:', context);
	console.log(
		'🔍 DEBUGGING: Extension activation started at',
		new Date().toISOString()
	);

	// Initialize error handler
	errorHandler = getErrorHandler();

	// Set up error event listener for webview notifications
	errorHandler.onError((errorDetails) => {
		// Notify webviews about errors for toast notifications
		activeWebviewPanels.forEach((panel) => {
			panel.webview.postMessage({
				type: 'errorNotification',
				data: {
					category: errorDetails.category,
					severity: errorDetails.severity,
					message: errorDetails.message,
					timestamp: errorDetails.timestamp.getTime(),
					userAction: errorDetails.userAction,
					duration: getToastDuration(errorDetails.severity)
				}
			});
		});
	});

	// Initialize MCP components
	initializeMCPComponents(context);

	// Register command to show Kanban board with webview
	const showKanbanCommand = vscode.commands.registerCommand(
		'taskr.showKanbanBoard',
		async () => {
			console.log('🎯 Show Kanban command executed!');

			// Check if panel already exists
			const existingPanel = activeWebviewPanels.find(
				(panel) => panel.title === 'Task Master Kanban'
			);
			if (existingPanel) {
				existingPanel.reveal(vscode.ViewColumn.One);
				return;
			}

			// Create webview panel
			const panel = vscode.window.createWebviewPanel(
				'taskrKanban',
				'Task Master Kanban',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.joinPath(context.extensionUri, 'dist')
					]
				}
			);

			// Add to active panels
			activeWebviewPanels.push(panel);

			// Start polling if this is the first panel
			if (activeWebviewPanels.length === 1) {
				await startPolling();
			}

			// Handle panel disposal
			panel.onDidDispose(() => {
				const index = activeWebviewPanels.findIndex((p) => p === panel);
				if (index !== -1) {
					activeWebviewPanels.splice(index, 1);
				}

				// Stop polling if no panels are active
				if (activeWebviewPanels.length === 0) {
					stopPolling();
				}
			});

			// Set webview HTML content
			panel.webview.html = getWebviewContent(
				panel.webview,
				context.extensionUri
			);

			// Handle messages from webview
			panel.webview.onDidReceiveMessage(async (message) => {
				console.log('📨 Received message from webview:', message);

				switch (message.type) {
					case 'ready':
						console.log('🚀 Webview is ready!');
						// Send initial configuration or data
						panel.webview.postMessage({
							type: 'init',
							data: { status: 'Extension connected!' }
						});
						break;

					case 'getTasks':
						console.log('📋 Getting tasks...');
						try {
							if (!taskMasterApi) {
								throw new Error(
									'Task Master API not initialized - extension may be starting up'
								);
							}

							// Check if we're in offline mode
							if (pollingState.isOfflineMode) {
								throw new Error(
									'Task Master is in offline mode - MCP server connection failed'
								);
							}

							const tasksResult = await taskMasterApi.getTasks({
								withSubtasks: true,
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
							});

							if (tasksResult.success) {
								panel.webview.postMessage({
									type: 'tasksData',
									requestId: message.requestId,
									data: tasksResult.data
								});
								console.log(
									`✅ Retrieved ${tasksResult.data?.length || 0} tasks from Task Master`
								);
							} else {
								throw new Error(tasksResult.error || 'Failed to get tasks');
							}
						} catch (error) {
							console.error('❌ Error getting tasks:', error);

							// Send error to webview instead of falling back to sample data
							panel.webview.postMessage({
								type: 'error',
								requestId: message.requestId,
								error:
									error instanceof Error
										? error.message
										: 'Failed to get tasks',
								errorType: 'connection'
							});

							// Enter offline mode if this is a connection error
							if (!pollingState.isOfflineMode) {
								handleNetworkError(error);
							}
						}
						break;

					case 'updateTaskStatus':
						console.log('🔄 Updating task status:', message.data);
						try {
							if (
								taskMasterApi &&
								message.data?.taskId &&
								message.data?.newStatus
							) {
								const updateResult = await taskMasterApi.updateTaskStatus(
									message.data.taskId,
									message.data.newStatus,
									{
										projectRoot:
											vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
									}
								);

								if (updateResult.success) {
									panel.webview.postMessage({
										type: 'taskStatusUpdated',
										requestId: message.requestId,
										success: true,
										data: {
											taskId: message.data.taskId,
											newStatus: message.data.newStatus
										}
									});
									console.log(
										`✅ Updated task ${message.data.taskId} status to ${message.data.newStatus}`
									);
								} else {
									throw new Error(
										updateResult.error || 'Failed to update task status'
									);
								}
							} else {
								throw new Error(
									'Invalid task update data or Task Master API not initialized'
								);
							}
						} catch (error) {
							console.error('❌ Error updating task status:', error);
							panel.webview.postMessage({
								type: 'error',
								requestId: message.requestId,
								error:
									error instanceof Error
										? error.message
										: 'Failed to update task status'
							});
						}
						break;

					case 'updateTask':
						console.log('📝 Updating task content:', message.data);
						try {
							if (
								taskMasterApi &&
								message.data?.taskId &&
								message.data?.updates
							) {
								const updateResult = await taskMasterApi.updateTask(
									message.data.taskId,
									message.data.updates,
									{
										projectRoot:
											vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
										append: message.data.options?.append || false,
										research: message.data.options?.research || false
									}
								);

								if (updateResult.success) {
									panel.webview.postMessage({
										type: 'taskUpdated',
										requestId: message.requestId,
										success: true,
										data: {
											taskId: message.data.taskId,
											updates: message.data.updates
										}
									});
									console.log(`✅ Updated task ${message.data.taskId} content`);
								} else {
									throw new Error(
										updateResult.error || 'Failed to update task'
									);
								}
							} else {
								throw new Error(
									'Invalid task update data or Task Master API not initialized'
								);
							}
						} catch (error) {
							console.error('❌ Error updating task:', error);
							panel.webview.postMessage({
								type: 'error',
								requestId: message.requestId,
								error:
									error instanceof Error
										? error.message
										: 'Failed to update task'
							});
						}
						break;

					case 'updateSubtask':
						console.log('📝 Updating subtask content:', message.data);
						try {
							if (
								taskMasterApi &&
								message.data?.taskId &&
								message.data?.prompt
							) {
								const updateResult = await taskMasterApi.updateSubtask(
									message.data.taskId,
									message.data.prompt,
									{
										projectRoot:
											vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
										research: message.data.options?.research || false
									}
								);

								if (updateResult.success) {
									panel.webview.postMessage({
										type: 'subtaskUpdated',
										requestId: message.requestId,
										success: true,
										data: {
											taskId: message.data.taskId,
											prompt: message.data.prompt
										}
									});
									console.log(
										`✅ Updated subtask ${message.data.taskId} content`
									);
								} else {
									throw new Error(
										updateResult.error || 'Failed to update subtask'
									);
								}
							} else {
								throw new Error(
									'Invalid subtask update data or Task Master API not initialized'
								);
							}
						} catch (error) {
							console.error('❌ Error updating subtask:', error);
							panel.webview.postMessage({
								type: 'error',
								requestId: message.requestId,
								error:
									error instanceof Error
										? error.message
										: 'Failed to update subtask'
							});
						}
						break;

					case 'addSubtask':
						console.log('➕ Adding new subtask:', message.data);
						try {
							if (
								taskMasterApi &&
								message.data?.parentTaskId &&
								message.data?.subtaskData
							) {
								const addResult = await taskMasterApi.addSubtask(
									message.data.parentTaskId,
									message.data.subtaskData,
									{
										projectRoot:
											vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
									}
								);

								if (addResult.success) {
									panel.webview.postMessage({
										type: 'subtaskAdded',
										requestId: message.requestId,
										success: true,
										data: {
											parentTaskId: message.data.parentTaskId,
											subtaskData: message.data.subtaskData
										}
									});
									console.log(
										`✅ Added subtask to task ${message.data.parentTaskId}`
									);
								} else {
									throw new Error(addResult.error || 'Failed to add subtask');
								}
							} else {
								throw new Error(
									'Invalid subtask add data or Task Master API not initialized'
								);
							}
						} catch (error) {
							console.error('❌ Error adding subtask:', error);
							panel.webview.postMessage({
								type: 'error',
								requestId: message.requestId,
								error:
									error instanceof Error
										? error.message
										: 'Failed to add subtask'
							});
						}
						break;

					case 'startPolling':
						console.log('🔄 Manual start polling requested');
						await startPolling();
						panel.webview.postMessage({
							type: 'pollingStarted',
							requestId: message.requestId,
							success: true
						});
						break;

					case 'stopPolling':
						console.log('⏹️ Manual stop polling requested');
						stopPolling();
						panel.webview.postMessage({
							type: 'pollingStopped',
							requestId: message.requestId,
							success: true
						});
						break;

					case 'getPollingStatus':
						console.log('📊 Polling status requested');
						panel.webview.postMessage({
							type: 'pollingStatus',
							requestId: message.requestId,
							data: {
								isPolling: pollingState.isPolling,
								interval: pollingState.interval,
								errorCount: pollingState.errorCount,
								maxErrors: pollingState.maxErrors
							}
						});
						break;

					case 'attemptReconnection':
						console.log('🔄 Manual reconnection requested');
						if (pollingState.isOfflineMode) {
							attemptReconnection();
							panel.webview.postMessage({
								type: 'reconnectionAttempted',
								requestId: message.requestId,
								success: true
							});
						} else {
							panel.webview.postMessage({
								type: 'reconnectionAttempted',
								requestId: message.requestId,
								success: false,
								error: 'Not in offline mode'
							});
						}
						break;

					case 'getNetworkStatus':
						console.log('📊 Network status requested');
						panel.webview.postMessage({
							type: 'networkStatus',
							requestId: message.requestId,
							data: {
								isOfflineMode: pollingState.isOfflineMode,
								lastSuccessfulConnection: pollingState.lastSuccessfulConnection,
								reconnectAttempts: pollingState.reconnectAttempts,
								maxReconnectAttempts: pollingState.maxReconnectAttempts,
								cachedTaskCount: pollingState.cachedTaskData?.length || 0
							}
						});
						break;

					case 'reactError':
						console.log('🔥 React error reported from webview:', message.data);
						try {
							await handleUIError(
								new Error(message.data.message),
								'React Component Error',
								{
									stack: message.data.stack,
									componentStack: message.data.componentStack,
									timestamp: message.data.timestamp
								}
							);
						} catch (error) {
							console.error('Failed to handle React error:', error);
						}
						break;

					case 'readTaskFileData':
						console.log('📄 Reading task file data:', message.data);
						{
							const { requestId } = message;
							try {
								const { taskId, tag: tagName = 'master' } = message.data;

								// Get workspace folder
								const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
								if (!workspaceFolder) {
									throw new Error('No workspace folder found');
								}

								// Build path to tasks.json
								const tasksJsonPath = path.join(
									workspaceFolder.uri.fsPath,
									'.taskmaster',
									'tasks',
									'tasks.json'
								);
								console.log('🔍 Looking for tasks.json at:', tasksJsonPath);

								// Check if file exists
								if (!fs.existsSync(tasksJsonPath)) {
									// Try legacy location
									const legacyPath = path.join(
										workspaceFolder.uri.fsPath,
										'tasks',
										'tasks.json'
									);
									console.log('🔍 Trying legacy path:', legacyPath);
									if (!fs.existsSync(legacyPath)) {
										throw new Error(
											'tasks.json not found in .taskmaster/tasks/ or tasks/ directory'
										);
									}
									// Use legacy path
									const content = fs.readFileSync(legacyPath, 'utf8');
									console.log(
										'📖 Read legacy tasks.json, content length:',
										content.length
									);
									const taskData = parseTaskFileData(
										content,
										taskId,
										tagName,
										workspaceFolder.uri.fsPath
									);
									console.log('✅ Parsed task data for legacy path:', taskData);
									panel.webview.postMessage({
										type: 'response',
										requestId,
										data: taskData
									});
									return;
								}

								// Read and parse tasks.json
								const content = fs.readFileSync(tasksJsonPath, 'utf8');
								console.log(
									'📖 Read tasks.json, content length:',
									content.length
								);
								const taskData = parseTaskFileData(
									content,
									taskId,
									tagName,
									workspaceFolder.uri.fsPath
								);
								console.log('✅ Parsed task data:', taskData);

								panel.webview.postMessage({
									type: 'response',
									requestId,
									data: taskData
								});

								console.log(`✅ Retrieved task file data for task ${taskId}`);
							} catch (error) {
								console.error('❌ Error reading task file data:', error);
								panel.webview.postMessage({
									type: 'error',
									requestId,
									error:
										error instanceof Error
											? error.message
											: 'Failed to read task file data'
								});
							}
						}
						break;

					case 'mcpRequest':
						console.log('📊 MCP Request:', message);
						const { requestId: mcpRequestId, tool, parameters } = message;
						try {
							if (!taskMasterApi) {
								throw new Error('Task Master API not initialized');
							}

							if (pollingState.isOfflineMode) {
								throw new Error(
									'Task Master is in offline mode - MCP server connection unavailable'
								);
							}

							let result;

							switch (tool) {
								case 'complexity_report':
									console.log('📊 Calling complexity_report MCP tool');
									try {
										// Use the private callMCPTool method via type assertion to access it
										const mcpResult = await (taskMasterApi as any).callMCPTool(
											'complexity_report',
											{
												projectRoot:
													vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
												...parameters
											}
										);
										result = { success: true, data: mcpResult };
									} catch (mcpError) {
										result = {
											success: false,
											error:
												mcpError instanceof Error
													? mcpError.message
													: 'Failed to get complexity report'
										};
									}
									break;

								case 'analyze_project_complexity':
									console.log('🧮 Calling analyze_project_complexity MCP tool');
									try {
										// Use the private callMCPTool method via type assertion to access it
										const mcpResult = await (taskMasterApi as any).callMCPTool(
											'analyze_project_complexity',
											{
												projectRoot:
													vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
												...parameters
											}
										);
										result = { success: true, data: mcpResult };
									} catch (mcpError) {
										result = {
											success: false,
											error:
												mcpError instanceof Error
													? mcpError.message
													: 'Failed to analyze project complexity'
										};
									}
									break;

								default:
									throw new Error(`Unsupported MCP tool: ${tool}`);
							}

							if (result.success) {
								panel.webview.postMessage({
									type: 'response',
									requestId: mcpRequestId,
									data: result.data
								});
								console.log(`✅ MCP tool ${tool} executed successfully`);
							} else {
								throw new Error(
									result.error || `Failed to execute MCP tool: ${tool}`
								);
							}
						} catch (error) {
							console.error(`❌ Error executing MCP tool ${tool}:`, error);
							panel.webview.postMessage({
								type: 'error',
								requestId: mcpRequestId,
								error:
									error instanceof Error
										? error.message
										: `Failed to execute MCP tool: ${tool}`
							});
						}
						break;

					default:
						console.log('❓ Unknown message type:', message.type);
				}
			});

			vscode.window.showInformationMessage('Task Master Kanban Board opened!');
		}
	);

	const checkConnectionCommand = vscode.commands.registerCommand(
		'taskr.checkConnection',
		async () => {
			console.log('🔗 Check connection command executed!');
			vscode.window.showInformationMessage('Check connection command works!');
		}
	);

	const reconnectCommand = vscode.commands.registerCommand(
		'taskr.reconnect',
		async () => {
			console.log('🔄 Reconnect command executed!');
			vscode.window.showInformationMessage('Reconnect command works!');
		}
	);

	const openSettingsCommand = vscode.commands.registerCommand(
		'taskr.openSettings',
		() => {
			console.log('⚙️ Open settings command executed!');
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'@ext:taskr taskmaster'
			);
		}
	);

	context.subscriptions.push(
		showKanbanCommand,
		checkConnectionCommand,
		reconnectCommand,
		openSettingsCommand
	);

	console.log('✅ All commands registered successfully!');
}

// Generate webview HTML content
function getWebviewContent(
	webview: vscode.Webview,
	extensionUri: vscode.Uri
): string {
	// Get the local path to main script run in the webview
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'index.js')
	);
	const styleUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'dist', 'index.css')
	);

	// Use a nonce to only allow specific scripts to be run
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
	<link href="${styleUri}" rel="stylesheet">
	<title>Task Master Kanban</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce() {
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// Sample data for testing
function getSampleTasks() {
	return [
		{
			id: '1',
			title: 'Set up project structure',
			description: 'Create the basic VS Code extension structure',
			status: 'done',
			priority: 'high',
			details:
				'Initialize package.json, create src folder, set up TypeScript configuration',
			dependencies: []
		},
		{
			id: '2',
			title: 'Implement MCP Client',
			description: 'Create MCP client to communicate with task-master-ai',
			status: 'done',
			priority: 'high',
			details:
				'Use @modelcontextprotocol/sdk to create a client that can connect to task-master-ai server',
			dependencies: ['1']
		},
		{
			id: '3',
			title: 'Create configuration system',
			description: 'Build configuration management for the extension',
			status: 'done',
			priority: 'medium',
			details:
				'Create ConfigManager class to handle VS Code settings and configuration updates',
			dependencies: ['1']
		},
		{
			id: '4',
			title: 'Create basic Webview panel with React',
			description: 'Set up the webview infrastructure with React',
			status: 'done',
			priority: 'high',
			details:
				'Create webview panel, integrate React, set up bundling with esbuild',
			dependencies: ['1', '2', '3']
		},
		{
			id: '5',
			title: 'Integrate shadcn/ui Kanban component',
			description: 'Add the Kanban board UI using shadcn/ui components',
			status: 'done',
			priority: 'medium',
			details:
				'Install and customize shadcn/ui Kanban component for VS Code theming',
			dependencies: ['4']
		},
		{
			id: '6',
			title: 'Implement get_tasks MCP tool integration',
			description:
				'Use the MCP client to call the get_tasks tool and retrieve task data',
			status: 'in-progress',
			priority: 'high',
			details:
				'Connect to task-master-ai server and fetch real task data instead of using sample data',
			dependencies: ['2']
		},
		{
			id: '7',
			title: 'Add task status updates via MCP',
			description: 'Implement drag-and-drop task status updates through MCP',
			status: 'pending',
			priority: 'high',
			details:
				'When tasks are moved between columns, update status via set_task_status MCP tool',
			dependencies: ['6']
		},
		{
			id: '8',
			title: 'Add real-time task synchronization',
			description: 'Keep the Kanban board in sync with task file changes',
			status: 'pending',
			priority: 'medium',
			details:
				'Implement file watching and real-time updates when tasks.json changes',
			dependencies: ['6', '7']
		}
	];
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('👋 Task Master Kanban extension deactivated');

	// Stop polling
	stopPolling();

	// Close all active webview panels
	activeWebviewPanels.forEach((panel) => panel.dispose());
	activeWebviewPanels = [];

	// Clean up MCP components
	if (taskMasterApi) {
		taskMasterApi.destroy();
		taskMasterApi = null;
	}

	if (mcpClient) {
		mcpClient.disconnect();
		mcpClient = null;
	}

	configManager = null;
}
