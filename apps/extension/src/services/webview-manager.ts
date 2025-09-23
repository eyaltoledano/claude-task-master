/**
 * Webview Manager - Simplified
 * Manages webview panels and message handling
 */

import * as vscode from 'vscode';
import type { EventEmitter } from '../utils/event-emitter';
import type { ExtensionLogger } from '../utils/logger';
import type { ConfigService } from './config-service';
import type { TaskRepository } from './task-repository';
import type { TerminalManager } from './terminal-manager';

export class WebviewManager {
	private panels = new Set<vscode.WebviewPanel>();
	private configService?: ConfigService;
	private mcpClient?: any;
	private api?: any;

	constructor(
		private context: vscode.ExtensionContext,
		private repository: TaskRepository,
		private events: EventEmitter,
		private logger: ExtensionLogger,
		private terminalManager: TerminalManager
	) {}

	setConfigService(configService: ConfigService): void {
		this.configService = configService;
	}

	setMCPClient(mcpClient: any): void {
		this.mcpClient = mcpClient;
	}

	setApi(api: any): void {
		this.api = api;
	}

	async createOrShowPanel(): Promise<void> {
		// Find existing panel
		const existing = Array.from(this.panels).find(
			(p) => p.title === 'TaskMaster Kanban'
		);
		if (existing) {
			existing.reveal();
			return;
		}

		// Create new panel
		const panel = vscode.window.createWebviewPanel(
			'taskrKanban',
			'TaskMaster Kanban',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(this.context.extensionUri, 'dist')
				]
			}
		);

		// Set the icon for the webview tab
		panel.iconPath = {
			light: vscode.Uri.joinPath(
				this.context.extensionUri,
				'assets',
				'icon-light.svg'
			),
			dark: vscode.Uri.joinPath(
				this.context.extensionUri,
				'assets',
				'icon-dark.svg'
			)
		};

		this.panels.add(panel);
		panel.webview.html = this.getWebviewContent(panel.webview);

		// Handle messages
		panel.webview.onDidReceiveMessage(async (message) => {
			await this.handleMessage(panel, message);
		});

		// Handle disposal
		panel.onDidDispose(() => {
			this.panels.delete(panel);
			this.events.emit('webview:closed');
		});

		this.events.emit('webview:opened');
		vscode.window.showInformationMessage('TaskMaster Kanban opened!');
	}

	broadcast(type: string, data: any): void {
		this.panels.forEach((panel) => {
			panel.webview.postMessage({ type, data });
		});
	}

	getPanelCount(): number {
		return this.panels.size;
	}

	dispose(): void {
		this.panels.forEach((panel) => panel.dispose());
		this.panels.clear();
	}

	private async handleMessage(
		panel: vscode.WebviewPanel,
		message: any
	): Promise<void> {
		// Validate message structure
		if (!message || typeof message !== 'object') {
			this.logger.error('Invalid message received:', message);
			return;
		}

		const { type, data, requestId } = message;
		this.logger.debug(`Webview message: ${type}`, message);

		try {
			let response: any;

			switch (type) {
				case 'ready':
					// Webview is ready, send current connection status
					const isConnected = this.mcpClient?.getStatus()?.isRunning || false;
					panel.webview.postMessage({
						type: 'connectionStatus',
						data: {
							isConnected: isConnected,
							status: isConnected ? 'Connected' : 'Disconnected'
						}
					});
					// No response needed for ready message
					return;

				case 'getTasks':
					// Pass options to getAll including tag if specified
					response = await this.repository.getAll({
						tag: data?.tag,
						withSubtasks: data?.withSubtasks ?? true
					});
					break;

				case 'updateTaskStatus':
					await this.repository.updateStatus(data.taskId, data.newStatus);
					response = { success: true };
					break;

				case 'getConfig':
					if (this.configService) {
						response = await this.configService.getSafeConfig();
					} else {
						response = null;
					}
					break;

				case 'readTaskFileData':
					// For now, return the task data from repository
					// In the future, this could read from actual task files
					const task = await this.repository.getById(data.taskId);
					if (task) {
						response = {
							details: task.details || '',
							testStrategy: task.testStrategy || ''
						};
					} else {
						response = {
							details: '',
							testStrategy: ''
						};
					}
					break;

				case 'updateTask':
					// Handle task content updates with MCP
					if (this.mcpClient) {
						try {
							const { taskId, updates, options = {} } = data;

							// Use the update_task MCP tool
							await this.mcpClient.callTool('update_task', {
								id: String(taskId),
								prompt: updates.description || '',
								append: options.append || false,
								research: options.research || false,
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
							});

							response = { success: true };
						} catch (error) {
							this.logger.error('Failed to update task via MCP:', error);
							throw error;
						}
					} else {
						throw new Error('MCP client not initialized');
					}
					break;

				case 'updateSubtask':
					// Handle subtask content updates with MCP
					if (this.mcpClient) {
						try {
							const { taskId, prompt, options = {} } = data;

							// Use the update_subtask MCP tool
							await this.mcpClient.callTool('update_subtask', {
								id: String(taskId),
								prompt: prompt,
								research: options.research || false,
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
							});

							response = { success: true };
						} catch (error) {
							this.logger.error('Failed to update subtask via MCP:', error);
							throw error;
						}
					} else {
						throw new Error('MCP client not initialized');
					}
					break;

				case 'getComplexity':
					// For backward compatibility - redirect to mcpRequest
					this.logger.debug(
						`getComplexity request for task ${data.taskId}, mcpClient available: ${!!this.mcpClient}`
					);
					if (this.mcpClient && data.taskId) {
						try {
							const complexityResult = await this.mcpClient.callTool(
								'complexity_report',
								{
									projectRoot:
										vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
								}
							);

							if (complexityResult?.report?.complexityAnalysis?.tasks) {
								const task =
									complexityResult.report.complexityAnalysis.tasks.find(
										(t: any) => t.id === data.taskId
									);
								response = task ? { score: task.complexityScore } : {};
							} else {
								response = {};
							}
						} catch (error) {
							this.logger.error('Failed to get complexity', error);
							response = {};
						}
					} else {
						this.logger.warn(
							`Cannot get complexity: mcpClient=${!!this.mcpClient}, taskId=${data.taskId}`
						);
						response = {};
					}
					break;

				case 'mcpRequest':
					// Handle MCP tool calls
					try {
						// The tool and params come directly in the message
						const tool = message.tool;
						const params = message.params || {};

						if (!this.mcpClient) {
							throw new Error('MCP client not initialized');
						}

						if (!tool) {
							throw new Error('Tool name not specified in mcpRequest');
						}

						// Add projectRoot if not provided
						if (!params.projectRoot) {
							params.projectRoot =
								vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						}

						const result = await this.mcpClient.callTool(tool, params);
						response = { data: result };
					} catch (error) {
						this.logger.error('MCP request failed:', error);
						// Re-throw with cleaner error message
						throw new Error(
							error instanceof Error ? error.message : 'Unknown error'
						);
					}
					break;

				case 'getTags':
					// Get available tags
					if (this.mcpClient) {
						try {
							const result = await this.mcpClient.callTool('list_tags', {
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
								showMetadata: false
							});
							// The MCP response has a specific structure
							// Based on the MCP SDK, the response is in result.content[0].text
							let parsedData;
							if (
								result?.content &&
								Array.isArray(result.content) &&
								result.content[0]?.text
							) {
								try {
									parsedData = JSON.parse(result.content[0].text);
								} catch (e) {
									this.logger.error('Failed to parse MCP response text:', e);
								}
							}

							// Extract tags data from the parsed response
							if (parsedData?.data) {
								response = parsedData.data;
							} else if (parsedData) {
								response = parsedData;
							} else if (result?.data) {
								response = result.data;
							} else {
								response = { tags: [], currentTag: 'master' };
							}
						} catch (error) {
							this.logger.error('Failed to get tags:', error);
							response = { tags: [], currentTag: 'master' };
						}
					} else {
						response = { tags: [], currentTag: 'master' };
					}
					break;

				case 'switchTag':
					// Switch to a different tag
					if (this.mcpClient && data.tagName) {
						try {
							await this.mcpClient.callTool('use_tag', {
								name: data.tagName,
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
							});
							// Clear cache and fetch tasks for the new tag
							await this.repository.refresh();
							const tasks = await this.repository.getAll({ tag: data.tagName });
							this.broadcast('tasksUpdated', { tasks, source: 'tag-switch' });
							response = { success: true };
						} catch (error) {
							this.logger.error('Failed to switch tag:', error);
							throw error;
						}
					} else {
						throw new Error('Tag name not provided');
					}
					break;

				case 'openExternal':
					// Open external URL
					if (message.url) {
						vscode.env.openExternal(vscode.Uri.parse(message.url));
					}
					return;

				case 'openTerminal':
					// Delegate terminal execution to TerminalManager
					const { taskId, taskTitle } = data.data || data; // Handle both nested and direct data
					this.logger.log(
						`Webview openTerminal - taskId: ${taskId} (type: ${typeof taskId}), taskTitle: ${taskTitle}`
					);

					// Get current tag to ensure we're working in the right context
					let currentTag = 'master'; // default fallback
					if (this.mcpClient) {
						try {
							const tagsResult = await this.mcpClient.callTool('list_tags', {
								projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
								showMetadata: false
							});

							let parsedData;
							if (
								tagsResult?.content &&
								Array.isArray(tagsResult.content) &&
								tagsResult.content[0]?.text
							) {
								try {
									parsedData = JSON.parse(tagsResult.content[0].text);
									if (parsedData?.data?.currentTag) {
										currentTag = parsedData.data.currentTag;
									}
								} catch (e) {
									this.logger.warn(
										'Failed to parse tags response for terminal execution'
									);
								}
							}
						} catch (error) {
							this.logger.warn(
								'Failed to get current tag for terminal execution:',
								error
							);
						}
					}

					const result = await this.terminalManager.executeTask({
						taskId,
						taskTitle,
						tag: currentTag
					});

					response = result;

					// Show user feedback AFTER sending the response (like the working "TaskMaster connected!" example)
					setImmediate(() => {
						if (result.success) {
							// Success: Show info message
							vscode.window.showInformationMessage(
								`✅ Started Claude session for Task ${taskId}: ${taskTitle}`
							);
						} else {
							// Error: Show VS Code native error notification only
							const errorMsg = `Failed to start task: ${result.error}`;
							vscode.window.showErrorMessage(errorMsg);
						}
					});
					break;

				default:
					throw new Error(`Unknown message type: ${type}`);
			}

			// Send response
			if (requestId) {
				panel.webview.postMessage({
					type: 'response',
					requestId,
					success: true,
					data: response
				});
			}
		} catch (error) {
			this.logger.error(`Error handling message ${type}`, error);

			if (requestId) {
				panel.webview.postMessage({
					type: 'error',
					requestId,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	}

	private getWebviewContent(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'index.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'index.css')
		);
		const nonce = this.getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
	<link href="${styleUri}" rel="stylesheet">
	<title>TaskMaster Kanban</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private getNonce(): string {
		let text = '';
		const possible =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
