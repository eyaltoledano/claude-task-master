import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock BaseAIProvider to avoid circular imports
const mockValidateOptionalParams = jest.fn();
class MockBaseAIProvider {
	constructor() {
		this.name = this.constructor.name;
	}
	validateOptionalParams = mockValidateOptionalParams;
}

// Mock the base provider import
jest.unstable_mockModule('../../src/ai-providers/base-provider.js', () => ({
	BaseAIProvider: MockBaseAIProvider
}));

// Mock the logger
jest.unstable_mockModule('../../scripts/modules/index.js', () => ({
	log: jest.fn()
}));

// Now import the MCP provider
const { MCPAIProvider } = await import('../../src/ai-providers/mcp-provider.js');

describe('MCPAIProvider', () => {
	let provider;
	let mockSession;

	beforeEach(() => {
		provider = new MCPAIProvider();
		
		// Mock MCP session with sampling capability
		mockSession = {
			clientCapabilities: {
				sampling: {} // Session supports MCP sampling
			},
			requestSampling: jest.fn()
		};
	});

	describe('isAvailable', () => {
		it('should return true when session has sampling capability', () => {
			const result = MCPAIProvider.isAvailable({ session: mockSession });
			expect(result).toBe(true);
		});

		it('should return false when session is missing', () => {
			const result = MCPAIProvider.isAvailable({});
			expect(result).toBe(false);
		});
	});

	describe('validateAuth', () => {
		it('should pass validation with valid session', () => {
			expect(() => {
				provider.validateAuth({ session: mockSession });
			}).not.toThrow();
		});

		it('should throw error when session is missing', () => {
			expect(() => {
				provider.validateAuth({});
			}).toThrow('MCP provider requires session context');
		});
	});

	describe('generateText', () => {
		it('should generate text using sampling', async () => {
			const mockResult = {
				content: {
					text: 'Generated text response'
				},
				stopReason: 'stop'
			};

			mockSession.requestSampling.mockResolvedValue(mockResult);

			const result = await provider.generateText({
				session: mockSession,
				modelId: 'mcp-sampling',
				messages: [{ role: 'user', content: 'Hello' }]
			});

			expect(result).toEqual({
				text: 'Generated text response',
				finishReason: 'stop',
				usage: {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				},
				rawResponse: mockResult
			});
		});
	});

	describe('getAvailableModels', () => {
		it('should return mcp-sampling model when session has sampling capability', () => {
			const models = MCPAIProvider.getAvailableModels(mockSession);
			
			expect(models).toEqual([
				{
					id: 'mcp-sampling',
					name: 'MCP Sampling',
					description: 'Use MCP client for text generation via sampling',
					provider: 'mcp'
				}
			]);
		});

		it('should return empty array when session is null', () => {
			const models = MCPAIProvider.getAvailableModels(null);
			expect(models).toEqual([]);
		});
	});
});
