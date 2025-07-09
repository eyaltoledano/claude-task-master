/**
 * Default AST Configuration for Task Master Flow
 * Contains only configuration values - no schemas, managers, or validation logic
 */

/**
 * Default AST configuration values
 */
export const DEFAULT_AST_CONFIG = {
	enabled: false,
	cacheMaxAge: '2h',
	cacheMaxSize: '100MB',
	supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
	excludePatterns: [
		'node_modules/**',
		'dist/**',
		'build/**',
		'.git/**',
		'*.min.js'
	],
	contextInclusion: {
		maxFunctions: 10,
		maxComplexityScore: 8,
		includeImports: true,
		includeDependencies: true
	}
};

/**
 * Default advanced AST configuration with research-backed settings
 */
export const DEFAULT_ADVANCED_AST_CONFIG = {
	ast: {
		enabled: true,
		version: '4.1',

		parsing: {
			supportedLanguages: ['javascript', 'typescript', 'python', 'go'],
			excludePatterns: [
				'node_modules/**',
				'dist/**',
				'build/**',
				'.git/**',
				'coverage/**',
				'*.min.js',
				'*.bundle.js'
			],
			maxFileSize: '1MB',
			timeoutMs: 5000,
			enableFallback: true
		},

		fileWatching: {
			enabled: true,
			batchDelay: 500,
			maxConcurrentAnalysis: 3,
			watchPatterns: ['**/*.{js,jsx,ts,tsx,py,go,json}'],
			ignorePatterns: [
				'node_modules/**',
				'dist/**',
				'build/**',
				'.git/**',
				'coverage/**',
				'*.tmp',
				'*.log'
			],
			enablePreemptiveAnalysis: true,
			backgroundProcessing: true,
			debounceWindow: 300,
			resourceThrottling: {
				cpuThreshold: 80,
				memoryThreshold: 75,
				enableAdaptiveThrottling: true
			}
		},

		cacheInvalidation: {
			strategy: 'selective', // conservative | selective | aggressive | immediate
			dependencyTracking: true,
			batchInvalidation: true,
			maxInvalidationDelay: 1000,
			maxDependencyDepth: 5,
			separateTestFiles: true,
			contentHashing: {
				algorithm: 'sha256',
				languageAware: true,
				normalizeWhitespace: true,
				ignoreComments: true
			}
		},

		worktreeManager: {
			enabled: true,
			discoveryInterval: 30000,
			maxConcurrentWatchers: 8,
			coordinationStrategy: 'balanced', // safe | balanced | fast
			resourceLimits: {
				maxMemoryMB: 50,
				maxCpuPercent: 15,
				maxEventsPerSecond: 1000
			},
			conflictResolution: {
				maxRetries: 3,
				retryDelayMs: 100,
				timeoutMs: 5000
			},
			gitIntegration: {
				enabled: false, // Disabled by default for safety
				preserveExistingHooks: true,
				enableGracefulFallback: true
			}
		},

		performance: {
			maxAnalysisTime: 2000,
			maxMemoryUsage: '200MB',
			cacheHitRateTarget: 80,
			monitoringInterval: 5000,
			gracefulDegradation: true
		},

		contextGeneration: {
			maxFunctions: 10,
			maxComplexityScore: 8,
			includeImports: true,
			includeDependencies: true,
			relevanceThreshold: 0.4,
			maxContextSize: '50KB'
		},

		debugging: {
			enableVerboseLogging: false,
			logConfigChanges: true,
			validateOnReload: true
		}
	}
};

/**
 * Backward compatibility - export the simple loadASTConfig function
 * Complex management functionality moved to managers/ast-config-manager.js
 */
export async function loadASTConfig() {
	try {
		// AST configuration is now self-contained to avoid duplication
		// with flow-config.js which has its own comprehensive configuration
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	} catch (error) {
		console.warn('Error loading AST config:', error.message);
		return {
			success: true,
			config: DEFAULT_AST_CONFIG
		};
	}
}

// Re-export from other modules for backward compatibility
export { validateASTConfig, parseCacheDuration, parseCacheSize, isLanguageSupported, getSupportedExtensions } from './utils/config-utils.js';
export { ASTConfigManager } from './managers/ast-config-manager.js';
export { ConfigValidator } from './schemas/ast-config-schema.js';
