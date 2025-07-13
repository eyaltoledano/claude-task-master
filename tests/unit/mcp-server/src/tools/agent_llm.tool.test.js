import { jest } from '@jest/globals'; // Ensure jest is imported for unstable_mockModule
import {
	createErrorResponse as actualCreateErrorResponse,
	withNormalizedProjectRoot as actualWithNormalizedProjectRoot
} from '../../../../../mcp-server/src/tools/utils.js';

// Mock uuid to return a fixed value for predictable interactionId testing
// Changed to unstable_mockModule and used jest.fn()
jest.unstable_mockModule('uuid', () => ({
	v4: jest.fn(() => 'fixed-uuid-for-test')
}));

// Mock parts of the utils module
jest.unstable_mockModule('../../../../../mcp-server/src/tools/utils.js', () => {
	// Since agent_llm.js uses withNormalizedProjectRoot and createErrorResponse, they must be mocked.
	// Other functions from utils.js might not need explicit mocks if not directly called by agent_llm.js
	// or if their actual implementation is fine for these tests.
	// const originalModule = jest.requireActual('../../../../../mcp-server/src/tools/utils.js'); // Not strictly needed if we mock all used ones
	return {
		// ...originalModule, // Spread original if some non-mocked functions are needed by agent_llm.js
		__esModule: true, // Good practice for ESM mocks
		withNormalizedProjectRoot: jest.fn((fn) => fn), // Pass-through for HOF
		createErrorResponse: jest.fn((message, options) => ({
			// Mock consistent with existing tests
			content: [{ type: 'text', text: `Error: ${message}` }],
			isError: true,
			mcpToolError: options?.mcpToolError || false,
			errorDetails: message
		}))
	};
});

describe('agent_llm MCP Tool', () => {
	let registerAgentLLMTool;
	let execute;
	let mockLog;
	let mockSession;
	let utilsModule; // To hold the dynamically imported utils

	beforeAll(async () => {
		// Dynamically import modules after mocks are set up
		const agentLLMModule = await import(
			'../../../../../mcp-server/src/tools/agent_llm.js'
		);
		registerAgentLLMTool = agentLLMModule.registerAgentLLMTool;
		utilsModule = await import('../../../../../mcp-server/src/tools/utils.js');
		// Note: If tests need to access uuidV4 directly, it should also be dynamically imported here:
		// const uuid = await import('uuid');
		// uuidV4 = uuid.v4; // if needed
	});

	beforeEach(() => {
		// Reset mocks for each test
		jest.clearAllMocks(); // Clears all mocks, including those from jest.fn() in uuid and utilsModule

		const mockServer = {
			addTool: jest.fn((tool) => {
				if (tool.name === 'agent_llm') {
					execute = tool.execute;
				}
			})
		};
		// Ensure registerAgentLLMTool is available from beforeAll
		if (registerAgentLLMTool) {
			registerAgentLLMTool(mockServer);
		} else {
			// This might happen if beforeAll didn't complete or agent_llm.js failed to import
			throw new Error(
				'registerAgentLLMTool was not loaded by beforeAll. Ensure agent_llm.js can be imported.'
			);
		}

		mockLog = {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		};
		mockSession = {
			// projectRoot will be passed in args directly as per withNormalizedProjectRoot's effect
		};
	});

	test('Taskmaster-to-Agent flow: should generate interactionId if not provided', async () => {
		const args = {
			delegatedCallDetails: {
				originalCommand: 'testCmd',
				role: 'main',
				serviceType: 'generateText',
				requestParameters: { prompt: 'test' }
			},
			projectRoot: '/test/root' // projectRoot is expected in args by the tool's execute
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		expect(result.toolResponseSource).toBe('taskmaster_to_agent');
		expect(result.status).toBe('pending_agent_llm_action');
		expect(result.interactionId).toBe('fixed-uuid-for-test'); // uuid is mocked
		expect(result.llmRequestForAgent).toEqual({ prompt: 'test' });
		expect(result.pendingInteractionSignalToAgent).toBeDefined();
		expect(result.pendingInteractionSignalToAgent.interactionId).toBe(
			'fixed-uuid-for-test'
		);
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining(
				"Taskmaster delegating LLM call for command 'testCmd' to agent. Interaction ID: fixed-uuid-for-test"
			)
		);
	});

	test('Taskmaster-to-Agent flow: should use provided interactionId', async () => {
		const args = {
			interactionId: 'provided-id-123',
			delegatedCallDetails: {
				originalCommand: 'testCmdWithId',
				role: 'research',
				serviceType: 'generateObject',
				requestParameters: { prompt: 'test obj' }
			},
			projectRoot: '/test/root'
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		expect(result.interactionId).toBe('provided-id-123');
		expect(result.pendingInteractionSignalToAgent.interactionId).toBe(
			'provided-id-123'
		);
		expect(mockLog.info).toHaveBeenCalledWith(
			expect.stringContaining('Interaction ID: provided-id-123')
		);
	});

	test('Agent-to-Taskmaster flow (success)', async () => {
		const args = {
			agentLLMResponse: {
				status: 'success',
				data: { text: 'llm output' }
			},
			interactionId: 'existing-uuid-success',
			projectRoot: '/test/root'
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		expect(result.toolResponseSource).toBe('agent_to_taskmaster');
		expect(result.status).toBe('llm_response_completed');
		expect(result.finalLLMOutput).toEqual({ text: 'llm output' });
		expect(result.interactionId).toBe('existing-uuid-success');
		expect(mockLog.info).toHaveBeenCalledWith(
			'agent_llm: Agent providing LLM response for interaction ID: existing-uuid-success'
		);
	});

	test('Agent-to-Taskmaster flow (error response from agent)', async () => {
		const args = {
			agentLLMResponse: {
				status: 'error',
				errorDetails: { message: 'agent LLM error' }
			},
			interactionId: 'existing-uuid-agent-error',
			projectRoot: '/test/root'
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		expect(result.toolResponseSource).toBe('agent_to_taskmaster');
		expect(result.status).toBe('llm_response_error');
		expect(result.error).toEqual({ message: 'agent LLM error' });
		expect(result.interactionId).toBe('existing-uuid-agent-error');
	});

	test('Error: Missing interactionId from Agent', async () => {
		const args = {
			agentLLMResponse: {
				status: 'success',
				data: 'output'
			},
			projectRoot: '/test/root'
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		// Check based on the mocked createErrorResponse
		expect(utilsModule.createErrorResponse).toHaveBeenCalledWith(
			'agent_llm: Agent response is missing interactionId.',
			{ mcpToolError: true }
		);
		expect(result.isError).toBe(true);
		expect(result.errorDetails).toContain(
			'agent_llm: Agent response is missing interactionId.'
		);
		expect(mockLog.warn).toHaveBeenCalledWith(
			'agent_llm: Agent response is missing interactionId.'
		);
	});

	test('Error: Invalid Parameters (neither delegatedCallDetails nor agentLLMResponse)', async () => {
		const args = {
			projectRoot: '/test/root' // Only projectRoot
		};
		const result = await execute(args, { log: mockLog, session: mockSession });

		expect(utilsModule.createErrorResponse).toHaveBeenCalledWith(
			"Invalid parameters for agent_llm tool: Must provide either 'delegatedCallDetails' or 'agentLLMResponse'.",
			{ mcpToolError: true }
		);
		expect(result.isError).toBe(true);
		expect(result.errorDetails).toContain(
			'Invalid parameters for agent_llm tool'
		);
		expect(mockLog.warn).toHaveBeenCalledWith(
			expect.stringContaining('Invalid parameters for agent_llm tool')
		);
	});
});
