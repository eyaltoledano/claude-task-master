/**
 * @fileoverview Environment Configuration Provider
 * Extracts configuration from environment variables
 */

import type { PartialConfiguration } from '../../../common/interfaces/configuration.interface.js';
import { getLogger } from '../../../common/logger/index.js';
import { execSync } from 'node:child_process';

/**
 * Environment variable mapping definition
 */
interface EnvMapping {
	/** Environment variable name */
	env: string;
	/** Path in configuration object */
	path: readonly string[];
	/** Optional validator function */
	validate?: (value: string) => boolean;
	/** Whether this is runtime state (not configuration) */
	isRuntimeState?: boolean;
}

/**
 * EnvironmentConfigProvider extracts configuration from environment variables
 * Single responsibility: Environment variable configuration extraction
 */
export class EnvironmentConfigProvider {
	private readonly logger = getLogger('EnvironmentConfigProvider');

	/**
	 * Default environment variable mappings
	 */
	private static readonly DEFAULT_MAPPINGS: EnvMapping[] = [
		{
			env: 'TASKMASTER_STORAGE_TYPE',
			path: ['storage', 'type'],
			validate: (v: string) => ['file', 'api'].includes(v)
		},
		{ env: 'TASKMASTER_API_ENDPOINT', path: ['storage', 'apiEndpoint'] },
		{ env: 'TASKMASTER_API_TOKEN', path: ['storage', 'apiAccessToken'] },
		{ env: 'TASKMASTER_MODEL_MAIN', path: ['models', 'main'] },
		{ env: 'TASKMASTER_MODEL_RESEARCH', path: ['models', 'research'] },
		{ env: 'TASKMASTER_MODEL_FALLBACK', path: ['models', 'fallback'] },
		{
			env: 'TASKMASTER_RESPONSE_LANGUAGE',
			path: ['custom', 'responseLanguage']
		}
	];

	/**
	 * Runtime state mappings (separate from configuration)
	 */
	private static readonly RUNTIME_STATE_MAPPINGS: EnvMapping[] = [
		{ env: 'TASKMASTER_TAG', path: ['activeTag'], isRuntimeState: true }
	];

	private mappings: EnvMapping[];
	private readonly CMD_PREFIX = '!cmd:';

	constructor(customMappings?: EnvMapping[]) {
		this.mappings = customMappings || [
			...EnvironmentConfigProvider.DEFAULT_MAPPINGS,
			...EnvironmentConfigProvider.RUNTIME_STATE_MAPPINGS
		];
	}

	/**
	 * Parse timeout from TASKMASTER_CMD_TIMEOUT environment variable
	 * @returns Timeout in milliseconds (default: 5000ms)
	 * @private
	 */
	private parseTimeout(): number {
		const raw = process.env.TASKMASTER_CMD_TIMEOUT;
		if (!raw) return 5000;

		const n = parseInt(raw, 10);
		if (!Number.isFinite(n) || n <= 0) return 5000;

		// Heuristic: <=60 => seconds; else milliseconds
		return n <= 60 ? n * 1000 : n;
	}

	/**
	 * Execute a command to retrieve an environment variable value
	 * Security: Never logs the command or its output
	 * @param command - The shell command to execute
	 * @param envName - The environment variable name (for error logging)
	 * @returns The trimmed command output or null on failure
	 * @private
	 */
	private executeCommand(command: string, envName: string): string | null {
		try {
			const timeout = this.parseTimeout();
			const result = execSync(command, {
				encoding: 'utf8',
				timeout,
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: true
			});

			const trimmed = (result ?? '').trim();
			if (!trimmed) {
				throw new Error('empty-result');
			}

			return trimmed;
		} catch (err: any) {
			const reason = err?.killed
				? 'timeout'
				: (err?.status ?? err?.code ?? 'exec-failed');
			this.logger.error(`Error executing command for ${envName}: ${String(reason)}`);
			return null;
		}
	}

	/**
	 * Resolve environment variable value, handling !cmd: prefix
	 * @param value - The raw environment variable value
	 * @param envName - The environment variable name
	 * @returns The resolved value or null if command failed
	 * @private
	 */
	private resolveValue(value: string, envName: string): string | null {
		if (!value.startsWith(this.CMD_PREFIX)) {
			return value;
		}

		const command = value.slice(this.CMD_PREFIX.length).trim();
		if (!command) {
			this.logger.warn(`Empty command for ${envName}`);
			return null;
		}

		return this.executeCommand(command, envName);
	}

	/**
	 * Load configuration from environment variables
	 */
	loadConfig(): PartialConfiguration {
		const config: PartialConfiguration = {};

		for (const mapping of this.mappings) {
			// Skip runtime state variables
			if (mapping.isRuntimeState) continue;

			const value = process.env[mapping.env];
			if (!value) continue;

			// Validate value if validator is provided
			if (mapping.validate && !mapping.validate(value)) {
				this.logger.warn(`Invalid value for ${mapping.env}: ${value}`);
				continue;
			}

			// Set the value in the config object
			this.setNestedProperty(config, mapping.path, value);
		}

		return config;
	}

	/**
	 * Get runtime state from environment variables
	 */
	getRuntimeState(): Record<string, string> {
		const state: Record<string, string> = {};

		for (const mapping of this.mappings) {
			if (!mapping.isRuntimeState) continue;

			const value = process.env[mapping.env];
			if (value) {
				const key = mapping.path[mapping.path.length - 1];
				state[key] = value;
			}
		}

		return state;
	}

	/**
	 * Helper to set a nested property in an object
	 */
	private setNestedProperty(
		obj: any,
		path: readonly string[],
		value: any
	): void {
		const lastKey = path[path.length - 1];
		const keys = path.slice(0, -1);

		let current = obj;
		for (const key of keys) {
			if (!current[key]) {
				current[key] = {};
			}
			current = current[key];
		}

		current[lastKey] = value;
	}

	/**
	 * Check if an environment variable is set
	 */
	hasEnvVar(envName: string): boolean {
		return envName in process.env && process.env[envName] !== undefined;
	}

	/**
	 * Get all environment variables that match our prefix
	 */
	getAllTaskmasterEnvVars(): Record<string, string> {
		const vars: Record<string, string> = {};
		const prefix = 'TASKMASTER_';

		for (const [key, value] of Object.entries(process.env)) {
			if (key.startsWith(prefix) && value !== undefined) {
				vars[key] = value;
			}
		}

		return vars;
	}

	/**
	 * Add a custom mapping
	 */
	addMapping(mapping: EnvMapping): void {
		this.mappings.push(mapping);
	}

	/**
	 * Get current mappings
	 */
	getMappings(): EnvMapping[] {
		return [...this.mappings];
	}
}
