/**
 * @fileoverview Agent Registry - Phase 5 Implementation
 *
 * Manages agent instantiation, provider selection, load balancing, and health monitoring.
 * Implements factory patterns with dynamic loading, fallback mechanisms, and quality scoring.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {
	AIAgent,
	AGENT_CAPABILITIES,
	AGENT_STATUS,
	AgentError,
	validateAgentConfig
} from './agent.interface.js';
import { MockAgent } from './providers/mock.agent.js';

/**
 * Agent provider configurations and capabilities
 */
const AGENT_PROVIDERS = {
	mock: {
		name: 'Mock Agent',
		class: MockAgent,
		capabilities: [
			AGENT_CAPABILITIES.CODE_GENERATION,
			AGENT_CAPABILITIES.CODE_REVIEW,
			AGENT_CAPABILITIES.PLANNING,
			AGENT_CAPABILITIES.TESTING,
			AGENT_CAPABILITIES.DOCUMENTATION,
			AGENT_CAPABILITIES.DEBUGGING,
			AGENT_CAPABILITIES.ARCHITECTURE
		],
		costPerToken: 0.00001,
		averageLatency: 1000,
		reliability: 0.99,
		qualityScore: 0.8,
		maxConcurrency: 10
	},
	claude: {
		name: 'Claude Agent',
		module: './providers/claude.agent.js',
		className: 'ClaudeAgent',
		capabilities: [
			AGENT_CAPABILITIES.CODE_GENERATION,
			AGENT_CAPABILITIES.CODE_REVIEW,
			AGENT_CAPABILITIES.ARCHITECTURE,
			AGENT_CAPABILITIES.DOCUMENTATION
		],
		costPerToken: 0.00003,
		averageLatency: 2000,
		reliability: 0.95,
		qualityScore: 0.95,
		maxConcurrency: 5
	},
	gpt: {
		name: 'GPT Agent',
		module: './providers/gpt.agent.js',
		className: 'GPTAgent',
		capabilities: [
			AGENT_CAPABILITIES.CODE_GENERATION,
			AGENT_CAPABILITIES.DEBUGGING,
			AGENT_CAPABILITIES.TESTING,
			AGENT_CAPABILITIES.PLANNING
		],
		costPerToken: 0.00002,
		averageLatency: 1500,
		reliability: 0.97,
		qualityScore: 0.9,
		maxConcurrency: 8
	},
	gemini: {
		name: 'Gemini Agent',
		module: './providers/gemini.agent.js',
		className: 'GeminiAgent',
		capabilities: [
			AGENT_CAPABILITIES.CODE_GENERATION,
			AGENT_CAPABILITIES.PLANNING,
			AGENT_CAPABILITIES.ARCHITECTURE
		],
		costPerToken: 0.000015,
		averageLatency: 1800,
		reliability: 0.92,
		qualityScore: 0.85,
		maxConcurrency: 6
	}
};

/**
 * Agent selection strategies
 */
export const SELECTION_STRATEGIES = {
	FASTEST: 'fastest',
	CHEAPEST: 'cheapest',
	BEST_QUALITY: 'best_quality',
	MOST_RELIABLE: 'most_reliable',
	LOAD_BALANCED: 'load_balanced',
	CUSTOM: 'custom'
};

/**
 * Agent Registry class for managing AI agents
 */
export class AgentRegistry extends EventEmitter {
	constructor(config = {}) {
		super();

		this.agents = new Map(); // Active agent instances
		this.providers = new Map(Object.entries(AGENT_PROVIDERS));
		this.healthStatus = new Map(); // Health status cache
		this.loadBalancer = new Map(); // Load balancing state
		this.qualityMetrics = new Map(); // Quality tracking

		// Configuration
		this.config = {
			healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
			maxRetries: config.maxRetries || 3,
			defaultStrategy:
				config.defaultStrategy || SELECTION_STRATEGIES.BEST_QUALITY,
			fallbackChain: config.fallbackChain || ['claude', 'gpt', 'mock'],
			qualityThreshold: config.qualityThreshold || 0.7,
			stateFile:
				config.stateFile ||
				path.join(process.cwd(), '.taskmaster', 'agent-registry-state.json'),
			...config
		};

		// Load persisted state
		this._loadState();

		// Start health monitoring
		this._startHealthMonitoring();
	}

	/**
	 * Initialize the registry with available providers
	 */
	async initialize() {
		try {
			// Initialize mock agent (always available)
			await this._ensureAgent('mock');

			this.emit('initialized', {
				providersLoaded: this.providers.size,
				timestamp: new Date().toISOString()
			});

			return {
				success: true,
				providers: Array.from(this.providers.keys()),
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			this.emit('error', error);
			throw new AgentError(
				`Failed to initialize agent registry: ${error.message}`
			);
		}
	}

	/**
	 * Get an agent by provider type with automatic instantiation
	 */
	async getAgent(providerType, config = {}) {
		try {
			await this._ensureAgent(providerType, config);
			return this.agents.get(providerType);
		} catch (error) {
			throw new AgentError(
				`Failed to get agent ${providerType}: ${error.message}`
			);
		}
	}

	/**
	 * Select the best agent for a task based on capabilities and strategy
	 */
	async selectAgent(task, options = {}) {
		const requiredCapabilities = task.capabilities || [
			AGENT_CAPABILITIES.CODE_GENERATION
		];
		const strategy = options.strategy || this.config.defaultStrategy;
		const excludeProviders = options.exclude || [];

		try {
			// Get available agents with required capabilities
			const candidates = await this._getCandidateAgents(
				requiredCapabilities,
				excludeProviders
			);

			if (candidates.length === 0) {
				throw new AgentError('No suitable agents found for task requirements');
			}

			// Apply selection strategy
			const selectedAgent = this._applySelectionStrategy(
				candidates,
				strategy,
				task,
				options
			);

			this.emit('agent_selected', {
				agentId: selectedAgent.id,
				agentType: selectedAgent.type,
				strategy,
				task: task.id || 'unknown',
				timestamp: new Date().toISOString()
			});

			return selectedAgent;
		} catch (error) {
			// Try fallback chain
			if (this.config.fallbackChain.length > 0) {
				return await this._tryFallbackChain(task, options, excludeProviders);
			}
			throw error;
		}
	}

	/**
	 * List all available agents with their status and capabilities
	 */
	async listAgents(options = {}) {
		const includeMetrics = options.includeMetrics !== false;
		const agents = [];

		for (const [providerType, provider] of this.providers.entries()) {
			const agent = this.agents.get(providerType);
			let health = this.healthStatus.get(providerType);
			const quality = this.qualityMetrics.get(providerType);

			// If agent exists but no health status cached, check health now
			if (agent && !health) {
				try {
					health = await agent.checkHealth();
					this.healthStatus.set(providerType, {
						...health,
						timestamp: new Date().toISOString()
					});
				} catch (error) {
					health = { healthy: false, error: error.message };
				}
			}

			const agentInfo = {
				type: providerType,
				name: provider.name,
				capabilities: provider.capabilities,
				status: agent ? agent.status : AGENT_STATUS.UNINITIALIZED,
				healthy: health ? health.healthy : false,
				lastHealthCheck: health ? health.timestamp : null
			};

			if (includeMetrics && agent) {
				agentInfo.metrics = agent.metrics;
				agentInfo.qualityScore = quality ? quality.score : null;
				agentInfo.loadFactor = this._getLoadFactor(providerType);
			}

			agents.push(agentInfo);
		}

		return agents;
	}

	/**
	 * Check health of all agents
	 */
	async checkAllHealth() {
		const results = new Map();

		for (const providerType of this.providers.keys()) {
			try {
				const health = await this.checkAgentHealth(providerType);
				results.set(providerType, health);
			} catch (error) {
				results.set(providerType, {
					healthy: false,
					error: error.message,
					timestamp: new Date().toISOString()
				});
			}
		}

		return results;
	}

	/**
	 * Check health of a specific agent
	 */
	async checkAgentHealth(providerType) {
		try {
			const agent = await this.getAgent(providerType);
			const health = await agent.checkHealth();

			// Cache health status
			this.healthStatus.set(providerType, {
				...health,
				timestamp: new Date().toISOString()
			});

			// Persist state after health status update
			this._saveState();

			return health;
		} catch (error) {
			const errorHealth = {
				healthy: false,
				agentType: providerType,
				error: error.message,
				timestamp: new Date().toISOString()
			};

			this.healthStatus.set(providerType, errorHealth);
			this._saveState();
			return errorHealth;
		}
	}

	/**
	 * Update quality metrics for an agent based on task results
	 */
	updateQualityMetrics(agentType, taskResult) {
		const current = this.qualityMetrics.get(agentType) || {
			score: 0.5,
			totalTasks: 0,
			successfulTasks: 0,
			averageResponseTime: 0,
			lastUpdated: new Date().toISOString()
		};

		const wasSuccessful = taskResult.success && !taskResult.error;
		const responseTime = taskResult.metadata?.responseTime || 0;

		// Update metrics
		current.totalTasks++;
		if (wasSuccessful) {
			current.successfulTasks++;
		}

		// Calculate new average response time
		current.averageResponseTime =
			(current.averageResponseTime * (current.totalTasks - 1) + responseTime) /
			current.totalTasks;

		// Calculate quality score (success rate weighted by speed)
		const successRate = current.successfulTasks / current.totalTasks;
		const speedFactor = Math.max(0.1, 1 - current.averageResponseTime / 10000); // Normalize to 10s max
		current.score = successRate * 0.7 + speedFactor * 0.3;

		current.lastUpdated = new Date().toISOString();

		this.qualityMetrics.set(agentType, current);

		this.emit('quality_updated', {
			agentType,
			score: current.score,
			totalTasks: current.totalTasks,
			successRate,
			timestamp: current.lastUpdated
		});

		// Persist state after metrics update
		this._saveState();
	}

	/**
	 * Get registry statistics
	 */
	getStatistics() {
		const stats = {
			totalProviders: this.providers.size,
			activeAgents: this.agents.size,
			healthyAgents: 0,
			totalRequests: 0,
			successfulRequests: 0,
			averageQuality: 0
		};

		let qualitySum = 0;
		let qualityCount = 0;

		// Count healthy agents and gather metrics from all active agents
		for (const [providerType, agent] of this.agents.entries()) {
			// Check if agent is healthy
			const health = this.healthStatus.get(providerType);
			if (health && health.healthy) {
				stats.healthyAgents++;
			} else if (agent && agent.status === AGENT_STATUS.READY) {
				// If no health status but agent is ready, assume healthy
				stats.healthyAgents++;
			}

			// Gather metrics from agent
			if (agent && agent.metrics) {
				stats.totalRequests += agent.metrics.totalRequests;
				stats.successfulRequests += agent.metrics.successfulRequests;
			}

			// Gather quality metrics
			const quality = this.qualityMetrics.get(providerType);
			if (quality) {
				qualitySum += quality.score;
				qualityCount++;
			}
		}

		if (qualityCount > 0) {
			stats.averageQuality = qualitySum / qualityCount;
		}

		return stats;
	}

	/**
	 * Save registry state to persistent storage
	 * @private
	 */
	_saveState() {
		try {
			// Include agent metrics in state
			const agentMetrics = {};
			for (const [providerType, agent] of this.agents.entries()) {
				if (agent && agent.metrics) {
					agentMetrics[providerType] = agent.metrics;
				}
			}

			const state = {
				healthStatus: Object.fromEntries(this.healthStatus),
				qualityMetrics: Object.fromEntries(this.qualityMetrics),
				loadBalancer: Object.fromEntries(this.loadBalancer),
				agentMetrics,
				lastSaved: new Date().toISOString()
			};

			// Ensure directory exists
			const dir = path.dirname(this.config.stateFile);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			fs.writeFileSync(this.config.stateFile, JSON.stringify(state, null, 2));
		} catch (error) {
			// Don't throw on save errors, just emit warning
			this.emit('warning', {
				message: `Failed to save state: ${error.message}`
			});
		}
	}

	/**
	 * Load registry state from persistent storage
	 * @private
	 */
	_loadState() {
		try {
			if (fs.existsSync(this.config.stateFile)) {
				const stateData = fs.readFileSync(this.config.stateFile, 'utf8');
				const state = JSON.parse(stateData);

				if (state.healthStatus) {
					this.healthStatus = new Map(Object.entries(state.healthStatus));
				}
				if (state.qualityMetrics) {
					this.qualityMetrics = new Map(Object.entries(state.qualityMetrics));
				}
				if (state.loadBalancer) {
					this.loadBalancer = new Map(Object.entries(state.loadBalancer));
				}
				if (state.agentMetrics) {
					this._persistedAgentMetrics = state.agentMetrics;
				}

				this.emit('state_loaded', { timestamp: state.lastSaved || 'unknown' });
			}
		} catch (error) {
			// Don't throw on load errors, just emit warning
			this.emit('warning', {
				message: `Failed to load state: ${error.message}`
			});
		}
	}

	// Private methods

	async _ensureAgent(providerType, config = {}) {
		if (this.agents.has(providerType)) {
			return this.agents.get(providerType);
		}

		const provider = this.providers.get(providerType);
		if (!provider) {
			throw new AgentError(`Unknown provider type: ${providerType}`);
		}

		let AgentClass;

		if (provider.class) {
			// Static class reference (like MockAgent)
			AgentClass = provider.class;
		} else if (provider.module) {
			// Dynamic import
			try {
				const module = await import(provider.module);
				AgentClass = module[provider.className];
			} catch (error) {
				throw new AgentError(
					`Failed to load agent module ${provider.module}: ${error.message}`
				);
			}
		} else {
			throw new AgentError(
				`Invalid provider configuration for ${providerType}`
			);
		}

		// Validate configuration
		const agentConfig = { type: providerType, ...config };
		validateAgentConfig(agentConfig);

		// Create and initialize agent
		const agent = new AgentClass(agentConfig);
		await agent.initialize(config);

		// Set up event listeners
		agent.on('error', (error) => {
			this.emit('agent_error', { agentType: providerType, error });
		});

		agent.on('progress', (progress) => {
			this.emit('agent_progress', { agentType: providerType, ...progress });
		});

		this.agents.set(providerType, agent);
		this._initializeLoadBalancer(providerType);

		// Restore persisted metrics if available
		if (
			this._persistedAgentMetrics &&
			this._persistedAgentMetrics[providerType]
		) {
			agent.metrics = {
				...agent.metrics,
				...this._persistedAgentMetrics[providerType]
			};
		}

		return agent;
	}

	async _getCandidateAgents(requiredCapabilities, excludeProviders) {
		const candidates = [];

		for (const [providerType, provider] of this.providers.entries()) {
			if (excludeProviders.includes(providerType)) {
				continue;
			}

			// Check if provider has required capabilities
			const hasCapabilities = requiredCapabilities.every((cap) =>
				provider.capabilities.includes(cap)
			);

			if (!hasCapabilities) {
				continue;
			}

			try {
				const agent = await this.getAgent(providerType);
				const health = this.healthStatus.get(providerType);

				if (agent.status === AGENT_STATUS.READY && health?.healthy !== false) {
					candidates.push({
						agent,
						provider,
						providerType,
						health: health || { healthy: true }
					});
				}
			} catch (error) {
				// Skip agents that fail to initialize
			}
		}

		return candidates;
	}

	_applySelectionStrategy(candidates, strategy, task, options) {
		switch (strategy) {
			case SELECTION_STRATEGIES.FASTEST:
				return this._selectFastest(candidates);
			case SELECTION_STRATEGIES.CHEAPEST:
				return this._selectCheapest(candidates);
			case SELECTION_STRATEGIES.BEST_QUALITY:
				return this._selectBestQuality(candidates);
			case SELECTION_STRATEGIES.MOST_RELIABLE:
				return this._selectMostReliable(candidates);
			case SELECTION_STRATEGIES.LOAD_BALANCED:
				return this._selectLoadBalanced(candidates);
			case SELECTION_STRATEGIES.CUSTOM:
				return this._selectCustom(candidates, options.customSelector);
			default:
				return candidates[0].agent; // Default to first available
		}
	}

	_selectFastest(candidates) {
		return candidates.reduce((best, current) =>
			current.provider.averageLatency < best.provider.averageLatency
				? current
				: best
		).agent;
	}

	_selectCheapest(candidates) {
		return candidates.reduce((best, current) =>
			current.provider.costPerToken < best.provider.costPerToken
				? current
				: best
		).agent;
	}

	_selectBestQuality(candidates) {
		return candidates.reduce((best, current) => {
			const currentQuality =
				this.qualityMetrics.get(current.providerType)?.score ||
				current.provider.qualityScore;
			const bestQuality =
				this.qualityMetrics.get(best.providerType)?.score ||
				best.provider.qualityScore;
			return currentQuality > bestQuality ? current : best;
		}).agent;
	}

	_selectMostReliable(candidates) {
		return candidates.reduce((best, current) =>
			current.provider.reliability > best.provider.reliability ? current : best
		).agent;
	}

	_selectLoadBalanced(candidates) {
		// Select agent with lowest current load
		return candidates.reduce((best, current) => {
			const currentLoad = this._getLoadFactor(current.providerType);
			const bestLoad = this._getLoadFactor(best.providerType);
			return currentLoad < bestLoad ? current : best;
		}).agent;
	}

	_selectCustom(candidates, customSelector) {
		if (typeof customSelector === 'function') {
			return customSelector(candidates).agent;
		}
		return candidates[0].agent;
	}

	async _tryFallbackChain(task, options, excludeProviders) {
		for (const providerType of this.config.fallbackChain) {
			if (excludeProviders.includes(providerType)) {
				continue;
			}

			try {
				const agent = await this.getAgent(providerType);
				if (agent.status === AGENT_STATUS.READY) {
					this.emit('fallback_used', {
						providerType,
						task: task.id || 'unknown',
						timestamp: new Date().toISOString()
					});
					return agent;
				}
			} catch (error) {
				// Continue to next fallback
			}
		}

		throw new AgentError('All fallback agents failed or unavailable');
	}

	_getLoadFactor(providerType) {
		const loadState = this.loadBalancer.get(providerType);
		const provider = this.providers.get(providerType);

		if (!loadState || !provider) {
			return 0;
		}

		return loadState.activeRequests / provider.maxConcurrency;
	}

	_initializeLoadBalancer(providerType) {
		if (!this.loadBalancer.has(providerType)) {
			this.loadBalancer.set(providerType, {
				activeRequests: 0,
				totalRequests: 0,
				lastRequest: null
			});
		}
	}

	_startHealthMonitoring() {
		setInterval(async () => {
			try {
				await this.checkAllHealth();
				this.emit('health_check_completed', {
					timestamp: new Date().toISOString(),
					healthyCount: Array.from(this.healthStatus.values()).filter(
						(h) => h.healthy
					).length
				});
			} catch (error) {
				this.emit('health_check_error', error);
			}
		}, this.config.healthCheckInterval);
	}
}

/**
 * Global agent registry instance
 */
export const agentRegistry = new AgentRegistry();

/**
 * Initialize the global registry
 */
export async function initializeAgentRegistry(config = {}) {
	if (config) {
		Object.assign(agentRegistry.config, config);
	}
	return await agentRegistry.initialize();
}
