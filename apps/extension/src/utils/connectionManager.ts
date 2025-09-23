import * as vscode from 'vscode';
import { logger } from './logger';
import {
	MCPClientManager,
	type MCPConfig,
	type MCPServerStatus
} from './mcpClient';

export interface ConnectionEvent {
	type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
	timestamp: Date;
	data?: any;
}

export interface ConnectionHealth {
	isHealthy: boolean;
	lastSuccessfulCall?: Date;
	consecutiveFailures: number;
	averageResponseTime: number;
	uptime: number;
}

export class ConnectionManager {
	private mcpClient: MCPClientManager | null = null;
	private config: MCPConfig;
	private connectionEvents: ConnectionEvent[] = [];
	private health: ConnectionHealth = {
		isHealthy: false,
		consecutiveFailures: 0,
		averageResponseTime: 0,
		uptime: 0
	};
	private startTime: Date | null = null;
	private healthCheckInterval: NodeJS.Timeout | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectBackoffMs = 1000; // Start with 1 second
	private maxBackoffMs = 30000; // Max 30 seconds
	private isReconnecting = false;

	// Event handlers
	private onConnectionChange?: (
		status: MCPServerStatus,
		health: ConnectionHealth
	) => void;
	private onConnectionEvent?: (event: ConnectionEvent) => void;

	constructor(config: MCPConfig) {
		this.config = config;
		this.mcpClient = new MCPClientManager(config);
	}

	/**
	 * Set event handlers
	 */
	setEventHandlers(handlers: {
		onConnectionChange?: (
			status: MCPServerStatus,
			health: ConnectionHealth
		) => void;
		onConnectionEvent?: (event: ConnectionEvent) => void;
	}) {
		this.onConnectionChange = handlers.onConnectionChange;
		this.onConnectionEvent = handlers.onConnectionEvent;
	}

	/**
	 * Connect with automatic retry and health monitoring
	 */
	async connect(): Promise<void> {
		try {
			if (!this.mcpClient) {
				throw new Error('MCP client not initialized');
			}

			this.logEvent({ type: 'reconnecting', timestamp: new Date() });

			await this.mcpClient.connect();

			this.reconnectAttempts = 0;
			this.reconnectBackoffMs = 1000;
			this.isReconnecting = false;
			this.startTime = new Date();

			this.updateHealth();
			this.startHealthMonitoring();

			this.logEvent({ type: 'connected', timestamp: new Date() });

			logger.log('Connection manager: Successfully connected');
		} catch (error) {
			this.logEvent({
				type: 'error',
				timestamp: new Date(),
				data: {
					error: error instanceof Error ? error.message : 'Unknown error'
				}
			});

			await this.handleConnectionFailure(error);
			throw error;
		}
	}

	/**
	 * Disconnect and stop health monitoring
	 */
	async disconnect(): Promise<void> {
		this.stopHealthMonitoring();
		this.isReconnecting = false;

		if (this.mcpClient) {
			await this.mcpClient.disconnect();
		}

		this.health.isHealthy = false;
		this.startTime = null;

		this.logEvent({ type: 'disconnected', timestamp: new Date() });

		this.notifyConnectionChange();
	}

	/**
	 * Get current connection status
	 */
	getStatus(): MCPServerStatus {
		return this.mcpClient?.getStatus() || { isRunning: false };
	}

	/**
	 * Get connection health metrics
	 */
	getHealth(): ConnectionHealth {
		this.updateHealth();
		return { ...this.health };
	}

	/**
	 * Get recent connection events
	 */
	getEvents(limit = 10): ConnectionEvent[] {
		return this.connectionEvents.slice(-limit);
	}

	/**
	 * Test connection with performance monitoring
	 */
	async testConnection(): Promise<{
		success: boolean;
		responseTime: number;
		error?: string;
	}> {
		if (!this.mcpClient) {
			return {
				success: false,
				responseTime: 0,
				error: 'Client not initialized'
			};
		}

		const startTime = Date.now();

		try {
			const success = await this.mcpClient.testConnection();
			const responseTime = Date.now() - startTime;

			if (success) {
				this.health.lastSuccessfulCall = new Date();
				this.health.consecutiveFailures = 0;
				this.updateAverageResponseTime(responseTime);
			} else {
				this.health.consecutiveFailures++;
			}

			this.updateHealth();
			this.notifyConnectionChange();

			return { success, responseTime };
		} catch (error) {
			const responseTime = Date.now() - startTime;
			this.health.consecutiveFailures++;
			this.updateHealth();
			this.notifyConnectionChange();

			return {
				success: false,
				responseTime,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Call MCP tool with automatic retry and health monitoring
	 */
	async callTool(
		toolName: string,
		arguments_: Record<string, unknown>
	): Promise<any> {
		if (!this.mcpClient) {
			throw new Error('MCP client not initialized');
		}

		const startTime = Date.now();

		try {
			const result = await this.mcpClient.callTool(toolName, arguments_);
			const responseTime = Date.now() - startTime;

			this.health.lastSuccessfulCall = new Date();
			this.health.consecutiveFailures = 0;
			this.updateAverageResponseTime(responseTime);
			this.updateHealth();
			this.notifyConnectionChange();

			return result;
		} catch (error) {
			this.health.consecutiveFailures++;
			this.updateHealth();

			// Attempt reconnection if connection seems lost
			if (this.health.consecutiveFailures >= 3 && !this.isReconnecting) {
				logger.log(
					'Multiple consecutive failures detected, attempting reconnection...'
				);
				this.reconnectWithBackoff().catch((err) => {
					logger.error('Reconnection failed:', err);
				});
			}

			this.notifyConnectionChange();
			throw error;
		}
	}

	/**
	 * Update configuration and reconnect
	 */
	async updateConfig(newConfig: MCPConfig): Promise<void> {
		this.config = newConfig;

		await this.disconnect();
		this.mcpClient = new MCPClientManager(newConfig);

		// Attempt to reconnect with new config
		try {
			await this.connect();
		} catch (error) {
			logger.error('Failed to connect with new configuration:', error);
		}
	}

	/**
	 * Start health monitoring
	 */
	private startHealthMonitoring(): void {
		this.stopHealthMonitoring();

		this.healthCheckInterval = setInterval(async () => {
			try {
				await this.testConnection();
			} catch (error) {
				logger.error('Health check failed:', error);
			}
		}, 15000); // Check every 15 seconds
	}

	/**
	 * Stop health monitoring
	 */
	private stopHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}
	}

	/**
	 * Handle connection failure with exponential backoff
	 */
	private async handleConnectionFailure(error: any): Promise<void> {
		this.health.consecutiveFailures++;
		this.updateHealth();
		this.notifyConnectionChange();

		if (
			this.reconnectAttempts < this.maxReconnectAttempts &&
			!this.isReconnecting
		) {
			await this.reconnectWithBackoff();
		}
	}

	/**
	 * Reconnect with exponential backoff
	 */
	private async reconnectWithBackoff(): Promise<void> {
		if (this.isReconnecting) {
			return;
		}

		this.isReconnecting = true;
		this.reconnectAttempts++;

		const backoffMs = Math.min(
			this.reconnectBackoffMs * 2 ** (this.reconnectAttempts - 1),
			this.maxBackoffMs
		);

		logger.log(
			`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffMs}ms...`
		);

		await new Promise((resolve) => setTimeout(resolve, backoffMs));

		try {
			await this.connect();
		} catch (error) {
			logger.error(
				`Reconnection attempt ${this.reconnectAttempts} failed:`,
				error
			);

			if (this.reconnectAttempts >= this.maxReconnectAttempts) {
				this.isReconnecting = false;
				vscode.window.showErrorMessage(
					`Failed to reconnect to Task Master after ${this.maxReconnectAttempts} attempts. Please check your configuration and try manually reconnecting.`
				);
			} else {
				// Try again
				await this.reconnectWithBackoff();
			}
		}
	}

	/**
	 * Update health metrics
	 */
	private updateHealth(): void {
		const status = this.getStatus();
		this.health.isHealthy =
			status.isRunning && this.health.consecutiveFailures < 3;

		if (this.startTime) {
			this.health.uptime = Date.now() - this.startTime.getTime();
		}
	}

	/**
	 * Update average response time
	 */
	private updateAverageResponseTime(responseTime: number): void {
		// Simple moving average calculation
		if (this.health.averageResponseTime === 0) {
			this.health.averageResponseTime = responseTime;
		} else {
			this.health.averageResponseTime =
				this.health.averageResponseTime * 0.8 + responseTime * 0.2;
		}
	}

	/**
	 * Log connection event
	 */
	private logEvent(event: ConnectionEvent): void {
		this.connectionEvents.push(event);

		// Keep only last 100 events
		if (this.connectionEvents.length > 100) {
			this.connectionEvents = this.connectionEvents.slice(-100);
		}

		if (this.onConnectionEvent) {
			this.onConnectionEvent(event);
		}
	}

	/**
	 * Notify connection change
	 */
	private notifyConnectionChange(): void {
		if (this.onConnectionChange) {
			this.onConnectionChange(this.getStatus(), this.getHealth());
		}
	}
}
