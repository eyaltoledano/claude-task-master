/**
 * tests/unit/mcp-providers/mcp-provider.test.js
 * Unit tests for MCP provider
 */

import { jest } from '@jest/globals';

describe('MCPProvider', () => {
	let MCPProvider;
	let provider;

	beforeAll(async () => {
		// Dynamic import to avoid circular dependency issues
		const module = await import(
			'../../../mcp-server/src/providers/mcp-provider.js'
		);
		MCPProvider = module.MCPProvider;
	});

	beforeEach(() => {
		provider = new MCPProvider();
	});

	describe('constructor', () => {
		it('should initialize with correct name', () => {
			expect(provider.name).toBe('mcp');
		});

		it('should initialize with null session', () => {
			expect(provider.session).toBeNull();
		});
	});

	describe('isRequiredApiKey', () => {
		it('should return false (no API key required)', () => {
			expect(provider.isRequiredApiKey()).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should throw error when no session', () => {
			expect(() => provider.validateAuth({})).toThrow(
				'MCP Provider requires active MCP session'
			);
		});

		it('should throw error when session lacks sampling capabilities', () => {
			provider.session = {
				clientCapabilities: {}
			};

			expect(() => provider.validateAuth({})).toThrow(
				'MCP session must have client sampling capabilities'
			);
		});

		it('should pass validation with valid session', () => {
			provider.session = {
				clientCapabilities: {
					sampling: true
				}
			};

			expect(() => provider.validateAuth({})).not.toThrow();
		});
	});

	describe('setSession', () => {
		it('should set session when provided', () => {
			const mockSession = {
				clientCapabilities: { sampling: true }
			};

			provider.setSession(mockSession);
			expect(provider.session).toBe(mockSession);
		});

		it('should handle null session gracefully', () => {
			provider.setSession(null);
			expect(provider.session).toBeNull();
		});
	});

	describe('hasValidSession', () => {
		it('should return false when no session', () => {
			expect(provider.hasValidSession()).toBe(false);
		});

		it('should return false when session lacks sampling capabilities', () => {
			provider.session = {
				clientCapabilities: {}
			};

			expect(provider.hasValidSession()).toBe(false);
		});

		it('should return true with valid session', () => {
			provider.session = {
				clientCapabilities: {
					sampling: true
				}
			};

			expect(provider.hasValidSession()).toBe(true);
		});
	});
});
