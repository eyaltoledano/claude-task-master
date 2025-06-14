/**
 * ai-services-unified.js
 * Centralized AI service layer using provider modules and config-manager.
 */

// Vercel AI SDK functions are NOT called directly anymore.
// import { generateText, streamText, generateObject } from 'ai';

// --- Core Dependencies ---
import {
	getMainProvider,
	getMainModelId,
	getResearchProvider,
	getResearchModelId,
	getFallbackProvider,
	getFallbackModelId,
	getParametersForRole,
	getUserId,
	MODEL_MAP,
	getDebugFlag,
	getBaseUrlForRole,
	isApiKeySet,
	getOllamaBaseURL,
	getAzureBaseURL,
	getBedrockBaseURL,
	getVertexProjectId,
	getVertexLocation
} from './config-manager.js';
import {
	log,
	findProjectRoot,
	resolveEnvVariable,
	getCurrentTag
} from './utils.js';

// Import provider classes
import {
	AnthropicAIProvider,
	PerplexityAIProvider,
	GoogleAIProvider,
	OpenAIProvider,
	XAIProvider,
	OpenRouterAIProvider,
	OllamaAIProvider,
	BedrockAIProvider,
	AzureProvider,
	VertexAIProvider
} from '../../src/ai-providers/index.js';

// Create provider instances
const PROVIDERS = {
	anthropic: new AnthropicAIProvider(),
	perplexity: new PerplexityAIProvider(),
	google: new GoogleAIProvider(),
	openai: new OpenAIProvider(),
	xai: new XAIProvider(),
	openrouter: new OpenRouterAIProvider(),
	ollama: new OllamaAIProvider(),
	bedrock: new BedrockAIProvider(),
	azure: new AzureProvider(),
	vertex: new VertexAIProvider()
};

// Helper function to get cost for a specific model
function _getCostForModel(providerName, modelId) {
	if (!MODEL_MAP || !MODEL_MAP[providerName]) {
		log(
			'warn',
			`Provider "${providerName}" not found in MODEL_MAP. Cannot determine cost for model ${modelId}.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' }; // Default to zero cost
	}

	const modelData = MODEL_MAP[providerName].find((m) => m.id === modelId);

	if (!modelData || !modelData.cost_per_1m_tokens) {
		log(
			'debug',
			`Cost data not found for model "${modelId}" under provider "${providerName}". Assuming zero cost.`
		);
		return { inputCost: 0, outputCost: 0, currency: 'USD' }; // Default to zero cost
	}

	// Ensure currency is part of the returned object, defaulting if not present
	const currency = modelData.cost_per_1m_tokens.currency || 'USD';

	return {
		inputCost: modelData.cost_per_1m_tokens.input || 0,
		outputCost: modelData.cost_per_1m_tokens.output || 0,
		currency: currency
	};
}

// Helper function to get tag information for responses
function _getTagInfo(projectRoot) {
	try {
		if (!projectRoot) {
			return { currentTag: 'master', availableTags: ['master'] };
		}

		const currentTag = getCurrentTag(projectRoot);

		// Read available tags from tasks.json
		let availableTags = ['master']; // Default fallback
		try {
			const path = require('path');
			const fs = require('fs');
			const tasksPath = path.join(
				projectRoot,
				'.taskmaster',
				'tasks',
				'tasks.json'
			);

			if (fs.existsSync(tasksPath)) {
				const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
				if (tasksData && typeof tasksData === 'object') {
					// Check if it's tagged format (has tag-like keys with tasks arrays)
					const potentialTags = Object.keys(tasksData).filter(
						(key) =>
							tasksData[key] &&
							typeof tasksData[key] === 'object' &&
							Array.isArray(tasksData[key].tasks)
					);

					if (potentialTags.length > 0) {
						availableTags = potentialTags;
					}
				}
			}
		} catch (readError) {
			// Silently fall back to default if we can't read tasks file
			if (getDebugFlag()) {
				log(
					'debug',
					`Could not read tasks file for available tags: ${readError.message}`
				);
			}
		}

		return {
			currentTag: currentTag || 'master',
			availableTags: availableTags
		};
	} catch (error) {
		if (getDebugFlag()) {
			log('debug', `Error getting tag information: ${error.message}`);
		}
		return { currentTag: 'master', availableTags: ['master'] };
	}
}

// --- Configuration for Retries ---
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// Helper function to check if an error is retryable
function isRetryableError(error) {
	const errorMessage = error.message?.toLowerCase() || '';
	return (
		errorMessage.includes('rate limit') ||
		errorMessage.includes('overloaded') ||
		errorMessage.includes('service temporarily unavailable') ||
		errorMessage.includes('timeout') ||
		errorMessage.includes('network error') ||
		error.status === 429 ||
		error.status >= 500
	);
}

/**
 * Extracts a user-friendly error message from a potentially complex AI error object.
 * Prioritizes nested messages and falls back to the top-level message.
 * @param {Error | object | any} error - The error object.
 * @returns {string} A concise error message.
 */
function _extractErrorMessage(error) {
	try {
		// Attempt 1: Look for Vercel SDK specific nested structure (common)
		if (error?.data?.error?.message) {
			return error.data.error.message;
		}

		// Attempt 2: Look for nested error message directly in the error object
		if (error?.error?.message) {
			return error.error.message;
		}

		// Attempt 3: Look for nested error message in response body if it's JSON string
		if (typeof error?.responseBody === 'string') {
			try {
				const body = JSON.parse(error.responseBody);
				if (body?.error?.message) {
					return body.error.message;
				}
			} catch (parseError) {
				// Ignore if responseBody is not valid JSON
			}
		}

		// Attempt 4: Use the top-level message if it exists
		if (typeof error?.message === 'string' && error.message) {
			return error.message;
		}

		// Attempt 5: Handle simple string errors
		if (typeof error === 'string') {
			return error;
		}

		// Fallback
		return 'An unknown AI service error occurred.';
	} catch (e) {
		// Safety net
		return 'Failed to extract error message.';
	}
}

/**
 * Internal helper to resolve the API key for a given provider.
 * @param {string} providerName - The name of the provider (lowercase).
 * @param {object|null} session - Optional MCP session object.
 * @param {string|null} projectRoot - Optional project root path for .env fallback.
 * @returns {string|null} The API key or null if not found/needed.
 * @throws {Error} If a required API key is missing.
 */
function _resolveApiKey(providerName, session, projectRoot = null) {
	const keyMap = {
		openai: 'OPENAI_API_KEY',
		anthropic: 'ANTHROPIC_API_KEY',
		google: 'GOOGLE_API_KEY',
		perplexity: 'PERPLEXITY_API_KEY',
		mistral: 'MISTRAL_API_KEY',
		azure: 'AZURE_OPENAI_API_KEY',
		openrouter: 'OPENROUTER_API_KEY',
		xai: 'XAI_API_KEY',
		ollama: 'OLLAMA_API_KEY',
		bedrock: 'AWS_ACCESS_KEY_ID',
		vertex: 'GOOGLE_API_KEY'
	};

	const envVarName = keyMap[providerName];
	if (!envVarName) {
		throw new Error(
			`Unknown provider '${providerName}' for API key resolution.`
		);
	}

	const apiKey = resolveEnvVariable(envVarName, session, projectRoot);

	// Special handling for providers that can use alternative auth
	if (providerName === 'ollama' || providerName === 'bedrock') {
		return apiKey || null;
	}

	if (!apiKey) {
		throw new Error(
			`Required API key ${envVarName} for provider '${providerName}' is not set in environment, session, or .env file.`
		);
	}
	return apiKey;
}

/**
 * Internal helper to attempt a provider-specific AI API call with retries.
 *
 * @param {function} providerApiFn - The specific provider function to call (e.g., generateAnthropicText).
 * @param {object} callParams - Parameters object for the provider function.
 * @param {string} providerName - Name of the provider (for logging).
 * @param {string} modelId - Specific model ID (for logging).
 * @param {string} attemptRole - The role being attempted (for logging).
 * @returns {Promise<object>} The result from the successful API call.
 * @throws {Error} If the call fails after all retries.
 */
async function _attemptProviderCallWithRetries(
	provider,
	serviceType,
	callParams,
	providerName,
	modelId,
	attemptRole
) {
	let retries = 0;
	const fnName = serviceType;

	while (retries <= MAX_RETRIES) {
		try {
			if (getDebugFlag()) {
				log(
					'info',
					`Attempt ${retries + 1}/${MAX_RETRIES + 1} calling ${fnName} (Provider: ${providerName}, Model: ${modelId}, Role: ${attemptRole})`
				);
			}

			// Call the appropriate method on the provider instance
			const result = await provider[serviceType](callParams);

			if (getDebugFlag()) {
				log(
					'info',
					`${fnName} succeeded for role ${attemptRole} (Provider: ${providerName}) on attempt ${retries + 1}`
				);
			}
			return result;
		} catch (error) {
			log(
				'warn',
				`Attempt ${retries + 1} failed for role ${attemptRole} (${fnName} / ${providerName}): ${error.message}`
			);

			if (isRetryableError(error) && retries < MAX_RETRIES) {
				retries++;
				const delay = INITIAL_RETRY_DELAY_MS * 2 ** (retries - 1);
				log(
					'info',
					`Something went wrong on the provider side. Retrying in ${delay / 1000}s...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				log(
					'error',
					`Something went wrong on the provider side. Max retries reached for role ${attemptRole} (${fnName} / ${providerName}).`
				);
				throw error;
			}
		}
	}
	// Should not be reached due to throw in the else block
	throw new Error(
		`Exhausted all retries for role ${attemptRole} (${fnName} / ${providerName})`
	);
}

/**
 * Base logic for unified service functions.
 * @param {string} serviceType - Type of service ('generateText', 'streamText', 'generateObject').
 * @param {object} params - Original parameters passed to the service function.
 * @param {string} params.role - The initial client role.
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot] - Optional project root path.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} params.outputType - 'cli' or 'mcp'.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} [params.prompt] - The prompt for the AI.
 * @param {string} [params.schema] - The Zod schema for the expected object.
 * @param {string} [params.objectName] - Name for object/tool.
 * @returns {Promise<any>} Result from the underlying provider call.
 */
async function _unifiedServiceRunner(serviceType, params) {
	const {
		role: initialRole,
		session,
		projectRoot,
		systemPrompt,
		prompt,
		schema,
		objectName,
		commandName,
		outputType,
		...restApiParams
	} = params;
	if (getDebugFlag()) {
		log('info', `${serviceType}Service called`, {
			role: initialRole,
			commandName,
			outputType,
			projectRoot
		});
	}

	const effectiveProjectRoot = projectRoot || findProjectRoot();
	const userId = getUserId(effectiveProjectRoot);

	let sequence;
	if (initialRole === 'main') {
		sequence = ['main', 'fallback', 'research'];
	} else if (initialRole === 'research') {
		sequence = ['research', 'fallback', 'main'];
	} else if (initialRole === 'fallback') {
		sequence = ['fallback', 'main', 'research'];
	} else {
		log(
			'warn',
			`Unknown initial role: ${initialRole}. Defaulting to main -> fallback -> research sequence.`
		);
		sequence = ['main', 'fallback', 'research'];
	}

	let lastError = null;
	let lastCleanErrorMessage =
		'AI service call failed for all configured roles.';

	for (const currentRole of sequence) {
		let providerName;
		let modelId;
		let apiKey;
		let roleParams;
		let provider;
		let baseURL;
		let providerResponse;
		let telemetryData = null;

		try {
			log('info', `New AI service call with role: ${currentRole}`);

			if (currentRole === 'main') {
				providerName = getMainProvider(effectiveProjectRoot);
				modelId = getMainModelId(effectiveProjectRoot);
			} else if (currentRole === 'research') {
				providerName = getResearchProvider(effectiveProjectRoot);
				modelId = getResearchModelId(effectiveProjectRoot);
			} else if (currentRole === 'fallback') {
				providerName = getFallbackProvider(effectiveProjectRoot);
				modelId = getFallbackModelId(effectiveProjectRoot);
			} else {
				log(
					'error',
					`Unknown role encountered in _unifiedServiceRunner: ${currentRole}`
				);
				lastError =
					lastError || new Error(`Unknown AI role specified: ${currentRole}`);
				continue;
			}

			if (!providerName || !modelId) {
				log(
					'warn',
					`Skipping role '${currentRole}': Provider or Model ID not configured.`
				);
				lastError =
					lastError ||
					new Error(
						`Configuration missing for role '${currentRole}'. Provider: ${providerName}, Model: ${modelId}`
					);
				continue;
			}

			// Get provider instance
			provider = PROVIDERS[providerName?.toLowerCase()];
			if (!provider) {
				log(
					'warn',
					`Skipping role '${currentRole}': Provider '${providerName}' not supported.`
				);
				lastError =
					lastError ||
					new Error(`Unsupported provider configured: ${providerName}`);
				continue;
			}

			// Check API key if needed
			if (providerName?.toLowerCase() !== 'ollama') {
				if (!isApiKeySet(providerName, session, effectiveProjectRoot)) {
					log(
						'warn',
						`Skipping role '${currentRole}' (Provider: ${providerName}): API key not set or invalid.`
					);
					lastError =
						lastError ||
						new Error(
							`API key for provider '${providerName}' (role: ${currentRole}) is not set.`
						);
					continue; // Skip to the next role in the sequence
				}
			}

			// Get base URL if configured (optional for most providers)
			baseURL = getBaseUrlForRole(currentRole, effectiveProjectRoot);

			// For Azure, use the global Azure base URL if role-specific URL is not configured
			if (providerName?.toLowerCase() === 'azure' && !baseURL) {
				baseURL = getAzureBaseURL(effectiveProjectRoot);
				log('debug', `Using global Azure base URL: ${baseURL}`);
			} else if (providerName?.toLowerCase() === 'ollama' && !baseURL) {
				// For Ollama, use the global Ollama base URL if role-specific URL is not configured
				baseURL = getOllamaBaseURL(effectiveProjectRoot);
				log('debug', `Using global Ollama base URL: ${baseURL}`);
			} else if (providerName?.toLowerCase() === 'bedrock' && !baseURL) {
				// For Bedrock, use the global Bedrock base URL if role-specific URL is not configured
				baseURL = getBedrockBaseURL(effectiveProjectRoot);
				log('debug', `Using global Bedrock base URL: ${baseURL}`);
			}

			// Get AI parameters for the current role
			roleParams = getParametersForRole(currentRole, effectiveProjectRoot);
			apiKey = _resolveApiKey(
				providerName?.toLowerCase(),
				session,
				effectiveProjectRoot
			);

			// Prepare provider-specific configuration
			let providerSpecificParams = {};

			// Handle Vertex AI specific configuration
			if (providerName?.toLowerCase() === 'vertex') {
				// Get Vertex project ID and location
				const projectId =
					getVertexProjectId(effectiveProjectRoot) ||
					resolveEnvVariable(
						'VERTEX_PROJECT_ID',
						session,
						effectiveProjectRoot
					);

				const location =
					getVertexLocation(effectiveProjectRoot) ||
					resolveEnvVariable(
						'VERTEX_LOCATION',
						session,
						effectiveProjectRoot
					) ||
					'us-central1';

				// Get credentials path if available
				const credentialsPath = resolveEnvVariable(
					'GOOGLE_APPLICATION_CREDENTIALS',
					session,
					effectiveProjectRoot
				);

				// Add Vertex-specific parameters
				providerSpecificParams = {
					projectId,
					location,
					...(credentialsPath && { credentials: { credentialsFromEnv: true } })
				};

				log(
					'debug',
					`Using Vertex AI configuration: Project ID=${projectId}, Location=${location}`
				);
			}

			const messages = [];
			if (systemPrompt) {
				messages.push({ role: 'system', content: systemPrompt });
			}

			// IN THE FUTURE WHEN DOING CONTEXT IMPROVEMENTS
			// {
			//     type: 'text',
			//     text: 'Large cached context here like a tasks json',
			//     providerOptions: {
			//       anthropic: { cacheControl: { type: 'ephemeral' } }
			//     }
			//   }

			// Example
			// if (params.context) { // context is a json string of a tasks object or some other stu
			//     messages.push({
			//         type: 'text',
			//         text: params.context,
			//         providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
			//     });
			// }

			if (prompt) {
				messages.push({ role: 'user', content: prompt });
			} else {
				throw new Error('User prompt content is missing.');
			}

			const callParams = {
				apiKey,
				modelId,
				maxTokens: roleParams.maxTokens,
				temperature: roleParams.temperature,
				messages,
				...(baseURL && { baseURL }),
				...(serviceType === 'generateObject' && { schema, objectName }),
				...providerSpecificParams,
				...restApiParams
			};

			providerResponse = await _attemptProviderCallWithRetries(
				provider,
				serviceType,
				callParams,
				providerName,
				modelId,
				currentRole
			);

			if (userId && providerResponse && providerResponse.usage) {
				try {
					telemetryData = await logAiUsage({
						userId,
						commandName,
						providerName,
						modelId,
						inputTokens: providerResponse.usage.inputTokens,
						outputTokens: providerResponse.usage.outputTokens,
						outputType
					});
				} catch (telemetryError) {
					// logAiUsage already logs its own errors and returns null on failure
					// No need to log again here, telemetryData will remain null
				}
			} else if (userId && providerResponse && !providerResponse.usage) {
				log(
					'warn',
					`Cannot log telemetry for ${commandName} (${providerName}/${modelId}): AI result missing 'usage' data. (May be expected for streams)`
				);
			}

			let finalMainResult;
			if (serviceType === 'generateText') {
				finalMainResult = providerResponse.text;
			} else if (serviceType === 'generateObject') {
				finalMainResult = providerResponse.object;
			} else if (serviceType === 'streamText') {
				finalMainResult = providerResponse;
			} else {
				log(
					'error',
					`Unknown serviceType in _unifiedServiceRunner: ${serviceType}`
				);
				finalMainResult = providerResponse;
			}

			// Get tag information for the response
			const tagInfo = _getTagInfo(effectiveProjectRoot);

			return {
				mainResult: finalMainResult,
				telemetryData: telemetryData,
				tagInfo: tagInfo
			};
		} catch (error) {
			const cleanMessage = _extractErrorMessage(error);
			log(
				'error',
				`Service call failed for role ${currentRole} (Provider: ${providerName || 'unknown'}, Model: ${modelId || 'unknown'}): ${cleanMessage}`
			);
			lastError = error;
			lastCleanErrorMessage = cleanMessage;

			if (serviceType === 'generateObject') {
				const lowerCaseMessage = cleanMessage.toLowerCase();
				if (
					lowerCaseMessage.includes(
						'no endpoints found that support tool use'
					) ||
					lowerCaseMessage.includes('does not support tool_use') ||
					lowerCaseMessage.includes('tool use is not supported') ||
					lowerCaseMessage.includes('tools are not supported') ||
					lowerCaseMessage.includes('function calling is not supported') ||
					lowerCaseMessage.includes('tool use is not supported')
				) {
					const specificErrorMsg = `Model '${modelId || 'unknown'}' via provider '${providerName || 'unknown'}' does not support the 'tool use' required by generateObjectService. Please configure a model that supports tool/function calling for the '${currentRole}' role, or use generateTextService if structured output is not strictly required.`;
					log('error', `[Tool Support Error] ${specificErrorMsg}`);
					throw new Error(specificErrorMsg);
				}
			}
		}
	}

	log('error', `All roles in the sequence [${sequence.join(', ')}] failed.`);
	throw new Error(lastCleanErrorMessage);
}

/**
 * Unified service function for generating text.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing generated text and usage data.
 */
async function generateTextService(params) {
	// Ensure default outputType if not provided
	const defaults = { outputType: 'cli' };
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	return _unifiedServiceRunner('generateText', combinedParams);
}

/**
 * Unified service function for streaming text.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing the stream and usage data.
 */
async function streamTextService(params) {
	const defaults = { outputType: 'cli' };
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	// NOTE: Telemetry for streaming might be tricky as usage data often comes at the end.
	// The current implementation logs *after* the stream is returned.
	// We might need to adjust how usage is captured/logged for streams.
	return _unifiedServiceRunner('streamText', combinedParams);
}

/**
 * Unified service function for generating structured objects.
 * Handles client retrieval, retries, and fallback sequence.
 *
 * @param {object} params - Parameters for the service call.
 * @param {string} params.role - The initial client role ('main', 'research', 'fallback').
 * @param {object} [params.session=null] - Optional MCP session object.
 * @param {string} [params.projectRoot=null] - Optional project root path for .env fallback.
 * @param {import('zod').ZodSchema} params.schema - The Zod schema for the expected object.
 * @param {string} params.prompt - The prompt for the AI.
 * @param {string} [params.systemPrompt] - Optional system prompt.
 * @param {string} [params.objectName='generated_object'] - Name for object/tool.
 * @param {number} [params.maxRetries=3] - Max retries for object generation.
 * @param {string} params.commandName - Name of the command invoking the service.
 * @param {string} [params.outputType='cli'] - 'cli' or 'mcp'.
 * @returns {Promise<object>} Result object containing the generated object and usage data.
 */
async function generateObjectService(params) {
	const defaults = {
		objectName: 'generated_object',
		maxRetries: 3,
		outputType: 'cli'
	};
	const combinedParams = { ...defaults, ...params };
	// TODO: Validate commandName exists?
	return _unifiedServiceRunner('generateObject', combinedParams);
}

// --- Telemetry Function ---
/**
 * Logs AI usage telemetry data.
 * For now, it just logs to the console. Sending will be implemented later.
 * @param {object} params - Telemetry parameters.
 * @param {string} params.userId - Unique user identifier.
 * @param {string} params.commandName - The command that triggered the AI call.
 * @param {string} params.providerName - The AI provider used (e.g., 'openai').
 * @param {string} params.modelId - The specific AI model ID used.
 * @param {number} params.inputTokens - Number of input tokens.
 * @param {number} params.outputTokens - Number of output tokens.
 */
async function logAiUsage({
	userId,
	commandName,
	providerName,
	modelId,
	inputTokens,
	outputTokens,
	outputType
}) {
	try {
		const isMCP = outputType === 'mcp';
		const timestamp = new Date().toISOString();
		const totalTokens = (inputTokens || 0) + (outputTokens || 0);

		// Destructure currency along with costs
		const { inputCost, outputCost, currency } = _getCostForModel(
			providerName,
			modelId
		);

		const totalCost =
			((inputTokens || 0) / 1_000_000) * inputCost +
			((outputTokens || 0) / 1_000_000) * outputCost;

		const telemetryData = {
			timestamp,
			userId,
			commandName,
			modelUsed: modelId, // Consistent field name from requirements
			providerName, // Keep provider name for context
			inputTokens: inputTokens || 0,
			outputTokens: outputTokens || 0,
			totalTokens,
			totalCost: parseFloat(totalCost.toFixed(6)),
			currency // Add currency to the telemetry data
		};

		if (getDebugFlag()) {
			log('info', 'AI Usage Telemetry:', telemetryData);
		}

		// TODO (Subtask 77.2): Send telemetryData securely to the external endpoint.

		return telemetryData;
	} catch (error) {
		log('error', `Failed to log AI usage telemetry: ${error.message}`, {
			error
		});
		// Don't re-throw; telemetry failure shouldn't block core functionality.
		return null;
	}
}

export {
	generateTextService,
	streamTextService,
	generateObjectService,
	logAiUsage
};
