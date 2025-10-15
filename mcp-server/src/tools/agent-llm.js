import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withNormalizedProjectRoot, createErrorResponse } from './utils.js';

/**
 * This tool supports two modes for agent interaction:
 * 1. Taskmaster -> Agent Delegation:
 *    - `delegatedCallDetails`: (Required) Details of the LLM call for the agent.
 *    - `interactionId`: (Optional) An existing ID to track the interaction.
 *    - `projectRoot`: (Required) Absolute path to the project (standardized across tools).
 * 2. Agent -> Taskmaster Response:
 *    - `agentLLMResponse`: (Required) The agent's response.
 *    - `interactionId`: (Required) The ID from the initial delegation.
 *    - `projectRoot`: (Required) Absolute path to the project.
 * Sending any unrecognized top-level keys will cause an error.
 */
const agentLLMParameters = z
	.object({
		interactionId: z
			.string()
			.optional()
			.describe(
				'ID to track the interaction across calls. Provided by the agent when responding.'
			),
		delegatedCallDetails: z
			.object({
				originalCommand: z
					.string()
					.describe('The MCP command that initiated this delegated LLM call.'),
				role: z
					.string()
					.describe('The AI role for which the LLM call was intended.'),
				serviceType: z
					.enum(['generateText', 'streamText', 'generateObject'])
					.describe('The type of LLM service requested.'),
				requestParameters: z
					.any()
					.describe(
						'The actual parameters for the LLM call (messages, modelId, schema, etc.).'
					)
			})
			.optional()
			.describe(
				'Details of the LLM call to be delegated to the agent. Sent by Taskmaster.'
			),
		agentLLMResponse: z
			.object({
				status: z
					.enum(['success', 'error'])
					.describe('Status of the LLM call made by the agent.'),
				data: z
					.any()
					.optional()
					.describe('The LLM response data (text, object) from the agent.'),
				errorDetails: z
					.any()
					.optional()
					.describe("Error details if the agent's LLM call failed.")
			})
			.optional()
			.describe('The LLM response from the agent. Sent by Agent.'),
		projectRoot: z
			.string()
			.describe('The directory of the project. Must be an absolute path.'),
		tag: z
			.string()
			.optional()
			.describe('Optional context tag for multi-context/multi-agent routing')
	})
	.strict();

function registerAgentLLMTool(server) {
	server.addTool({
		name: 'agent_llm',
		description:
			'Manages delegated LLM calls via an agent. Taskmaster uses this to request an LLM call from an agent. The agent uses this to return the LLM response.',
		parameters: agentLLMParameters,
		execute: withNormalizedProjectRoot(async (args, { log, session }) => {
			try {
				const preview = (() => {
					try {
						const raw = JSON.stringify(args);
						return raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
					} catch {
						return '[unserializable args]';
					}
				})();
				log.debug(`agent_llm tool called with args: ${preview}`);

				// Ensure mutual exclusivity
				if (args.delegatedCallDetails && args.agentLLMResponse) {
					const errorMsg =
						"Invalid parameters: Cannot provide both 'delegatedCallDetails' and 'agentLLMResponse'.";
					log.warn(`agent_llm: ${errorMsg}`);
					return createErrorResponse(errorMsg, { mcpToolError: true });
				}

				if (args.llmRequestForAgent) {
					const effectiveInteractionId = args.interactionId || uuidv4();
					log.info(
						`agent_llm: Taskmaster delegating LLM call for command '${args.llmRequestForAgent.originalCommand}' to agent. Interaction ID: ${effectiveInteractionId}`
					);

					return {
						toolResponseSource: 'taskmaster_to_agent',
						status: 'pending_agent_llm_action',
						message:
							'Taskmaster requires an LLM call from the Assistant/Agent (you). Details provided in the instructions.',
						llmRequestForAgent: args.llmRequestForAgent,
						interactionId: effectiveInteractionId,
						pendingInteractionSignalToAgent: {
							type: 'agent_must_respond_via_agent_llm',
							interactionId: effectiveInteractionId,
							instructions:
								"Assistant/Agent, please perform the LLM call using 'requestParameters' and invoke 'agent_llm' tool with your response, include 'agentLLMResponse', this 'interactionId' and 'projectRoot' parameters, exclude 'delegatedCallDetails'."
						}
					};
				} else if (args.agentLLMResponse) {
					if (!args.interactionId) {
						const errorMsg =
							'agent_llm: Agent response is missing interactionId.';
						log.warn(errorMsg);
						return createErrorResponse(errorMsg, { mcpToolError: true });
					}

					const { status, data, errorDetails } = args.agentLLMResponse;

					if (status === 'success' && typeof data === 'undefined') {
						const errorMsg =
							'agent_llm: Agent response has status "success" but is missing the "data" field.';
						log.warn(errorMsg);
						return createErrorResponse(errorMsg, { mcpToolError: true });
					}

					if (status === 'error' && typeof errorDetails === 'undefined') {
						const errorMsg =
							'agent_llm: Agent response has status "error" but is missing the "errorDetails" field.';
						log.warn(errorMsg);
						return createErrorResponse(errorMsg, { mcpToolError: true });
					}

					log.info(
						`agent_llm: Agent providing LLM response for interaction ID: ${args.interactionId}`
					);

					const taskmasterInternalResponse = {
						toolResponseSource: 'agent_to_taskmaster',
						status:
							status === 'success'
								? 'llm_response_completed'
								: 'llm_response_error',
						finalLLMOutput: data,
						error: errorDetails,
						interactionId: args.interactionId
					};

					return taskmasterInternalResponse;
				} else {
					const errorMsg =
						"Invalid parameters for agent_llm tool: Must provide either 'delegatedCallDetails' or 'agentLLMResponse'.";
					log.warn(`agent_llm: ${errorMsg} Args: ${preview}`);
					return createErrorResponse(errorMsg, { mcpToolError: true });
				}
			} catch (error) {
				if (error instanceof z.ZodError) {
					const errorMsg = (() => {
						try {
							return `Invalid parameters for agent_llm tool: ${z.treeifyError(error)}`;
						} catch {
							const msgs = error.issues?.map((e) => e.message).join(', ');
							return `Invalid parameters for agent_llm tool: ${msgs || error.message}`;
						}
					})();
					const errorPreview = (() => {
						try {
							const raw = JSON.stringify(args);
							return raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
						} catch {
							return '[unserializable args]';
						}
					})();
					log.warn(`agent_llm: ${errorMsg} Args: ${errorPreview}`);
					return createErrorResponse(errorMsg, { mcpToolError: true });
				}
				throw error;
			}
		})
	});
}

export { registerAgentLLMTool, agentLLMParameters };
