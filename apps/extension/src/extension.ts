/**
 * TaskMaster Extension - Simplified Architecture
 * Only using patterns where they add real value
 */

import * as vscode from 'vscode';
import { ConfigService } from './services/config-service';
import { PollingService } from './services/polling-service';
import { createPollingStrategy } from './services/polling-strategies';
import { TaskRepository } from './services/task-repository';
import { TerminalManager } from './services/terminal-manager';
import { WebviewManager } from './services/webview-manager';
import { EventEmitter } from './utils/event-emitter';
import { ExtensionLogger } from './utils/logger';
import {
	MCPClientManager,
	createMCPConfigFromSettings
} from './utils/mcpClient';
import { TaskMasterApi } from './utils/task-master-api';
import { SidebarWebviewManager } from './services/sidebar-webview-manager';

let logger: ExtensionLogger;
let mcpClient: MCPClientManager;
let api: TaskMasterApi;
let repository: TaskRepository;
let terminalManager: TerminalManager;
let pollingService: PollingService;
let webviewManager: WebviewManager;
let events: EventEmitter;
let configService: ConfigService;
let sidebarManager: SidebarWebviewManager;

export async function activate(context: vscode.ExtensionContext) {
	try {
		// Initialize logger (needed to prevent MCP stdio issues)
		logger = ExtensionLogger.getInstance();
		logger.log('🎉 TaskMaster Extension activating...');

		// Simple event emitter for webview communication
		events = new EventEmitter();

		// Initialize MCP client
		mcpClient = new MCPClientManager(createMCPConfigFromSettings());

		// Initialize API
		api = new TaskMasterApi(mcpClient);

		// Repository with caching (actually useful for performance)
		repository = new TaskRepository(api, logger);

		// Terminal manager for task execution
		terminalManager = new TerminalManager(context, logger);

		// Config service for TaskMaster config.json
		configService = new ConfigService(logger);

		// Polling service with strategy pattern (makes sense for different polling behaviors)
		const strategy = createPollingStrategy(
			vscode.workspace.getConfiguration('taskmaster')
		);
		pollingService = new PollingService(repository, strategy, logger);

		// Webview manager (cleaner than global panel array) - create before connection
		webviewManager = new WebviewManager(
			context,
			repository,
			events,
			logger,
			terminalManager
		);
		webviewManager.setConfigService(configService);

		// Sidebar webview manager
		sidebarManager = new SidebarWebviewManager(context.extensionUri);

		// Initialize connection
		await initializeConnection();

		// Set MCP client and API after connection
		webviewManager.setMCPClient(mcpClient);
		webviewManager.setApi(api);
		sidebarManager.setApi(api);

		// Register commands
		registerCommands(context);

		// Handle polling lifecycle
		events.on('webview:opened', () => {
			if (webviewManager.getPanelCount() === 1) {
				pollingService.start();
			}
		});

		events.on('webview:closed', () => {
			if (webviewManager.getPanelCount() === 0) {
				pollingService.stop();
			}
		});

		// Forward repository updates to webviews
		repository.on('tasks:updated', (tasks) => {
			webviewManager.broadcast('tasksUpdated', { tasks, source: 'polling' });
		});

		logger.log('✅ TaskMaster Extension activated');
	} catch (error) {
		logger?.error('Failed to activate', error);
		vscode.window.showErrorMessage(
			`Failed to activate TaskMaster: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

async function initializeConnection() {
	try {
		logger.log('🔗 Connecting to TaskMaster...');

		// Notify webviews that we're connecting
		if (webviewManager) {
			webviewManager.broadcast('connectionStatus', {
				isConnected: false,
				status: 'Connecting...'
			});
		}

		await mcpClient.connect();

		const testResult = await api.testConnection();

		if (testResult.success) {
			logger.log('✅ Connected to TaskMaster');
			vscode.window.showInformationMessage('TaskMaster connected!');

			// Notify webviews that we're connected
			if (webviewManager) {
				webviewManager.broadcast('connectionStatus', {
					isConnected: true,
					status: 'Connected'
				});
			}
			if (sidebarManager) {
				sidebarManager.updateConnectionStatus();
			}
		} else {
			throw new Error(testResult.error || 'Connection test failed');
		}
	} catch (error) {
		logger.error('Connection failed', error);

		// Notify webviews that connection failed
		if (webviewManager) {
			webviewManager.broadcast('connectionStatus', {
				isConnected: false,
				status: 'Disconnected'
			});
		}
		if (sidebarManager) {
			sidebarManager.updateConnectionStatus();
		}

		handleConnectionError(error);
	}
}

function handleConnectionError(error: any) {
	const message = error instanceof Error ? error.message : 'Unknown error';

	if (message.includes('ENOENT') && message.includes('npx')) {
		vscode.window
			.showWarningMessage(
				'TaskMaster: npx not found. Please ensure Node.js is installed.',
				'Open Settings'
			)
			.then((action) => {
				if (action === 'Open Settings') {
					vscode.commands.executeCommand(
						'workbench.action.openSettings',
						'@ext:Hamster.task-master-hamster taskmaster'
					);
				}
			});
	} else {
		vscode.window.showWarningMessage(
			`TaskMaster connection failed: ${message}`
		);
	}
}

function registerCommands(context: vscode.ExtensionContext) {
	// Main command
	context.subscriptions.push(
		vscode.commands.registerCommand('tm.showKanbanBoard', async () => {
			await webviewManager.createOrShowPanel();
		})
	);

	// Utility commands
	context.subscriptions.push(
		vscode.commands.registerCommand('tm.refreshTasks', async () => {
			await repository.refresh();
			vscode.window.showInformationMessage('Tasks refreshed!');
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('tm.openSettings', () => {
			vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'@ext:Hamster.task-master-hamster taskmaster'
			);
		})
	);

	// Register sidebar view provider

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			'taskmaster.welcome',
			sidebarManager
		)
	);
}

export async function deactivate() {
	logger?.log('👋 TaskMaster Extension deactivating...');
	pollingService?.stop();
	webviewManager?.dispose();
	await terminalManager?.dispose();
	api?.destroy();
	mcpClient?.disconnect();
}
