/**
 * @fileoverview Unit tests for EnvironmentConfigProvider service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentConfigProvider } from './environment-config-provider.service.js';

describe('EnvironmentConfigProvider', () => {
	let provider: EnvironmentConfigProvider;
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear all TASKMASTER_ env vars
		Object.keys(process.env).forEach((key) => {
			if (key.startsWith('TASKMASTER_')) {
				delete process.env[key];
			}
		});
		provider = new EnvironmentConfigProvider();
	});

	afterEach(() => {
		// Restore original environment
		process.env = { ...originalEnv };
	});

	describe('loadConfig', () => {
		it('should load configuration from environment variables', () => {
			process.env.TASKMASTER_STORAGE_TYPE = 'api';
			process.env.TASKMASTER_API_ENDPOINT = 'https://api.example.com';
			process.env.TASKMASTER_MODEL_MAIN = 'gpt-4';

			const config = provider.loadConfig();

			expect(config).toEqual({
				storage: {
					type: 'api',
					apiEndpoint: 'https://api.example.com'
				},
				models: {
					main: 'gpt-4'
				}
			});
		});

		it('should return empty object when no env vars are set', () => {
			const config = provider.loadConfig();
			expect(config).toEqual({});
		});

		it('should skip runtime state variables', () => {
			process.env.TASKMASTER_TAG = 'feature-branch';
			process.env.TASKMASTER_MODEL_MAIN = 'claude-3';

			const config = provider.loadConfig();

			expect(config).toEqual({
				models: { main: 'claude-3' }
			});
			expect(config).not.toHaveProperty('activeTag');
		});

		it('should validate storage type values', () => {
			// Mock console.warn to check validation
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			process.env.TASKMASTER_STORAGE_TYPE = 'invalid';

			const config = provider.loadConfig();

			expect(config).toEqual({});
			expect(warnSpy).toHaveBeenCalledWith(
				'Invalid value for TASKMASTER_STORAGE_TYPE: invalid'
			);

			warnSpy.mockRestore();
		});

		it('should accept valid storage type values', () => {
			process.env.TASKMASTER_STORAGE_TYPE = 'file';
			let config = provider.loadConfig();
			expect(config.storage?.type).toBe('file');

			process.env.TASKMASTER_STORAGE_TYPE = 'api';
			provider = new EnvironmentConfigProvider(); // Reset provider
			config = provider.loadConfig();
			expect(config.storage?.type).toBe('api');
		});

		it('should handle nested configuration paths', () => {
			process.env.TASKMASTER_MODEL_MAIN = 'model1';
			process.env.TASKMASTER_MODEL_RESEARCH = 'model2';
			process.env.TASKMASTER_MODEL_FALLBACK = 'model3';

			const config = provider.loadConfig();

			expect(config).toEqual({
				models: {
					main: 'model1',
					research: 'model2',
					fallback: 'model3'
				}
			});
		});

		it('should handle custom response language', () => {
			process.env.TASKMASTER_RESPONSE_LANGUAGE = 'Spanish';

			const config = provider.loadConfig();

			expect(config).toEqual({
				custom: {
					responseLanguage: 'Spanish'
				}
			});
		});

		it('should ignore empty string values', () => {
			process.env.TASKMASTER_MODEL_MAIN = '';
			process.env.TASKMASTER_MODEL_FALLBACK = 'fallback-model';

			const config = provider.loadConfig();

			expect(config).toEqual({
				models: {
					fallback: 'fallback-model'
				}
			});
		});
	});

	describe('getRuntimeState', () => {
		it('should extract runtime state variables', () => {
			process.env.TASKMASTER_TAG = 'develop';
			process.env.TASKMASTER_MODEL_MAIN = 'model'; // Should not be included

			const state = provider.getRuntimeState();

			expect(state).toEqual({
				activeTag: 'develop'
			});
		});

		it('should return empty object when no runtime state vars', () => {
			process.env.TASKMASTER_MODEL_MAIN = 'model';

			const state = provider.getRuntimeState();

			expect(state).toEqual({});
		});
	});

	describe('hasEnvVar', () => {
		it('should return true when env var exists', () => {
			process.env.TASKMASTER_MODEL_MAIN = 'test';

			expect(provider.hasEnvVar('TASKMASTER_MODEL_MAIN')).toBe(true);
		});

		it('should return false when env var does not exist', () => {
			expect(provider.hasEnvVar('TASKMASTER_NONEXISTENT')).toBe(false);
		});

		it('should return false for undefined values', () => {
			process.env.TASKMASTER_TEST = undefined as any;

			expect(provider.hasEnvVar('TASKMASTER_TEST')).toBe(false);
		});
	});

	describe('getAllTaskmasterEnvVars', () => {
		it('should return all TASKMASTER_ prefixed variables', () => {
			process.env.TASKMASTER_VAR1 = 'value1';
			process.env.TASKMASTER_VAR2 = 'value2';
			process.env.OTHER_VAR = 'other';
			process.env.TASK_MASTER = 'wrong-prefix';

			const vars = provider.getAllTaskmasterEnvVars();

			expect(vars).toEqual({
				TASKMASTER_VAR1: 'value1',
				TASKMASTER_VAR2: 'value2'
			});
		});

		it('should return empty object when no TASKMASTER_ vars', () => {
			process.env.OTHER_VAR = 'value';

			const vars = provider.getAllTaskmasterEnvVars();

			expect(vars).toEqual({});
		});

		it('should filter out undefined values', () => {
			process.env.TASKMASTER_DEFINED = 'value';
			process.env.TASKMASTER_UNDEFINED = undefined as any;

			const vars = provider.getAllTaskmasterEnvVars();

			expect(vars).toEqual({
				TASKMASTER_DEFINED: 'value'
			});
		});
	});

	describe('custom mappings', () => {
		it('should use custom mappings when provided', () => {
			const customMappings = [{ env: 'CUSTOM_VAR', path: ['custom', 'value'] }];

			const customProvider = new EnvironmentConfigProvider(customMappings);
			process.env.CUSTOM_VAR = 'test-value';

			const config = customProvider.loadConfig();

			expect(config).toEqual({
				custom: {
					value: 'test-value'
				}
			});
		});

		it('should add new mapping with addMapping', () => {
			process.env.NEW_MAPPING = 'new-value';

			provider.addMapping({
				env: 'NEW_MAPPING',
				path: ['new', 'mapping']
			});

			const config = provider.loadConfig();

			expect(config).toHaveProperty('new.mapping', 'new-value');
		});

		it('should return current mappings with getMappings', () => {
			const mappings = provider.getMappings();

			expect(mappings).toBeInstanceOf(Array);
			expect(mappings.length).toBeGreaterThan(0);

			// Check for some expected mappings
			const envNames = mappings.map((m) => m.env);
			expect(envNames).toContain('TASKMASTER_STORAGE_TYPE');
			expect(envNames).toContain('TASKMASTER_MODEL_MAIN');
			expect(envNames).toContain('TASKMASTER_TAG');
		});

		it('should return copy of mappings array', () => {
			const mappings1 = provider.getMappings();
			const mappings2 = provider.getMappings();

			expect(mappings1).not.toBe(mappings2); // Different instances
			expect(mappings1).toEqual(mappings2); // Same content
		});
	});

	describe('validation', () => {
		it('should validate values when validator is provided', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			process.env.TASKMASTER_STORAGE_TYPE = 'database'; // Invalid

			const config = provider.loadConfig();

			expect(config).toEqual({});
			expect(warnSpy).toHaveBeenCalledWith(
				'Invalid value for TASKMASTER_STORAGE_TYPE: database'
			);

			warnSpy.mockRestore();
		});

		it('should accept values that pass validation', () => {
			process.env.TASKMASTER_STORAGE_TYPE = 'file';

			const config = provider.loadConfig();

			expect(config.storage?.type).toBe('file');
		});

		it('should work with custom validators', () => {
			const customProvider = new EnvironmentConfigProvider([
				{
					env: 'CUSTOM_NUMBER',
					path: ['custom', 'number'],
					validate: (v) => !isNaN(Number(v))
				}
			]);

			process.env.CUSTOM_NUMBER = '123';
			let config = customProvider.loadConfig();
			expect(config.custom?.number).toBe('123');

			process.env.CUSTOM_NUMBER = 'not-a-number';
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			customProvider = new EnvironmentConfigProvider([
				{
					env: 'CUSTOM_NUMBER',
					path: ['custom', 'number'],
					validate: (v) => !isNaN(Number(v))
				}
			]);
			config = customProvider.loadConfig();
			expect(config).toEqual({});
			expect(warnSpy).toHaveBeenCalled();

			warnSpy.mockRestore();
		});
	});

	describe('edge cases', () => {
		it('should handle special characters in values', () => {
			process.env.TASKMASTER_API_ENDPOINT =
				'https://api.example.com/v1?key=abc&token=xyz';
			process.env.TASKMASTER_API_TOKEN = 'Bearer abc123!@#$%^&*()';

			const config = provider.loadConfig();

			expect(config.storage?.apiEndpoint).toBe(
				'https://api.example.com/v1?key=abc&token=xyz'
			);
			expect(config.storage?.apiAccessToken).toBe('Bearer abc123!@#$%^&*()');
		});

		it('should handle whitespace in values', () => {
			process.env.TASKMASTER_MODEL_MAIN = '  claude-3  ';

			const config = provider.loadConfig();

			// Note: We're not trimming, preserving the value as-is
			expect(config.models?.main).toBe('  claude-3  ');
		});

		it('should handle very long values', () => {
			const longValue = 'a'.repeat(10000);
			process.env.TASKMASTER_API_TOKEN = longValue;

			const config = provider.loadConfig();

			expect(config.storage?.apiAccessToken).toBe(longValue);
		});
	});
});
