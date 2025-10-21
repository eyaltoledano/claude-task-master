/**
 * @fileoverview Configuration Merger Service
 * Responsible for merging configurations from multiple sources with precedence
 */

import type { PartialConfiguration } from '../../../common/interfaces/configuration.interface.js';

/**
 * Configuration source with precedence
 */
export interface ConfigSource {
	/** Source name for debugging */
	name: string;
	/** Configuration data from this source */
	config: PartialConfiguration;
	/** Precedence level (higher = more important) */
	precedence: number;
}

/**
 * Configuration precedence levels (higher number = higher priority)
 */
export const CONFIG_PRECEDENCE = {
	DEFAULTS: 0,
	GLOBAL: 1, // Reserved for future implementation
	LOCAL: 2,
	ENVIRONMENT: 3
} as const;

/**
 * ConfigMerger handles merging configurations with precedence rules
 * Single responsibility: Configuration merging logic
 */
export class ConfigMerger {
	private configSources: ConfigSource[] = [];

	/**
	 * Add a configuration source
	 */
	addSource(source: ConfigSource): void {
		this.configSources.push(source);
	}

	/**
	 * Clear all configuration sources
	 */
	clearSources(): void {
		this.configSources = [];
	}

	/**
	 * Merge all configuration sources based on precedence
	 */
	merge(): PartialConfiguration {
		// Sort sources by precedence (lowest first)
		const sortedSources = [...this.configSources].sort(
			(a, b) => a.precedence - b.precedence
		);

		// Merge from lowest to highest precedence
		let merged: PartialConfiguration = {};
		for (const source of sortedSources) {
			merged = this.deepMerge(merged, source.config);
		}

		return merged;
	}

	/**
	 * Deep merge two configuration objects
	 * Higher precedence values override lower ones
	 */
	private deepMerge(target: any, source: any): any {
		if (!source) return target;
		if (!target) return source;

		const result = { ...target };

		for (const key in source) {
			if (source[key] === null || source[key] === undefined) {
				continue;
			}

			if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this.deepMerge(result[key] || {}, source[key]);
			} else {
				result[key] = source[key];
			}
		}

		return result;
	}

	/**
	 * Get configuration sources for debugging
	 */
	getSources(): ConfigSource[] {
		return [...this.configSources].sort((a, b) => b.precedence - a.precedence);
	}

	/**
	 * Check if a source exists
	 */
	hasSource(name: string): boolean {
		return this.configSources.some((source) => source.name === name);
	}

	/**
	 * Remove a source by name
	 */
	removeSource(name: string): boolean {
		const initialLength = this.configSources.length;
		this.configSources = this.configSources.filter(
			(source) => source.name !== name
		);
		return this.configSources.length < initialLength;
	}
}
