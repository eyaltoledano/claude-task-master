import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Integration test for MCP Provider
 * Tests that MCP provider integrates correctly with the overall system
 */
describe('MCP Provider Integration', () => {
	let mockSession;

	beforeEach(() => {
		// Mock MCP session with typical structure
		mockSession = {
			capabilities: {
				tools: [
					{
						name: 'text-generation',
						displayName: 'Text Generation',
						description: 'Generate text using AI'
					},
					{
						name: 'research',
						displayName: 'Research Tool',
						description: 'Perform research queries'
					}
				]
			},
			callTool: async (toolName, parameters) => {
				// Mock successful tool call
				return {
					content: `Mock response from ${toolName}`,
					finishReason: 'stop',
					usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
				};
			}
		};
	});

	describe('Provider Registry Integration', () => {
		it('should be available in the provider registry', async () => {
			// Test that MCP provider is properly registered
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			expect(MCPAIProvider).toBeDefined();
			expect(MCPAIProvider.name).toBe('MCPAIProvider');
		});

		it('should be exported from provider index', async () => {
			const providers = await import('../../src/ai-providers/index.js');
			expect(providers.MCPAIProvider).toBeDefined();
		});
	});

	describe('Configuration Integration', () => {
		it('should be included in supported models', async () => {
			const models = await import('../../scripts/modules/supported-models.json', {
				assert: { type: 'json' }
			});
			
			expect(models.default.mcp).toBeDefined();
			expect(Array.isArray(models.default.mcp)).toBe(true);
			expect(models.default.mcp.length).toBeGreaterThan(0);
			
			// Check that basic models are available
			const modelIds = models.default.mcp.map(m => m.id);
			expect(modelIds).toContain('text-generation');
			expect(modelIds).toContain('research');
			expect(modelIds).toContain('analysis');
		});

		it('should validate mcp as a supported provider', async () => {
			const { validateProvider } = await import('../../scripts/modules/config-manager.js');
			expect(validateProvider('mcp')).toBe(true);
		});
	});

	describe('Session Detection', () => {
		it('should detect valid MCP sessions', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			
			const isAvailable = MCPAIProvider.isAvailable({ session: mockSession });
			expect(isAvailable).toBe(true);
		});

		it('should reject invalid sessions', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			
			expect(MCPAIProvider.isAvailable({})).toBe(false);
			expect(MCPAIProvider.isAvailable({ session: {} })).toBe(false);
			expect(MCPAIProvider.isAvailable({ session: { capabilities: {} } })).toBe(false);
		});
	});

	describe('Model Discovery', () => {
		it('should discover available models from session', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			
			const models = MCPAIProvider.getAvailableModels(mockSession);
			expect(models).toHaveLength(2);
			
			expect(models[0]).toEqual({
				id: 'text-generation',
				name: 'Text Generation',
				description: 'Generate text using AI',
				provider: 'mcp'
			});
			
			expect(models[1]).toEqual({
				id: 'research',
				name: 'Research Tool', 
				description: 'Perform research queries',
				provider: 'mcp'
			});
		});
	});

	describe('Error Handling', () => {
		it('should handle missing session gracefully', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			const provider = new MCPAIProvider();
			
			await expect(provider.generateText({
				modelId: 'text-generation',
				messages: [{ role: 'user', content: 'test' }]
			})).rejects.toThrow('MCP provider requires session context');
		});

		it('should handle unavailable tools gracefully', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			const provider = new MCPAIProvider();
			
			await expect(provider.generateText({
				session: mockSession,
				modelId: 'nonexistent-tool',
				messages: [{ role: 'user', content: 'test' }]
			})).rejects.toThrow("MCP tool 'nonexistent-tool' not available in current session");
		});
	});

	describe('Basic Operations', () => {
		it('should perform text generation successfully', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			const provider = new MCPAIProvider();
			
			const result = await provider.generateText({
				session: mockSession,
				modelId: 'text-generation',
				messages: [{ role: 'user', content: 'Hello' }]
			});
			
			expect(result.text).toBe('Mock response from text-generation');
			expect(result.finishReason).toBe('stop');
			expect(result.usage).toBeDefined();
		});

		it('should handle streaming text operation', async () => {
			const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');
			const provider = new MCPAIProvider();
			
			const result = await provider.streamText({
				session: mockSession,
				modelId: 'text-generation',
				messages: [{ role: 'user', content: 'Hello' }]
			});
			
			expect(result.text).toBe('Mock response from text-generation');
			expect(result.textStream).toBeDefined();
			
			// Test the stream
			const chunks = [];
			for await (const chunk of result.textStream) {
				chunks.push(chunk);
			}
			expect(chunks).toEqual(['Mock response from text-generation']);
		});
	});

	describe('Configuration Compatibility', () => {
		it('should work with role-based configuration', async () => {
			// Test that MCP provider models have correct role assignments
			const models = await import('../../scripts/modules/supported-models.json', {
				assert: { type: 'json' }
			});
			
			const mcpModels = models.default.mcp;
			
			// text-generation should support all roles
			const textGen = mcpModels.find(m => m.id === 'text-generation');
			expect(textGen.allowed_roles).toContain('main');
			expect(textGen.allowed_roles).toContain('fallback');
			expect(textGen.allowed_roles).toContain('research');
			
			// research should support research role
			const research = mcpModels.find(m => m.id === 'research');
			expect(research.allowed_roles).toContain('research');
		});
	});
});
