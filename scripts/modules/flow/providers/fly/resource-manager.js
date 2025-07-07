/**
 * @fileoverview Fly.io Resource Manager
 *
 * Handles resource lifecycle tracking, metrics collection, and data persistence
 * for Fly.io machines and execution logs.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Fly.io Resource Manager
 * Tracks machine resources, execution history, and metrics
 */
export class FlyResourceManager {
	constructor(config = {}) {
		this.config = config;
		this.dataDir = path.join('.taskmaster', 'flow', 'data', 'fly');
		this.resources = new Map();
		this.executions = new Map();
		this.metrics = {
			totalResources: 0,
			totalExecutions: 0,
			totalUptime: 0,
			totalCost: 0,
			createdToday: 0,
			executedToday: 0
		};

		this.ensureDataDirectory();
	}

	/**
	 * Ensure data directory exists
	 */
	async ensureDataDirectory() {
		try {
			await fs.mkdir(this.dataDir, { recursive: true });
		} catch (error) {
			console.warn(`Failed to create Fly.io data directory: ${error.message}`);
		}
	}

	/**
	 * Track a new machine resource
	 */
	async trackResource(resource) {
		try {
			const resourceData = {
				...resource,
				trackedAt: new Date().toISOString(),
				uptime: 0,
				totalExecutions: 0,
				lastActivity: new Date().toISOString(),
				cost: 0
			};

			this.resources.set(resource.id, resourceData);
			this.metrics.totalResources++;
			this.metrics.createdToday++;

			await this.persistResourceData(resource.id, resourceData);
			await this.updateMetrics();

			return resourceData;
		} catch (error) {
			console.warn(
				`Failed to track Fly.io resource ${resource.id}: ${error.message}`
			);
			throw error;
		}
	}

	/**
	 * Update existing resource
	 */
	async updateResource(resourceId, updates) {
		try {
			const resource = this.resources.get(resourceId);
			if (!resource) {
				throw new Error(`Resource ${resourceId} not found`);
			}

			const updatedResource = {
				...resource,
				...updates,
				updatedAt: new Date().toISOString(),
				lastActivity: new Date().toISOString()
			};

			// Calculate uptime if machine is running
			if (resource.status === 'ready' && updates.status !== 'stopped') {
				const uptimeHours = this.calculateUptime(resource.createdAt);
				updatedResource.uptime = uptimeHours;
				updatedResource.cost = this.calculateCost(
					uptimeHours,
					resource.region || 'ord'
				);
				this.metrics.totalUptime += uptimeHours;
				this.metrics.totalCost += updatedResource.cost - (resource.cost || 0);
			}

			this.resources.set(resourceId, updatedResource);
			await this.persistResourceData(resourceId, updatedResource);
			await this.updateMetrics();

			return updatedResource;
		} catch (error) {
			console.warn(
				`Failed to update Fly.io resource ${resourceId}: ${error.message}`
			);
			throw error;
		}
	}

	/**
	 * Remove resource tracking
	 */
	async untrackResource(resourceId) {
		try {
			const resource = this.resources.get(resourceId);
			if (resource) {
				// Final uptime and cost calculation
				if (resource.status === 'ready') {
					const finalUptime = this.calculateUptime(resource.createdAt);
					const finalCost = this.calculateCost(
						finalUptime,
						resource.region || 'ord'
					);
					this.metrics.totalUptime += finalUptime - (resource.uptime || 0);
					this.metrics.totalCost += finalCost - (resource.cost || 0);
				}

				this.resources.delete(resourceId);
				this.executions.delete(resourceId);

				// Archive resource data instead of deleting
				await this.archiveResourceData(resourceId, resource);
				await this.updateMetrics();
			}

			return true;
		} catch (error) {
			console.warn(
				`Failed to untrack Fly.io resource ${resourceId}: ${error.message}`
			);
			throw error;
		}
	}

	/**
	 * Log execution for a resource
	 */
	async logExecution(resourceId, execution) {
		try {
			if (!this.executions.has(resourceId)) {
				this.executions.set(resourceId, []);
			}

			const executionData = {
				...execution,
				timestamp: new Date().toISOString(),
				provider: 'fly'
			};

			this.executions.get(resourceId).push(executionData);
			this.metrics.totalExecutions++;
			this.metrics.executedToday++;

			// Update resource execution count
			const resource = this.resources.get(resourceId);
			if (resource) {
				resource.totalExecutions = (resource.totalExecutions || 0) + 1;
				resource.lastActivity = new Date().toISOString();
				this.resources.set(resourceId, resource);
				await this.persistResourceData(resourceId, resource);
			}

			await this.persistExecutionData(resourceId, executionData);
			await this.updateMetrics();

			return executionData;
		} catch (error) {
			console.warn(
				`Failed to log Fly.io execution for ${resourceId}: ${error.message}`
			);
			throw error;
		}
	}

	/**
	 * Get resource logs
	 */
	async getResourceLogs(resourceId, options = {}) {
		try {
			const executions = this.executions.get(resourceId) || [];

			let filteredLogs = executions.map((exec) => ({
				timestamp: exec.timestamp,
				level: exec.exitCode === 0 ? 'info' : 'error',
				message: `Executed ${exec.action}: ${exec.output || exec.stdout || 'No output'}`,
				provider: 'fly',
				execution: exec
			}));

			// Apply filters
			if (options.since) {
				const sinceDate = new Date(options.since);
				filteredLogs = filteredLogs.filter(
					(log) => new Date(log.timestamp) >= sinceDate
				);
			}

			if (options.level) {
				filteredLogs = filteredLogs.filter(
					(log) => log.level === options.level
				);
			}

			if (options.recent) {
				filteredLogs = filteredLogs.slice(-10);
			}

			if (options.limit) {
				filteredLogs = filteredLogs.slice(-options.limit);
			}

			return filteredLogs;
		} catch (error) {
			console.warn(
				`Failed to get logs for Fly.io resource ${resourceId}: ${error.message}`
			);
			return [];
		}
	}

	/**
	 * Get all tracked resources
	 */
	getResources() {
		return Array.from(this.resources.values());
	}

	/**
	 * Get resource by ID
	 */
	getResource(resourceId) {
		return this.resources.get(resourceId);
	}

	/**
	 * Get metrics summary
	 */
	getMetrics() {
		return {
			...this.metrics,
			activeResources: this.resources.size,
			provider: 'fly',
			lastUpdated: new Date().toISOString()
		};
	}

	/**
	 * Clean up old data
	 */
	async cleanup(olderThanDays = 30) {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

			let cleanedCount = 0;

			// Clean up archived resources
			const archiveDir = path.join(this.dataDir, 'archived');
			try {
				const files = await fs.readdir(archiveDir);
				for (const file of files) {
					if (file.endsWith('.json')) {
						const filePath = path.join(archiveDir, file);
						const stats = await fs.stat(filePath);
						if (stats.mtime < cutoffDate) {
							await fs.unlink(filePath);
							cleanedCount++;
						}
					}
				}
			} catch (error) {
				// Archive directory might not exist yet
			}

			// Clean up old execution logs
			for (const [resourceId, executions] of this.executions.entries()) {
				const filteredExecutions = executions.filter(
					(exec) => new Date(exec.timestamp) >= cutoffDate
				);
				if (filteredExecutions.length !== executions.length) {
					this.executions.set(resourceId, filteredExecutions);
					cleanedCount += executions.length - filteredExecutions.length;
				}
			}

			await this.updateMetrics();
			return { cleanedCount, cutoffDate: cutoffDate.toISOString() };
		} catch (error) {
			console.warn(`Failed to cleanup Fly.io data: ${error.message}`);
			throw error;
		}
	}

	// Private helper methods

	/**
	 * Calculate uptime in hours
	 */
	calculateUptime(createdAt) {
		const now = new Date();
		const created = new Date(createdAt);
		return (now.getTime() - created.getTime()) / (1000 * 60 * 60);
	}

	/**
	 * Calculate estimated cost based on uptime and region
	 */
	calculateCost(uptimeHours, region) {
		// Simplified cost calculation - Fly.io pricing varies by region
		const regionalMultipliers = {
			ord: 1.0, // Chicago (base)
			dfw: 1.0, // Dallas
			sea: 1.0, // Seattle
			sjc: 1.0, // San Jose
			ewr: 1.0, // Newark
			iad: 1.0, // Ashburn
			yyz: 1.1, // Toronto
			lhr: 1.1, // London
			ams: 1.1, // Amsterdam
			fra: 1.1, // Frankfurt
			nrt: 1.2, // Tokyo
			syd: 1.2, // Sydney
			hkg: 1.2, // Hong Kong
			sin: 1.2 // Singapore
		};

		const baseHourlyRate = 0.0000022; // $0.0000022 per hour for shared-cpu-1x
		const multiplier = regionalMultipliers[region] || 1.0;
		const hourlyRate = baseHourlyRate * multiplier;

		return Math.round(uptimeHours * hourlyRate * 1000000) / 1000000; // Round to 6 decimal places
	}

	/**
	 * Persist resource data to disk
	 */
	async persistResourceData(resourceId, resourceData) {
		try {
			const filePath = path.join(this.dataDir, `resource-${resourceId}.json`);
			await fs.writeFile(filePath, JSON.stringify(resourceData, null, 2));
		} catch (error) {
			console.warn(`Failed to persist Fly.io resource data: ${error.message}`);
		}
	}

	/**
	 * Persist execution data to disk
	 */
	async persistExecutionData(resourceId, executionData) {
		try {
			const fileName = `executions-${resourceId}.json`;
			const filePath = path.join(this.dataDir, fileName);

			let existingData = [];
			try {
				const content = await fs.readFile(filePath, 'utf-8');
				existingData = JSON.parse(content);
			} catch (error) {
				// File doesn't exist yet, start with empty array
			}

			existingData.push(executionData);

			// Keep only last 100 executions per resource
			if (existingData.length > 100) {
				existingData = existingData.slice(-100);
			}

			await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
		} catch (error) {
			console.warn(`Failed to persist Fly.io execution data: ${error.message}`);
		}
	}

	/**
	 * Archive resource data when resource is deleted
	 */
	async archiveResourceData(resourceId, resourceData) {
		try {
			const archiveDir = path.join(this.dataDir, 'archived');
			await fs.mkdir(archiveDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const fileName = `resource-${resourceId}-${timestamp}.json`;
			const filePath = path.join(archiveDir, fileName);

			const archiveData = {
				...resourceData,
				archivedAt: new Date().toISOString(),
				finalUptime: this.calculateUptime(resourceData.createdAt),
				finalCost: this.calculateCost(
					this.calculateUptime(resourceData.createdAt),
					resourceData.region || 'ord'
				)
			};

			await fs.writeFile(filePath, JSON.stringify(archiveData, null, 2));

			// Clean up active resource file
			const activeFilePath = path.join(
				this.dataDir,
				`resource-${resourceId}.json`
			);
			try {
				await fs.unlink(activeFilePath);
			} catch (error) {
				// File might not exist
			}
		} catch (error) {
			console.warn(`Failed to archive Fly.io resource data: ${error.message}`);
		}
	}

	/**
	 * Update and persist metrics
	 */
	async updateMetrics() {
		try {
			const today = new Date().toDateString();
			const lastUpdate = this.metrics.lastUpdate || '';

			// Reset daily counters if it's a new day
			if (lastUpdate !== today) {
				this.metrics.createdToday = 0;
				this.metrics.executedToday = 0;
				this.metrics.lastUpdate = today;
			}

			const metricsPath = path.join(this.dataDir, 'metrics.json');
			await fs.writeFile(metricsPath, JSON.stringify(this.metrics, null, 2));
		} catch (error) {
			console.warn(`Failed to update Fly.io metrics: ${error.message}`);
		}
	}

	/**
	 * Load persisted data on startup
	 */
	async loadPersistedData() {
		try {
			// Load metrics
			const metricsPath = path.join(this.dataDir, 'metrics.json');
			try {
				const metricsData = await fs.readFile(metricsPath, 'utf-8');
				this.metrics = { ...this.metrics, ...JSON.parse(metricsData) };
			} catch (error) {
				// Metrics file doesn't exist yet
			}

			// Load active resources
			const files = await fs.readdir(this.dataDir);
			for (const file of files) {
				if (
					file.startsWith('resource-') &&
					file.endsWith('.json') &&
					!file.includes('executions-')
				) {
					const resourceId = file.replace('resource-', '').replace('.json', '');
					const filePath = path.join(this.dataDir, file);
					try {
						const resourceData = JSON.parse(
							await fs.readFile(filePath, 'utf-8')
						);
						this.resources.set(resourceId, resourceData);
					} catch (error) {
						console.warn(
							`Failed to load Fly.io resource ${resourceId}: ${error.message}`
						);
					}
				}
			}

			// Load execution logs
			for (const file of files) {
				if (file.startsWith('executions-') && file.endsWith('.json')) {
					const resourceId = file
						.replace('executions-', '')
						.replace('.json', '');
					const filePath = path.join(this.dataDir, file);
					try {
						const executionData = JSON.parse(
							await fs.readFile(filePath, 'utf-8')
						);
						this.executions.set(resourceId, executionData);
					} catch (error) {
						console.warn(
							`Failed to load Fly.io executions for ${resourceId}: ${error.message}`
						);
					}
				}
			}
		} catch (error) {
			console.warn(`Failed to load persisted Fly.io data: ${error.message}`);
		}
	}
}
