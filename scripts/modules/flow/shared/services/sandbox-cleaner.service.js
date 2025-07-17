import { AgentsConfigManager } from '../config/managers/agents-config-manager.js';

export class SandboxCleaner {
	constructor() {
		this.configService = new AgentsConfigManager();
		this.cleanupTimer = null;
		this.checkInterval = 30 * 60 * 1000; // 30 minutes
		this.isRunning = false;
	}

	async start() {
		if (this.isRunning) {
			console.warn('Sandbox cleaner is already running');
			return;
		}

		this.isRunning = true;
		console.log('Starting sandbox cleaner service...');

		// Initial cleanup
		await this.cleanupOldSandboxes();

		// Start periodic cleanup
		this.cleanupTimer = setInterval(async () => {
			await this.cleanupOldSandboxes();
		}, this.checkInterval);

		console.log(
			`Sandbox cleaner started. Checking every ${this.checkInterval / 1000 / 60} minutes.`
		);
	}

	async cleanupOldSandboxes() {
		if (!process.env.E2B_API_KEY) {
			console.warn('E2B_API_KEY not found. Skipping sandbox cleanup.');
			return;
		}

		try {
			const config = await this.configService.loadConfig();
			const maxAgeHours = config.sandbox?.autoCleanupHours || 4;
			const warnMinutes = config.sandbox?.warnBeforeCleanupMinutes || 30;

			// Get orphaned sandboxes from tracking
			const orphanedSandboxes = await this.configService.getOrphanedSandboxes();

			if (orphanedSandboxes.length === 0) {
				console.log('No orphaned sandboxes found during cleanup check');
				return;
			}

			console.log(
				`Found ${orphanedSandboxes.length} orphaned sandboxes to evaluate`
			);

			for (const sandbox of orphanedSandboxes) {
				const ageHours =
					(new Date() - new Date(sandbox.createdAt)) / (1000 * 60 * 60);

				if (ageHours > maxAgeHours) {
					// Time to clean up
					const killed = await this.killE2BSandbox(sandbox.sandboxId);
					if (killed) {
						await this.configService.markSandboxCleaned(sandbox.sandboxId);
						console.log(
							`✅ Cleaned up orphaned sandbox: ${sandbox.sandboxId} (age: ${ageHours.toFixed(1)}h)`
						);
					} else {
						console.warn(`❌ Failed to cleanup sandbox: ${sandbox.sandboxId}`);
					}
				} else if (ageHours > maxAgeHours - warnMinutes / 60) {
					// Warn about upcoming cleanup
					const remainingMinutes = ((maxAgeHours - ageHours) * 60).toFixed(0);
					console.warn(
						`⚠️  Sandbox ${sandbox.sandboxId} will be cleaned up in ${remainingMinutes} minutes`
					);
				}
			}

			// Also check for any E2B sandboxes that aren't in our tracking
			await this.cleanupUntracked();
		} catch (error) {
			console.error('Error during sandbox cleanup:', error);
		}
	}

	async cleanupUntracked() {
		try {
			// Get all E2B sandboxes
			const response = await fetch('https://api.e2b.dev/sandboxes', {
				method: 'GET',
				headers: {
					'X-API-Key': process.env.E2B_API_KEY,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				console.warn('Failed to fetch E2B sandboxes for untracked cleanup');
				return;
			}

			const sandboxes = await response.json();
			const config = await this.configService.loadConfig();
			const trackedSandboxes = Object.keys(config.tracking.sandboxHistory);

			// Find sandboxes that exist in E2B but not in our tracking
			const untrackedSandboxes = sandboxes.filter(
				(sandbox) => !trackedSandboxes.includes(sandbox.sandboxID)
			);

			if (untrackedSandboxes.length > 0) {
				console.log(
					`Found ${untrackedSandboxes.length} untracked E2B sandboxes`
				);

				// Clean up very old untracked sandboxes (older than 6 hours)
				const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

				for (const sandbox of untrackedSandboxes) {
					const createdAt = new Date(sandbox.createdAt);
					if (createdAt < sixHoursAgo) {
						const killed = await this.killE2BSandbox(sandbox.sandboxID);
						if (killed) {
							console.log(
								`✅ Cleaned up untracked sandbox: ${sandbox.sandboxID}`
							);
						}
					}
				}
			}
		} catch (error) {
			console.error('Error cleaning up untracked sandboxes:', error);
		}
	}

	async killE2BSandbox(sandboxId) {
		try {
			const response = await fetch(
				`https://api.e2b.dev/sandboxes/${sandboxId}`,
				{
					method: 'DELETE',
					headers: {
						'X-API-Key': process.env.E2B_API_KEY,
						'Content-Type': 'application/json'
					}
				}
			);

			if (response.ok) {
				return true;
			} else if (response.status === 404) {
				// Sandbox already deleted
				console.log(`Sandbox ${sandboxId} already deleted`);
				return true;
			} else {
				console.error(
					`Failed to delete sandbox ${sandboxId}: ${response.status}`
				);
				return false;
			}
		} catch (error) {
			console.error(`Error deleting sandbox ${sandboxId}:`, error);
			return false;
		}
	}

	async forceCleanupAll() {
		console.log('🧹 Force cleanup: Removing all sandboxes...');

		try {
			if (!process.env.E2B_API_KEY) {
				console.warn('E2B_API_KEY not found. Cannot perform force cleanup.');
				return;
			}

			// Get all E2B sandboxes
			const response = await fetch('https://api.e2b.dev/sandboxes', {
				method: 'GET',
				headers: {
					'X-API-Key': process.env.E2B_API_KEY,
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const sandboxes = await response.json();
				console.log(`Found ${sandboxes.length} E2B sandboxes to cleanup`);

				for (const sandbox of sandboxes) {
					const killed = await this.killE2BSandbox(sandbox.sandboxID);
					if (killed) {
						console.log(`✅ Force deleted sandbox: ${sandbox.sandboxID}`);
					}
				}

				// Mark all tracked sandboxes as cleaned
				const config = await this.configService.loadConfig();
				const updates = {};

				for (const [sandboxId, info] of Object.entries(
					config.tracking.sandboxHistory
				)) {
					if (!info.killedAt) {
						updates[sandboxId] = {
							...info,
							killedAt: new Date().toISOString(),
							forceCleanedUp: true
						};
					}
				}

				if (Object.keys(updates).length > 0) {
					await this.configService.updateConfig((config) => {
						Object.assign(config.tracking.sandboxHistory, updates);
						return config;
					});
				}

				console.log('✅ Force cleanup completed');
			} else {
				console.error('Failed to fetch E2B sandboxes for force cleanup');
			}
		} catch (error) {
			console.error('Error during force cleanup:', error);
		}
	}

	async getCleanupStatus() {
		try {
			const config = await this.configService.loadConfig();
			const maxAgeHours = config.sandbox?.autoCleanupHours || 4;
			const orphanedSandboxes = await this.configService.getOrphanedSandboxes();

			const now = new Date();
			const summary = {
				isRunning: this.isRunning,
				checkInterval: this.checkInterval,
				maxAgeHours,
				orphanedSandboxes: orphanedSandboxes.length,
				sandboxes: orphanedSandboxes.map((sandbox) => {
					const ageHours =
						(now - new Date(sandbox.createdAt)) / (1000 * 60 * 60);
					return {
						sandboxId: sandbox.sandboxId,
						agent: sandbox.agent,
						ageHours: ageHours.toFixed(1),
						willBeCleanedUp: ageHours > maxAgeHours,
						timeToCleanup: Math.max(0, maxAgeHours - ageHours)
					};
				})
			};

			return summary;
		} catch (error) {
			return {
				isRunning: this.isRunning,
				error: error.message
			};
		}
	}

	stop() {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.isRunning = false;
		console.log('Sandbox cleaner stopped');
	}
}

export const SandboxCleanerService = SandboxCleaner;
