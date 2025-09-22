import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from './logger';

export interface MCPConfig {
	command: string;
	args: string[];
	cwd?: string;
	env?: Record<string, string>;
	timeout?: number;
}

export interface MCPServerStatus {
	isRunning: boolean;
	pid?: number;
	error?: string;
}

export class MCPClientManager {
	private client: Client | null = null;
	private transport: StdioClientTransport | null = null;
	private config: MCPConfig;
	private status: MCPServerStatus = { isRunning: false };
	private connectionPromise: Promise<void> | null = null;

	constructor(config: MCPConfig) {
		logger.log(
			'🔍 DEBUGGING: MCPClientManager constructor called with config:',
			config
		);
		this.config = config;
	}

	/**
	 * Get the current server status
	 */
	getStatus(): MCPServerStatus {
		return { ...this.status };
	}

	/**
	 * Start the MCP server process and establish client connection
	 */
	async connect(): Promise<void> {
		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		this.connectionPromise = this._doConnect();
		return this.connectionPromise;
	}

	private async _doConnect(): Promise<void> {
		try {
			// Clean up any existing connections
			await this.disconnect();

			// Create the transport - it will handle spawning the server process internally
			logger.log(
				`Starting MCP server: ${this.config.command} ${this.config.args?.join(' ') || ''}`
			);
			logger.log('🔍 DEBUGGING: Transport config cwd:', this.config.cwd);
			logger.log('🔍 DEBUGGING: Process cwd before spawn:', process.cwd());

			// Test if the target directory and .taskmaster exist
			const fs = require('fs');
			const path = require('path');
			try {
				const targetDir = this.config.cwd;
				const taskmasterDir = path.join(targetDir, '.taskmaster');
				const tasksFile = path.join(taskmasterDir, 'tasks', 'tasks.json');

				logger.log(
					'🔍 DEBUGGING: Checking target directory:',
					targetDir,
					'exists:',
					fs.existsSync(targetDir)
				);
				logger.log(
					'🔍 DEBUGGING: Checking .taskmaster dir:',
					taskmasterDir,
					'exists:',
					fs.existsSync(taskmasterDir)
				);
				logger.log(
					'🔍 DEBUGGING: Checking tasks.json:',
					tasksFile,
					'exists:',
					fs.existsSync(tasksFile)
				);

				if (fs.existsSync(tasksFile)) {
					const stats = fs.statSync(tasksFile);
					logger.log('🔍 DEBUGGING: tasks.json size:', stats.size, 'bytes');
				}
			} catch (error) {
				logger.log('🔍 DEBUGGING: Error checking filesystem:', error);
			}

			this.transport = new StdioClientTransport({
				command: this.config.command,
				args: this.config.args || [],
				cwd: this.config.cwd,
				env: {
					...(Object.fromEntries(
						Object.entries(process.env).filter(([, v]) => v !== undefined)
					) as Record<string, string>),
					...this.config.env
				}
			});

			logger.log('🔍 DEBUGGING: Transport created, checking process...');

			// Set up transport event handlers
			this.transport.onerror = (error: Error) => {
				logger.error('❌ MCP transport error:', error);
				logger.error('Transport error details:', {
					message: error.message,
					stack: error.stack,
					code: (error as any).code,
					errno: (error as any).errno,
					syscall: (error as any).syscall
				});
				this.status = { isRunning: false, error: error.message };
				vscode.window.showErrorMessage(
					`TaskMaster MCP transport error: ${error.message}`
				);
			};

			this.transport.onclose = () => {
				logger.log('🔌 MCP transport closed');
				this.status = { isRunning: false };
				this.client = null;
				this.transport = null;
			};

			// Add message handler like the working debug script
			this.transport.onmessage = (message: any) => {
				logger.log('📤 MCP server message:', message);
			};

			// Create the client
			this.client = new Client(
				{
					name: 'task-master-vscode-extension',
					version: '1.0.0'
				},
				{
					capabilities: {
						tools: {}
					}
				}
			);

			// Connect the client to the transport (this automatically starts the transport)
			logger.log('🔄 Attempting MCP client connection...');
			logger.log('MCP config:', {
				command: this.config.command,
				args: this.config.args,
				cwd: this.config.cwd
			});
			logger.log('Current working directory:', process.cwd());
			logger.log(
				'VS Code workspace folders:',
				vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
			);

			// Check if process was created before connecting
			if (this.transport && (this.transport as any).process) {
				const proc = (this.transport as any).process;
				logger.log('📝 MCP server process PID:', proc.pid);
				logger.log('📝 Process working directory will be:', this.config.cwd);

				proc.on('exit', (code: number, signal: string) => {
					logger.log(
						`🔚 MCP server process exited with code ${code}, signal ${signal}`
					);
					if (code !== 0) {
						logger.log('❌ Non-zero exit code indicates server failure');
					}
				});

				proc.on('error', (error: Error) => {
					logger.log('❌ MCP server process error:', error);
				});

				// Listen to stderr to see server-side errors
				if (proc.stderr) {
					proc.stderr.on('data', (data: Buffer) => {
						logger.log('📥 MCP server stderr:', data.toString());
					});
				}

				// Listen to stdout for server messages
				if (proc.stdout) {
					proc.stdout.on('data', (data: Buffer) => {
						logger.log('📤 MCP server stdout:', data.toString());
					});
				}
			} else {
				logger.log('⚠️ No process found in transport before connection');
			}

			await this.client.connect(this.transport);

			// Update status
			this.status = {
				isRunning: true,
				pid: this.transport.pid || undefined
			};

			logger.log('MCP client connected successfully');

			// Log Task Master version information after successful connection
			try {
				const versionResult = await this.callTool('get_tasks', {});
				if (versionResult?.content?.[0]?.text) {
					const response = JSON.parse(versionResult.content[0].text);
					if (response?.version) {
						logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
						logger.log('✅ Task Master MCP Server Connected');
						logger.log(`   Version: ${response.version.version || 'unknown'}`);
						logger.log(
							`   Package: ${response.version.name || 'task-master-ai'}`
						);
						if (response.tag) {
							logger.log(
								`   Current Tag: ${response.tag.currentTag || 'master'}`
							);
						}
						logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
					}
				}
			} catch (versionError) {
				logger.log('Note: Could not retrieve Task Master version information');
			}
		} catch (error) {
			logger.error('Failed to connect to MCP server:', error);
			this.status = {
				isRunning: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};

			// Clean up on error
			await this.disconnect();

			throw error;
		} finally {
			this.connectionPromise = null;
		}
	}

	/**
	 * Disconnect from the MCP server and clean up resources
	 */
	async disconnect(): Promise<void> {
		logger.log('Disconnecting from MCP server');

		if (this.client) {
			try {
				await this.client.close();
			} catch (error) {
				logger.error('Error closing MCP client:', error);
			}
			this.client = null;
		}

		if (this.transport) {
			try {
				await this.transport.close();
			} catch (error) {
				logger.error('Error closing MCP transport:', error);
			}
			this.transport = null;
		}

		this.status = { isRunning: false };
	}

	/**
	 * Get the MCP client instance (if connected)
	 */
	getClient(): Client | null {
		return this.client;
	}

	/**
	 * Call an MCP tool
	 */
	async callTool(
		toolName: string,
		arguments_: Record<string, unknown>
	): Promise<any> {
		if (!this.client) {
			throw new Error('MCP client is not connected');
		}

		try {
			// Use the configured timeout or default to 5 minutes
			const timeout = this.config.timeout || 300000; // 5 minutes default

			logger.log(`Calling MCP tool "${toolName}" with timeout: ${timeout}ms`);

			const result = await this.client.callTool(
				{
					name: toolName,
					arguments: arguments_
				},
				undefined,
				{
					timeout: timeout
				}
			);

			return result;
		} catch (error) {
			logger.error(`Error calling MCP tool "${toolName}":`, error);
			throw error;
		}
	}

	/**
	 * Test the connection by calling a simple MCP tool
	 */
	async testConnection(): Promise<boolean> {
		try {
			// Try to list available tools as a connection test
			if (!this.client) {
				return false;
			}

			// listTools is a simple metadata request, no need for extended timeout
			const result = await this.client.listTools();
			logger.log(
				'Available MCP tools:',
				result.tools?.map((t) => t.name) || []
			);

			// Try to get version information by calling a simple tool
			// The get_tasks tool is lightweight and returns version info
			try {
				const versionResult = await this.callTool('get_tasks', {});
				if (versionResult?.content?.[0]?.text) {
					// Parse the response to extract version info
					const response = JSON.parse(versionResult.content[0].text);
					if (response?.version) {
						logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
						logger.log('📦 Task Master MCP Server Connected');
						logger.log(`   Version: ${response.version.version || 'unknown'}`);
						logger.log(
							`   Package: ${response.version.name || 'task-master-ai'}`
						);
						if (response.tag) {
							logger.log(
								`   Current Tag: ${response.tag.currentTag || 'master'}`
							);
						}
						logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
					}
				}
			} catch (versionError) {
				// Don't fail the connection test if we can't get version info
				logger.log('Could not retrieve Task Master version information');
			}

			return true;
		} catch (error) {
			logger.error('Connection test failed:', error);
			return false;
		}
	}

	/**
	 * Get stderr stream from the transport (if available)
	 */
	getStderr(): NodeJS.ReadableStream | null {
		const stderr = this.transport?.stderr;
		return stderr ? (stderr as unknown as NodeJS.ReadableStream) : null;
	}

	/**
	 * Get the process ID of the spawned server
	 */
	getPid(): number | null {
		return this.transport?.pid || null;
	}
}

/**
 * Create MCP configuration from VS Code settings
 */
export function createMCPConfigFromSettings(): MCPConfig {
	logger.log(
		'🔍 DEBUGGING: createMCPConfigFromSettings called at',
		new Date().toISOString()
	);
	const config = vscode.workspace.getConfiguration('taskmaster');

	let command = config.get<string>('mcp.command', 'node');
	let args = config.get<string[]>('mcp.args', []);

	// If using default settings, use the bundled MCP server
	if (command === 'node' && args.length === 0) {
		try {
			// Try to resolve the bundled MCP server
			const taskMasterPath = require.resolve('task-master-ai');
			const mcpServerPath = path.resolve(
				path.dirname(taskMasterPath),
				'./dist/mcp-server.js'
			);

			// Verify the server file exists
			const fs = require('fs');
			if (!fs.existsSync(mcpServerPath)) {
				throw new Error('MCP server file not found at: ' + mcpServerPath);
			}

			args = [mcpServerPath];
			logger.log(`📦 Using bundled MCP server at: ${mcpServerPath}`);
		} catch (error) {
			logger.error('❌ Could not find bundled task-master-ai server:', error);
			// Fallback to npx
			command = 'npx';
			args = ['-y', 'task-master-ai'];
		}
	}

	// Use proper VS Code workspace detection
	const defaultCwd =
		vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	const cwd = config.get<string>('mcp.cwd', defaultCwd);
	const env = config.get<Record<string, string>>('mcp.env');
	const timeout = config.get<number>('mcp.requestTimeoutMs', 300000);

	logger.log('✅ Using workspace directory:', defaultCwd);

	// If using default 'npx', try to find the full path on macOS/Linux
	if (command === 'npx') {
		const fs = require('fs');
		const npxPaths = [
			'/opt/homebrew/bin/npx', // Homebrew on Apple Silicon
			'/usr/local/bin/npx', // Homebrew on Intel
			'/usr/bin/npx', // System npm
			'npx' // Final fallback to PATH
		];

		for (const path of npxPaths) {
			try {
				if (path === 'npx' || fs.existsSync(path)) {
					command = path;
					logger.log(`✅ Using npx at: ${path}`);
					break;
				}
			} catch (error) {
				// Continue to next path
			}
		}
	}

	return {
		command,
		args,
		cwd: cwd || defaultCwd,
		env,
		timeout
	};
}
