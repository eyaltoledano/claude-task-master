/**
 * Task Master Flow Hooks
 * Centralized exports for all custom hooks
 * Based on Gemini CLI hook architecture patterns
 */

// Core infrastructure hooks
export { useTerminalSize } from './useTerminalSize.js';
export { useStateAndRef } from './useStateAndRef.js';
export { useKeypress, createKeyHandlers } from './useKeypress.js';

// UI enhancement hooks
export { usePhraseCycler, PhraseCollections } from './usePhraseCycler.js';
export { useConsoleMessages, MessageFormatters } from './useConsoleMessages.js';

// Context-aware hooks
export { useGitBranchName } from './useGitBranchName.js';

// Theme system hooks (JSX exports commented out for Node.js compatibility)
// export {
// 	ThemeProvider,
// 	useTheme,
// 	useResponsiveTheme,
// 	useComponentTheme,
// 	useThemedStyles,
// 	useThemeTransitions,
// 	useThemePersistence
// } from './useTheme.jsx';

// Re-export hook utilities for convenience
export const HookUtils = {
	// Terminal utilities
	getTerminalInfo: () => ({
		width: process.stdout.columns || 80,
		height: process.stdout.rows || 24,
		hasColor: process.stdout.hasColors && process.stdout.hasColors(),
		isTTY: process.stdout.isTTY
	}),

	// Common key handler presets
	createNavigationHandlers: (callbacks) => ({
		up: callbacks.onUp,
		down: callbacks.onDown,
		left: callbacks.onLeft,
		right: callbacks.onRight,
		k: callbacks.onUp, // vim-style
		j: callbacks.onDown, // vim-style
		h: callbacks.onLeft, // vim-style
		l: callbacks.onRight, // vim-style
		'ctrl+p': callbacks.onUp, // emacs-style
		'ctrl+n': callbacks.onDown // emacs-style
	}),

	// Common modal handlers
	createModalHandlers: (callbacks) => ({
		escape: callbacks.onClose,
		'ctrl+c': callbacks.onClose,
		return: callbacks.onConfirm,
		tab: callbacks.onNext,
		'shift+tab': callbacks.onPrevious
	}),

	// Search handlers
	createSearchHandlers: (callbacks) => ({
		'ctrl+f': callbacks.onSearch,
		'/': callbacks.onSearch,
		'ctrl+k': callbacks.onClear,
		escape: callbacks.onClearSearch
	})
};

import { HookExecutor } from './core/hook-executor.js';
import { HookValidator } from './core/hook-validator.js';
import { createHookContext } from './core/hook-context.js';
import { HookStorage } from './core/hook-storage.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Hook Events - Available events that hooks can listen to
 */
export const HOOK_EVENTS = {
	// Pre-launch validation
	PRE_LAUNCH: 'pre-launch',
	
	// Worktree lifecycle
	POST_WORKTREE: 'post-worktree',
	
	// Research lifecycle
	PRE_RESEARCH: 'pre-research',
	POST_RESEARCH: 'post-research',
	
	// CLAUDE.md lifecycle
	PRE_CLAUDE_MD: 'pre-claude-md',
	POST_CLAUDE_MD: 'post-claude-md',
	
	// Session lifecycle
	SESSION_STARTED: 'session-started',
	SESSION_MESSAGE: 'session-message',
	SESSION_COMPLETED: 'session-completed',
	SESSION_FAILED: 'session-failed',
	
	// PR lifecycle
	PRE_PR: 'pre-pr',
	PR_CREATED: 'pr-created'
};

/**
 * Hook Manager - Central coordination system for Flow TUI hooks
 */
export class HookManager {
	constructor(backend) {
		this.backend = backend;
		this.hooks = new Map();
		this.executor = new HookExecutor();
		this.validator = new HookValidator();
		this.storage = new HookStorage();
		this.config = null;
		this.initialized = false;
	}

	/**
	 * Initialize the hook system
	 */
	async initialize() {
		if (this.initialized) return;

		try {
			// Load configuration
			this.config = await this.loadConfiguration();
			
			// Initialize storage
			await this.storage.initialize();
			
			// Load built-in hooks
			await this.loadBuiltInHooks();
			
			// Load user hooks (if any)
			await this.loadUserHooks();
			
			this.initialized = true;
			console.log(`🎣 Hook system initialized with ${this.hooks.size} hooks`);
			
		} catch (error) {
			console.error('Failed to initialize hook system:', error);
			throw error;
		}
	}

	/**
	 * Load configuration from file
	 */
	async loadConfiguration() {
		try {
			const configPath = path.join(__dirname, 'config', 'default-config.json');
			const { default: config } = await import(configPath, { assert: { type: 'json' } });
			return config;
		} catch (error) {
			console.warn('Failed to load hook configuration, using defaults:', error);
			return {
				hooks: {
					'research-integration': { enabled: true },
					'pre-launch-validation': { enabled: true },
					'session-completion': { enabled: true }
				},
				executor: {
					timeout: 30000,
					maxConcurrent: 3
				}
			};
		}
	}

	/**
	 * Load built-in hooks
	 */
	async loadBuiltInHooks() {
		const builtInHooks = [
			'research-integration',
			'pre-launch-validation',
			'session-completion'
		];

		for (const hookName of builtInHooks) {
			try {
				const hookConfig = this.config.hooks[hookName];
				if (!hookConfig || !hookConfig.enabled) {
					console.log(`📋 Skipping disabled hook: ${hookName}`);
					continue;
				}

				const hookPath = path.join(__dirname, 'built-in', `${hookName}.js`);
				const { default: HookClass } = await import(hookPath);
				
				const hookInstance = new HookClass();
				
				// Validate hook
				const validation = this.validator.validateHook(hookInstance);
				if (!validation.valid) {
					console.error(`❌ Invalid hook ${hookName}:`, validation.errors);
					continue;
				}

				// Register hook
				this.hooks.set(hookName, {
					instance: hookInstance,
					config: hookConfig,
					type: 'built-in'
				});

				console.log(`✅ Loaded built-in hook: ${hookName}`);
				
			} catch (error) {
				console.error(`❌ Failed to load built-in hook ${hookName}:`, error);
			}
		}
	}

	/**
	 * Load user hooks (placeholder for future implementation)
	 */
	async loadUserHooks() {
		// Future implementation would scan user hooks directory
		// For now, this is a placeholder
	}

	/**
	 * Execute hooks for a specific event
	 */
	async executeHooks(event, context = {}) {
		if (!this.initialized) {
			console.warn('Hook system not initialized, skipping hooks');
			return { success: true, results: [] };
		}

		const eventHooks = Array.from(this.hooks.values())
			.filter(hook => hook.instance.events.includes(event))
			.filter(hook => hook.config.enabled !== false);

		if (eventHooks.length === 0) {
			return { success: true, results: [] };
		}

		console.log(`🎣 Executing ${eventHooks.length} hooks for event: ${event}`);

		const results = [];
		const hookContext = createHookContext({
			...context,
			backend: this.backend,
			storage: this.storage
		});

		for (const hook of eventHooks) {
			try {
				const result = await this.executor.executeHook(
					hook.instance,
					event,
					hookContext,
					hook.config
				);
				
				results.push({
					hookName: hook.instance.constructor.name,
					event,
					success: result.success,
					result: result.data,
					error: result.error,
					duration: result.duration
				});

				// Store execution data if needed
				if (result.data && hook.config.storeResults) {
					await this.storage.storeHookData(
						hook.instance.constructor.name,
						event,
						result.data
					);
				}

			} catch (error) {
				console.error(`❌ Hook execution failed for ${hook.instance.constructor.name}:`, error);
				results.push({
					hookName: hook.instance.constructor.name,
					event,
					success: false,
					error: error.message,
					duration: 0
				});
			}
		}

		const allSuccessful = results.every(r => r.success);
		
		return {
			success: allSuccessful,
			results,
			event,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Get hook execution history
	 */
	async getHookHistory(hookName, event = null) {
		return await this.storage.getHookHistory(hookName, event);
	}

	/**
	 * Clear hook storage
	 */
	async clearHookStorage() {
		return await this.storage.clear();
	}

	/**
	 * Get hook status and statistics
	 */
	getHookStatus() {
		const status = {
			initialized: this.initialized,
			totalHooks: this.hooks.size,
			enabledHooks: 0,
			disabledHooks: 0,
			hooks: {}
		};

		for (const [name, hook] of this.hooks) {
			const enabled = hook.config.enabled !== false;
			if (enabled) status.enabledHooks++;
			else status.disabledHooks++;

			status.hooks[name] = {
				enabled,
				type: hook.type,
				events: hook.instance.events,
				description: hook.instance.description,
				version: hook.instance.version
			};
		}

		return status;
	}

	/**
	 * Enable/disable a specific hook
	 */
	async setHookEnabled(hookName, enabled) {
		const hook = this.hooks.get(hookName);
		if (!hook) {
			throw new Error(`Hook not found: ${hookName}`);
		}

		hook.config.enabled = enabled;
		
		// Persist configuration change if needed
		// This would update the config file in a real implementation
		
		console.log(`🎣 Hook ${hookName} ${enabled ? 'enabled' : 'disabled'}`);
		
		return true;
	}

	/**
	 * Get available events
	 */
	getAvailableEvents() {
		return Object.values(HOOK_EVENTS);
	}

	/**
	 * Cleanup hook system
	 */
	async cleanup() {
		if (this.storage) {
			await this.storage.cleanup();
		}
		
		this.hooks.clear();
		this.initialized = false;
		
		console.log('🎣 Hook system cleaned up');
	}
}

// Export singleton instance
let hookManagerInstance = null;

export function getHookManager(backend) {
	if (!hookManagerInstance) {
		hookManagerInstance = new HookManager(backend);
	}
	return hookManagerInstance;
}
