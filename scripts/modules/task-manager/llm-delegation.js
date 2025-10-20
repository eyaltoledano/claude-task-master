import { createLogger } from '../utils.js';

const logger = createLogger();

/**
 * Handles the agent_llm_delegation signal from the AI service.
 * Consolidated function that handles all delegation scenarios: general, research, and parse-prd.
 *
 * @param {object} aiServiceResponse - The response from the AI service.
 * @param {object} context - The command context.
 * @param {string} serviceRole - The service role ('main' or 'research').
 * @param {object} delegationContext - Additional context for the delegation.
 * @param {object} options - Additional options for different delegation types.
 * @param {string} [options.serviceType='generateObject'] - The service type for the agent.
 * @param {string} [options.commandName] - Override for command name (defaults to context.commandName).
 * @param {string} [options.query] - Research query (for research delegation).
 * @param {string} [options.detailLevel] - Detail level (for research delegation).
 * @param {object} [options.config] - Config object (for parse-prd delegation).
 * @param {boolean} [options.returnErrorAsSuccess=false] - Whether to return errors as success objects (for parse-prd compatibility).
 * @returns {object|null} A pending interaction object for agent delegation, or null if not a delegation.
 */
export function handleAgentLLMDelegation(
	aiServiceResponse,
	context,
	serviceRole,
	delegationContext = {},
	options = {}
) {
	// Extract options with defaults
	const {
		serviceType = 'generateObject',
		commandName = context?.commandName,
		query = null,
		detailLevel = null,
		config = null,
		returnErrorAsSuccess = false
	} = options;

	if (
		aiServiceResponse &&
		aiServiceResponse.mainResult &&
		aiServiceResponse.mainResult.type === 'agent_llm_delegation'
	) {
		if (
			!aiServiceResponse.mainResult.interactionId ||
			!aiServiceResponse.mainResult.details
		) {
			logger.error(
				`${commandName || 'unknown'}: delegation signal missing interactionId or details`
			);
			return {
				needsAgentDelegation: true,
				error: 'Malformed delegation signal'
			};
		}
		logger.debug(
			`${commandName || 'unknown'} (core): Detected agent_llm_delegation signal.`
		);

		// Create base pendingInteraction
		const pendingInteraction = {
			type: 'agent_llm',
			interactionId: aiServiceResponse.mainResult.interactionId,
			llmRequestForAgent: {
				originalCommand: commandName || context?.commandName || 'unknown',
				role: serviceRole,
				serviceType: serviceType,
				requestParameters: {
					...aiServiceResponse.mainResult.details,
					...delegationContext
				}
			}
		};

		// Add tagInfo if available
		if (aiServiceResponse.tagInfo) {
			pendingInteraction.llmRequestForAgent.requestParameters.tagInfo =
				aiServiceResponse.tagInfo;
		}

		// Handle parse-prd specific logic
		if (config && returnErrorAsSuccess) {
			try {
				return {
					success: true,
					needsAgentDelegation: true,
					pendingInteraction,
					message: 'Awaiting LLM processing via agent-llm for PRD parsing.',
					telemetryData: aiServiceResponse?.telemetryData ?? null
				};
			} catch (err) {
				logger.error(
					`parsePRD: Failed to construct pendingInteraction - ${err.message}`
				);
				return {
					success: false,
					isError: true,
					errorMessage: `Failed to prepare agent delegation payload: ${err.message}`
				};
			}
		}

		// Standard return for general and research use cases
		return {
			needsAgentDelegation: true,
			pendingInteraction,
			telemetryData: aiServiceResponse?.telemetryData ?? null,
			tagInfo: aiServiceResponse?.tagInfo,
			// Include research-specific fields if provided
			...(query && { query }),
			...(detailLevel && { detailLevel })
		};
	}
	return null;
}
