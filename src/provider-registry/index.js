/**
 * Provider Registry - Singleton for managing AI providers
 *
 * This module implements a singleton registry that allows dynamic registration
 * of AI providers at runtime, while maintaining compatibility with the existing
 * static PROVIDERS object in ai-services-unified.js.
 */

// Singleton instance
let instance = null;

/**
 * Provider Registry class - Manages dynamic provider registration
 */
class ProviderRegistry {
	constructor() {
		// Private provider map
		this._providers = new Map();

		// Flag to track initialization
		this._initialized = false;
	}

	/**
	 * Get the singleton instance
	 * @returns {ProviderRegistry} The singleton instance
	 */
	static getInstance() {
		if (!instance) {
			instance = new ProviderRegistry();
		}
		return instance;
	}

	/**
	 * Initialize the registry
	 * @returns {ProviderRegistry} The singleton instance
	 */
	initialize() {
		if (this._initialized) {
			return this;
		}

		this._initialized = true;
		return this;
	}

	/**
	 * Register a provider with the registry
	 * @param {string} providerName - The name of the provider
	 * @param {object} provider - The provider instance
	 * @param {object} options - Additional options for registration
	 * @returns {ProviderRegistry} The singleton instance for chaining
	 */
	registerProvider(providerName, provider, options = {}) {
		if (!providerName || typeof providerName !== 'string') {
			throw new Error('Provider name must be a non-empty string');
		}

		if (!provider) {
			throw new Error('Provider instance is required');
		}

		// Validate that provider implements the required interface
		if (
			typeof provider.generateText !== 'function' ||
			typeof provider.streamText !== 'function' ||
			typeof provider.generateObject !== 'function'
		) {
			throw new Error('Provider must implement BaseAIProvider interface');
		}

		// Add provider to the registry
		this._providers.set(providerName, {
			instance: provider,
			options,
			registeredAt: new Date()
		});

		return this;
	}

	/**
	 * Check if a provider exists in the registry
	 * @param {string} providerName - The name of the provider
	 * @returns {boolean} True if the provider exists
	 */
	hasProvider(providerName) {
		return this._providers.has(providerName);
	}

	/**
	 * Get a provider from the registry
	 * @param {string} providerName - The name of the provider
	 * @returns {object|null} The provider instance or null if not found
	 */
	getProvider(providerName) {
		const providerEntry = this._providers.get(providerName);
		return providerEntry ? providerEntry.instance : null;
	}

	/**
	 * Get all registered providers
	 * @returns {Map} Map of all registered providers
	 */
	getAllProviders() {
		return new Map(this._providers);
	}

	/**
	 * Remove a provider from the registry
	 * @param {string} providerName - The name of the provider
	 * @returns {boolean} True if the provider was removed
	 */
	unregisterProvider(providerName) {
		if (this._providers.has(providerName)) {
			this._providers.delete(providerName);
			return true;
		}
		return false;
	}

	/**
	 * Reset the registry (primarily for testing)
	 */
	reset() {
		this._providers.clear();
		this._initialized = false;
	}
}

ProviderRegistry.getInstance().initialize(); // Ensure singleton is initialized on import
// Export singleton getter
export default ProviderRegistry;
