/**
 * Simplified Provider Registry using VibeKit SDK
 */

import { VibeKitService } from '../services/vibekit.service.js';

export const availableProviders = {
  vibekit: {
    name: 'VibeKit SDK',
    type: 'vibekit',
    description: 'Secure sandbox execution using VibeKit SDK with full configuration support',
    agents: ['claude-code', 'codex', 'gemini-cli', 'opencode'],
    features: [
      'secure-sandbox',
      'streaming',
      'github-integration', 
      'multi-agent',
      'code-generation',
      'qa-mode',
      'telemetry',
      'session-management',
      'multi-environment'
    ],
    environments: ['e2b', 'northflank', 'daytona'],
    factory: (config) => new VibeKitService(config),
    config: {
      authentication: {
        required: ['ANTHROPIC_API_KEY', 'E2B_API_KEY'],
        optional: [
          'GITHUB_TOKEN', 
          'OPENAI_API_KEY', 
          'GOOGLE_API_KEY',
          'OPENCODE_API_KEY',
          'NORTHFLANK_API_KEY',
          'NORTHFLANK_PROJECT_ID',
          'DAYTONA_API_KEY',
          'DAYTONA_WORKSPACE_ID',
          'VIBEKIT_TELEMETRY_API_KEY'
        ]
      },
      telemetry: {
        supported: true,
        configurable: true
      },
      sessionManagement: {
        supported: true,
        persistent: true
      }
    }
  }
};

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = 'vibekit';
  }

  async getProvider(name = this.defaultProvider, config = {}) {
    if (!this.providers.has(name)) {
      const providerConfig = availableProviders[name];
      if (!providerConfig) {
        throw new Error(`Provider '${name}' not found`);
      }

      const provider = providerConfig.factory(config);
      this.providers.set(name, provider);
    }

    return this.providers.get(name);
  }

  getAvailableProviders() {
    return Object.keys(availableProviders);
  }

  getProviderInfo(name) {
    return availableProviders[name];
  }

  validateProviderConfig(name) {
    const provider = availableProviders[name];
    if (!provider) return { valid: false, error: 'Provider not found' };

    const missing = provider.config.authentication.required.filter(
      key => !process.env[key]
    );

    return {
      valid: missing.length === 0,
      missing,
      optional: provider.config.authentication.optional.filter(
        key => !process.env[key]
      )
    };
  }
}

export const globalRegistry = new ProviderRegistry();
