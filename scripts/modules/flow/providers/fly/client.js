/**
 * @fileoverview Fly.io API Client
 *
 * Handles communication with Fly.io's Machines API for machine management.
 * Provides machine lifecycle management and command execution.
 */

import { FlyConnectionError, FlyError } from './errors.js';

/**
 * Fly.io API Client
 * Manages authentication and API communication
 */
export class FlyClient {
	constructor(config) {
		this.config = config;
		this.baseUrl = config.baseUrl || 'https://api.machines.dev';
		this.apiKey = config.apiKey;
		this.timeout = config.timeout || 60000;
	}

	/**
	 * Make authenticated HTTP request
	 */
	async makeRequest(endpoint, options = {}) {
		const url = `${this.baseUrl}${endpoint}`;
		const config = {
			timeout: this.timeout,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		};

		try {
			const response = await fetch(url, config);

			if (!response.ok) {
				const errorText = await response.text();
				throw new FlyConnectionError({
					code: `HTTP_${response.status}`,
					message: `HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
					category: 'connection',
					details: {
						status: response.status,
						statusText: response.statusText,
						url,
						body: errorText
					}
				});
			}

			return await response.json();
		} catch (error) {
			if (error instanceof FlyConnectionError) {
				throw error;
			}

			throw new FlyConnectionError({
				code: 'NETWORK_ERROR',
				message: `Network request failed: ${error.message}`,
				category: 'connection',
				details: { url, originalError: error }
			});
		}
	}

	/**
	 * List all apps
	 */
	async listApps() {
		return this.makeRequest('/v1/apps');
	}

	/**
	 * Create a new machine
	 */
	async createMachine(config) {
		const { appName = 'task-master', ...machineConfig } = config;

		return this.makeRequest(`/v1/apps/${appName}/machines`, {
			method: 'POST',
			body: JSON.stringify(machineConfig)
		});
	}

	/**
	 * Get machine status
	 */
	async getMachineStatus(machineId) {
		return this.makeRequest(`/v1/machines/${machineId}`);
	}

	/**
	 * Stop a machine
	 */
	async stopMachine(machineId) {
		return this.makeRequest(`/v1/machines/${machineId}/stop`, {
			method: 'POST'
		});
	}

	/**
	 * Start a machine
	 */
	async startMachine(machineId) {
		return this.makeRequest(`/v1/machines/${machineId}/start`, {
			method: 'POST'
		});
	}

	/**
	 * Delete a machine
	 */
	async deleteMachine(machineId) {
		return this.makeRequest(`/v1/machines/${machineId}`, {
			method: 'DELETE'
		});
	}

	/**
	 * Execute command on machine
	 */
	async execCommand(machineId, command) {
		return this.makeRequest(`/v1/machines/${machineId}/exec`, {
			method: 'POST',
			body: JSON.stringify(command)
		});
	}

	/**
	 * Get machine logs
	 */
	async getMachineLogs(machineId, options = {}) {
		const params = new URLSearchParams();
		if (options.since) params.append('since', options.since);
		if (options.until) params.append('until', options.until);
		if (options.lines) params.append('lines', options.lines);

		const query = params.toString();
		const endpoint = `/v1/machines/${machineId}/logs${query ? `?${query}` : ''}`;

		return this.makeRequest(endpoint);
	}

	/**
	 * Stream machine logs (simplified implementation)
	 */
	async streamMachineLogs(machineId, callback) {
		try {
			// For simplicity, poll logs every second
			// In a real implementation, this would use WebSockets or Server-Sent Events
			let lastTimestamp = new Date().toISOString();

			const pollLogs = async () => {
				try {
					const logs = await this.getMachineLogs(machineId, {
						since: lastTimestamp
					});

					if (logs && logs.length > 0) {
						logs.forEach((log) => {
							callback({
								timestamp: log.timestamp || new Date().toISOString(),
								level: log.level || 'info',
								message: log.message || log.log || '',
								source: 'fly-machine',
								machineId
							});
						});

						// Update timestamp for next poll
						const lastLog = logs[logs.length - 1];
						if (lastLog.timestamp) {
							lastTimestamp = lastLog.timestamp;
						}
					}
				} catch (error) {
					callback({
						timestamp: new Date().toISOString(),
						level: 'error',
						message: `Log streaming error: ${error.message}`,
						source: 'fly-client',
						machineId
					});
				}
			};

			// Start polling
			const interval = setInterval(pollLogs, 1000);

			// Return cleanup function
			return () => {
				clearInterval(interval);
			};
		} catch (error) {
			throw new FlyError({
				code: 'STREAM_SETUP_FAILED',
				message: `Failed to setup log streaming: ${error.message}`,
				category: 'resource',
				details: { machineId, originalError: error }
			});
		}
	}
}

/**
 * Fly Machine wrapper
 * Represents a single Fly machine instance
 */
export class FlyMachine {
	constructor(client, machineData) {
		this.client = client;
		this.id = machineData.id;
		this.name = machineData.name;
		this.state = machineData.state;
		this.region = machineData.region;
		this.config = machineData.config;
		this.createdAt = machineData.created_at;
		this.updatedAt = machineData.updated_at;
	}

	/**
	 * Get current machine status
	 */
	async getStatus() {
		const status = await this.client.getMachineStatus(this.id);
		this.state = status.state;
		this.updatedAt = status.updated_at;
		return status;
	}

	/**
	 * Start the machine
	 */
	async start() {
		const result = await this.client.startMachine(this.id);
		this.state = 'starting';
		return result;
	}

	/**
	 * Stop the machine
	 */
	async stop() {
		const result = await this.client.stopMachine(this.id);
		this.state = 'stopping';
		return result;
	}

	/**
	 * Delete the machine
	 */
	async delete() {
		return this.client.deleteMachine(this.id);
	}

	/**
	 * Execute command on machine
	 */
	async exec(command) {
		return this.client.execCommand(this.id, command);
	}

	/**
	 * Get machine logs
	 */
	async getLogs(options = {}) {
		return this.client.getMachineLogs(this.id, options);
	}

	/**
	 * Stream machine logs
	 */
	async streamLogs(callback) {
		return this.client.streamMachineLogs(this.id, callback);
	}

	/**
	 * Wait for machine to reach desired state
	 */
	async waitForState(desiredState, timeout = 60000) {
		const startTime = Date.now();

		while (Date.now() - startTime < timeout) {
			const status = await this.getStatus();

			if (status.state === desiredState) {
				return status;
			}

			if (status.state === 'failed' && desiredState !== 'failed') {
				throw new FlyError({
					code: 'MACHINE_FAILED',
					message: `Machine ${this.id} failed to reach state ${desiredState}`,
					category: 'resource',
					details: {
						machineId: this.id,
						currentState: status.state,
						desiredState
					}
				});
			}

			// Wait 2 seconds before checking again
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		throw new FlyError({
			code: 'STATE_TIMEOUT',
			message: `Machine ${this.id} did not reach state ${desiredState} within ${timeout}ms`,
			category: 'resource',
			details: {
				machineId: this.id,
				currentState: this.state,
				desiredState,
				timeout
			}
		});
	}

	/**
	 * Get machine information as object
	 */
	toJSON() {
		return {
			id: this.id,
			name: this.name,
			state: this.state,
			region: this.region,
			config: this.config,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt
		};
	}
}

/**
 * Create Fly.io client instance
 */
export async function createFlyClient(config) {
	const client = new FlyClient(config);

	// Test connection by listing apps
	try {
		await client.listApps();
		return client;
	} catch (error) {
		throw new FlyConnectionError({
			code: 'CLIENT_INITIALIZATION_FAILED',
			message: `Failed to initialize Fly.io client: ${error.message}`,
			category: 'connection',
			details: { originalError: error }
		});
	}
}
