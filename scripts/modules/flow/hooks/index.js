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

// Theme system hooks
export {
	ThemeProvider,
	useTheme,
	useResponsiveTheme,
	useComponentTheme,
	useThemedStyles,
	useThemeTransitions,
	useThemePersistence
} from './useTheme.jsx';

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
import { HookStorage } from './core/hook-storage.js';
import { createHookContext } from './core/hook-context.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main Hook Manager - coordinates all hook operations
 */
export class HookManager {
	constructor(options = {}) {
		this.projectRoot = options.projectRoot || process.cwd();
		this.configPath = path.join(__dirname, 'config', 'hook-registry.json');
		this.defaultConfigPath = path.join(__dirname, 'config', 'default-config.json');
		
		this.executor = new HookExecutor();
		this.validator = new HookValidator();
		this.storage = new HookStorage(this.projectRoot);
		
		this.hooks = new Map();
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
			await this.loadConfig();
			
			// Load built-in hooks
			await this.loadBuiltInHooks();
			
			// Initialize storage
			await this.storage.initialize();
			
			this.initialized = true;
			console.log('🪝 Hook system initialized successfully');
		} catch (error) {
			console.error('❌ Failed to initialize hook system:', error);
			throw error;
		}
	}

	/**
	 * Load hook configuration
	 */
	async loadConfig() {
		try {
			// Try to load existing config
			const configData = await fs.readFile(this.configPath, 'utf8');
			this.config = JSON.parse(configData);
		} catch (error) {
			// Load default config if no custom config exists
			try {
				const defaultConfigData = await fs.readFile(this.defaultConfigPath, 'utf8');
				this.config = JSON.parse(defaultConfigData);
				
				// Save default config as active config
				await this.saveConfig();
			} catch (defaultError) {
				// Create minimal config if no default exists
				this.config = {
					enabled: true,
					hooks: {}
				};
				await this.saveConfig();
			}
		}
	}

	/**
	 * Save current configuration
	 */
	async saveConfig() {
		const configDir = path.dirname(this.configPath);
		await fs.mkdir(configDir, { recursive: true });
		await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
	}

	/**
	 * Load built-in hooks
	 */
	async loadBuiltInHooks() {
		const builtInDir = path.join(__dirname, 'built-in');
		
		try {
			const files = await fs.readdir(builtInDir);
			
			for (const file of files) {
				if (file.endsWith('.js')) {
					const hookName = path.basename(file, '.js');
					const hookPath = path.join(builtInDir, file);
					
					try {
						const hookModule = await import(hookPath);
						const HookClass = hookModule.default || hookModule[Object.keys(hookModule)[0]];
						
						if (HookClass && typeof HookClass === 'function') {
							const hookInstance = new HookClass();
							await this.registerHook(hookName, hookInstance);
						}
					} catch (hookError) {
						console.warn(`⚠️ Failed to load hook ${hookName}:`, hookError.message);
					}
				}
			}
		} catch (error) {
			console.warn('⚠️ Built-in hooks directory not found, skipping built-in hook loading');
		}
	}

	/**
	 * Register a hook
	 */
	async registerHook(name, hookInstance) {
		// Validate hook
		const validation = await this.validator.validateHook(hookInstance);
		if (!validation.valid) {
			throw new Error(`Hook validation failed for ${name}: ${validation.errors.join(', ')}`);
		}

		// Store hook
		this.hooks.set(name, {
			instance: hookInstance,
			config: this.config.hooks[name] || { enabled: true },
			metadata: {
				registered: new Date().toISOString(),
				version: hookInstance.version || '1.0.0'
			}
		});

		console.log(`✅ Registered hook: ${name}`);
	}

	/**
	 * Execute hooks for a specific event
	 */
	async executeHooks(event, context = {}) {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.config.enabled) {
			return { executed: [], skipped: 'system-disabled' };
		}

		const results = [];
		const executed = [];
		const skipped = [];

		for (const [hookName, hookData] of this.hooks) {
			const { instance, config } = hookData;

			// Check if hook is enabled
			if (!config.enabled) {
				skipped.push({ name: hookName, reason: 'disabled' });
				continue;
			}

			// Check if hook handles this event
			if (!instance.events || !instance.events.includes(event)) {
				continue;
			}

			try {
				// Create hook context
				const hookContext = createHookContext({
					event,
					hookName,
					config: config.config || {},
					storage: this.storage,
					...context
				});

				// Execute hook
				const result = await this.executor.execute(instance, event, hookContext);
				
				results.push({
					hook: hookName,
					event,
					result,
					timestamp: new Date().toISOString()
				});

				executed.push(hookName);

			} catch (error) {
				console.error(`❌ Hook ${hookName} failed for event ${event}:`, error);
				results.push({
					hook: hookName,
					event,
					error: error.message,
					timestamp: new Date().toISOString()
				});
			}
		}

		return {
			executed,
			skipped,
			results,
			event,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Get hook status
	 */
	getHookStatus() {
		const status = {
			enabled: this.config.enabled,
			initialized: this.initialized,
			totalHooks: this.hooks.size,
			enabledHooks: 0,
			disabledHooks: 0,
			hooks: {}
		};

		for (const [hookName, hookData] of this.hooks) {
			const { config, metadata } = hookData;
			const isEnabled = config.enabled;

			if (isEnabled) {
				status.enabledHooks++;
			} else {
				status.disabledHooks++;
			}

			status.hooks[hookName] = {
				enabled: isEnabled,
				events: hookData.instance.events || [],
				version: metadata.version,
				registered: metadata.registered
			};
		}

		return status;
	}

	/**
	 * Enable/disable a specific hook
	 */
	async setHookEnabled(hookName, enabled) {
		if (!this.hooks.has(hookName)) {
			throw new Error(`Hook ${hookName} not found`);
		}

		if (!this.config.hooks[hookName]) {
			this.config.hooks[hookName] = {};
		}

		this.config.hooks[hookName].enabled = enabled;
		await this.saveConfig();

		// Update in-memory config
		const hookData = this.hooks.get(hookName);
		hookData.config.enabled = enabled;

		console.log(`🔧 Hook ${hookName} ${enabled ? 'enabled' : 'disabled'}`);
	}

	/**
	 * Enable/disable the entire hook system
	 */
	async setSystemEnabled(enabled) {
		this.config.enabled = enabled;
		await this.saveConfig();
		console.log(`🔧 Hook system ${enabled ? 'enabled' : 'disabled'}`);
	}
}

// Export singleton instance
export const hookManager = new HookManager();

// Export hook events constants
export const HOOK_EVENTS = {
	PRE_LAUNCH: 'pre-launch',
	POST_WORKTREE: 'post-worktree',
	PRE_RESEARCH: 'pre-research',
	POST_RESEARCH: 'post-research',
	PRE_CLAUDE_MD: 'pre-claude-md',
	POST_CLAUDE_MD: 'post-claude-md',
	SESSION_STARTED: 'session-started',
	SESSION_MESSAGE: 'session-message',
	SESSION_COMPLETED: 'session-completed',
	PRE_PR: 'pre-pr',
	PR_CREATED: 'pr-created',
	SESSION_FAILED: 'session-failed'
};
