import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import * as vscode from 'vscode';

export interface MCPConfig {
	command: string;
	args: string[];
	cwd?: string;
	env?: Record<string, string>;
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
		console.log(
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
			console.log(
				`Starting MCP server: ${this.config.command} ${this.config.args?.join(' ') || ''}`
			);
			console.log('🔍 DEBUGGING: Transport config cwd:', this.config.cwd);
			console.log('🔍 DEBUGGING: Process cwd before spawn:', process.cwd());

			// Test if the target directory and .taskmaster exist
			const fs = require('fs');
			const path = require('path');
			try {
				const targetDir = this.config.cwd;
				const taskmasterDir = path.join(targetDir, '.taskmaster');
				const tasksFile = path.join(taskmasterDir, 'tasks', 'tasks.json');

				console.log(
					'🔍 DEBUGGING: Checking target directory:',
					targetDir,
					'exists:',
					fs.existsSync(targetDir)
				);
				console.log(
					'🔍 DEBUGGING: Checking .taskmaster dir:',
					taskmasterDir,
					'exists:',
					fs.existsSync(taskmasterDir)
				);
				console.log(
					'🔍 DEBUGGING: Checking tasks.json:',
					tasksFile,
					'exists:',
					fs.existsSync(tasksFile)
				);

				if (fs.existsSync(tasksFile)) {
					const stats = fs.statSync(tasksFile);
					console.log('🔍 DEBUGGING: tasks.json size:', stats.size, 'bytes');
				}
			} catch (error) {
				console.log('🔍 DEBUGGING: Error checking filesystem:', error);
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

			console.log('🔍 DEBUGGING: Transport created, checking process...');

			// Set up transport event handlers
			this.transport.onerror = (error: Error) => {
				console.error('❌ MCP transport error:', error);
				console.error('Transport error details:', {
					message: error.message,
					stack: error.stack,
					code: (error as any).code,
					errno: (error as any).errno,
					syscall: (error as any).syscall
				});
				this.status = { isRunning: false, error: error.message };
				vscode.window.showErrorMessage(
					`Task Master MCP transport error: ${error.message}`
				);
			};

			this.transport.onclose = () => {
				console.log('🔌 MCP transport closed');
				this.status = { isRunning: false };
				this.client = null;
				this.transport = null;
			};

			// Add message handler like the working debug script
			this.transport.onmessage = (message: any) => {
				console.log('📤 MCP server message:', message);
			};

			// Create the client
			this.client = new Client(
				{
					name: 'taskr-vscode-extension',
					version: '1.0.0'
				},
				{
					capabilities: {
						tools: {}
					}
				}
			);

			// Connect the client to the transport (this automatically starts the transport)
			console.log('🔄 Attempting MCP client connection...');
			console.log('MCP config:', {
				command: this.config.command,
				args: this.config.args,
				cwd: this.config.cwd
			});
			console.log('Current working directory:', process.cwd());
			console.log(
				'VS Code workspace folders:',
				vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
			);

			// Check if process was created before connecting
			if (this.transport && (this.transport as any).process) {
				const proc = (this.transport as any).process;
				console.log('📝 MCP server process PID:', proc.pid);
				console.log('📝 Process working directory will be:', this.config.cwd);

				proc.on('exit', (code: number, signal: string) => {
					console.log(
						`🔚 MCP server process exited with code ${code}, signal ${signal}`
					);
					if (code !== 0) {
						console.log('❌ Non-zero exit code indicates server failure');
					}
				});

				proc.on('error', (error: Error) => {
					console.log('❌ MCP server process error:', error);
				});

				// Listen to stderr to see server-side errors
				if (proc.stderr) {
					proc.stderr.on('data', (data: Buffer) => {
						console.log('📥 MCP server stderr:', data.toString());
					});
				}

				// Listen to stdout for server messages
				if (proc.stdout) {
					proc.stdout.on('data', (data: Buffer) => {
						console.log('📤 MCP server stdout:', data.toString());
					});
				}
			} else {
				console.log('⚠️ No process found in transport before connection');
			}

			await this.client.connect(this.transport);

			// Update status
			this.status = {
				isRunning: true,
				pid: this.transport.pid || undefined
			};

			console.log('MCP client connected successfully');
			vscode.window.showInformationMessage(
				'Task Master connected successfully'
			);
		} catch (error) {
			console.error('Failed to connect to MCP server:', error);
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
		console.log('Disconnecting from MCP server');

		if (this.client) {
			try {
				await this.client.close();
			} catch (error) {
				console.error('Error closing MCP client:', error);
			}
			this.client = null;
		}

		if (this.transport) {
			try {
				await this.transport.close();
			} catch (error) {
				console.error('Error closing MCP transport:', error);
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
			const result = await this.client.callTool({
				name: toolName,
				arguments: arguments_
			});

			return result;
		} catch (error) {
			console.error(`Error calling MCP tool "${toolName}":`, error);
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

			const result = await this.client.listTools();
			console.log(
				'Available MCP tools:',
				result.tools?.map((t) => t.name) || []
			);
			return true;
		} catch (error) {
			console.error('Connection test failed:', error);
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
	console.log(
		'🔍 DEBUGGING: createMCPConfigFromSettings called at',
		new Date().toISOString()
	);
	const config = vscode.workspace.getConfiguration('taskmaster');

	let command = config.get<string>('mcp.command', 'npx');
	const args = config.get<string[]>('mcp.args', [
		'-y',
		'--package=task-master-ai',
		'task-master-ai'
	]);

	// Use proper VS Code workspace detection
	const defaultCwd =
		vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	const cwd = config.get<string>('mcp.cwd', defaultCwd);
	const env = config.get<Record<string, string>>('mcp.env');

	console.log('✅ Using workspace directory:', defaultCwd);

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
					console.log(`✅ Using npx at: ${path}`);
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
		env
	};
}
