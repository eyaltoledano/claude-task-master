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
	getParametersForRole
} from './config-manager.js';
import { log, resolveEnvVariable, findProjectRoot } from './utils.js';

import * as anthropic from '../../src/ai-providers/anthropic.js';
import * as perplexity from '../../src/ai-providers/perplexity.js';
import * as google from '../../src/ai-providers/google.js';
import * as openai from '../../src/ai-providers/openai.js';
import * as xai from '../../src/ai-providers/xai.js';
import * as openrouter from '../../src/ai-providers/openrouter.js';
// TODO: Import other provider modules when implemented (ollama, etc.)

// --- Provider Function Map ---
// Maps provider names (lowercase) to their respective service functions
const PROVIDER_FUNCTIONS = {
	anthropic: {
		generateText: anthropic.generateAnthropicText,
		streamText: anthropic.streamAnthropicText,
		generateObject: anthropic.generateAnthropicObject
	},
	perplexity: {
		generateText: perplexity.generatePerplexityText,
		streamText: perplexity.streamPerplexityText,
		generateObject: perplexity.generatePerplexityObject
	},
	google: {
		// Add Google entry
		generateText: google.generateGoogleText,
		streamText: google.streamGoogleText,
		generateObject: google.generateGoogleObject
	},
	openai: {
		// ADD: OpenAI entry
		generateText: openai.generateOpenAIText,
		streamText: openai.streamOpenAIText,
		generateObject: openai.generateOpenAIObject
	},
	xai: {
		// ADD: xAI entry
		generateText: xai.generateXaiText,
		streamText: xai.streamXaiText,
		generateObject: xai.generateXaiObject // Note: Object generation might be unsupported
	},
	openrouter: {
		// ADD: OpenRouter entry
		generateText: openrouter.generateOpenRouterText,
		streamText: openrouter.streamOpenRouterText,
		generateObject: openrouter.generateOpenRouterObject
	}
	// TODO: Add entries for ollama, etc. when implemented
};

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
		xai: 'XAI_API_KEY'
	};

	// Double check this -- I have had to use an api key for ollama in the past
	// if (providerName === 'ollama') {
	// 	return null; // Ollama typically doesn't require an API key for basic setup
	// }

	const envVarName = keyMap[providerName];
	if (!envVarName) {
		throw new Error(
			`Unknown provider '${providerName}' for API key resolution.`
		);
	}

	const apiKey = resolveEnvVariable(envVarName, session, projectRoot);
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
	providerApiFn,
	callParams,
	providerName,
	modelId,
	attemptRole
) {
	let retries = 0;
	const fnName = providerApiFn.name;

	while (retries <= MAX_RETRIES) {
		try {
			log(
				'info',
				`Attempt ${retries + 1}/${MAX_RETRIES + 1} calling ${fnName} (Provider: ${providerName}, Model: ${modelId}, Role: ${attemptRole})`
			);

			// Call the specific provider function directly
			const result = await providerApiFn(callParams);

			log(
				'info',
				`${fnName} succeeded for role ${attemptRole} (Provider: ${providerName}) on attempt ${retries + 1}`
			);
			return result;
		} catch (error) {
			log(
				'warn',
				`Attempt ${retries + 1} failed for role ${attemptRole} (${fnName} / ${providerName}): ${error.message}`
			);

			if (isRetryableError(error) && retries < MAX_RETRIES) {
				retries++;
				const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries - 1);
				log(
					'info',
					`Retryable error detected. Retrying in ${delay / 1000}s...`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				log(
					'error',
					`Non-retryable error or max retries reached for role ${attemptRole} (${fnName} / ${providerName}).`
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
 * @param {string} [params.projectRoot] - Optional project root path.
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
		...restApiParams
	} = params;
	log('info', `${serviceType}Service called`, {
		role: initialRole,
		projectRoot
	});

	// Determine the effective project root (passed in or detected)
	const effectiveProjectRoot = projectRoot || findProjectRoot();

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
		let providerName, modelId, apiKey, roleParams, providerFnSet, providerApiFn;

		try {
			log('info', `New AI service call with role: ${currentRole}`);

			// 1. Get Config: Provider, Model, Parameters for the current role
			// Pass effectiveProjectRoot to config getters
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

			// Pass effectiveProjectRoot to getParametersForRole
			roleParams = getParametersForRole(currentRole, effectiveProjectRoot);

			// 2. Get Provider Function Set
			providerFnSet = PROVIDER_FUNCTIONS[providerName?.toLowerCase()];
			if (!providerFnSet) {
				log(
					'warn',
					`Skipping role '${currentRole}': Provider '${providerName}' not supported or map entry missing.`
				);
				lastError =
					lastError ||
					new Error(`Unsupported provider configured: ${providerName}`);
				continue;
			}

			// Use the original service type to get the function
			providerApiFn = providerFnSet[serviceType];
			if (typeof providerApiFn !== 'function') {
				log(
					'warn',
					`Skipping role '${currentRole}': Service type '${serviceType}' not implemented for provider '${providerName}'.`
				);
				lastError =
					lastError ||
					new Error(
						`Service '${serviceType}' not implemented for provider ${providerName}`
					);
				continue;
			}

			// 3. Resolve API Key (will throw if required and missing)
			// Pass effectiveProjectRoot to _resolveApiKey
			apiKey = _resolveApiKey(
				providerName?.toLowerCase(),
				session,
				effectiveProjectRoot
			);

			// 4. Construct Messages Array
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
				// Ensure prompt exists before adding
				messages.push({ role: 'user', content: prompt });
			} else {
				// Throw an error if the prompt is missing, as it's essential
				throw new Error('User prompt content is missing.');
			}

			// 5. Prepare call parameters (using messages array)
			const callParams = {
				apiKey,
				modelId,
				maxTokens: roleParams.maxTokens,
				temperature: roleParams.temperature,
				messages,
				...(serviceType === 'generateObject' && { schema, objectName }),
				...restApiParams
			};

			// 6. Attempt the call with retries
			const result = await _attemptProviderCallWithRetries(
				providerApiFn,
				callParams,
				providerName,
				modelId,
				currentRole
			);

			log('info', `${serviceType}Service succeeded using role: ${currentRole}`);

			return result;
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
					lowerCaseMessage.includes('function calling is not supported')
				) {
					const specificErrorMsg = `Model '${modelId || 'unknown'}' via provider '${providerName || 'unknown'}' does not support the 'tool use' required by generateObjectService. Please configure a model that supports tool/function calling for the '${currentRole}' role, or use generateTextService if structured output is not strictly required.`;
					log('error', `[Tool Support Error] ${specificErrorMsg}`);
					throw new Error(specificErrorMsg);
				}
			}
		}
	}

	// If loop completes, all roles failed
	log('error', `All roles in the sequence [${sequence.join(', ')}] failed.`);
	// Throw a new error with the cleaner message from the last failure
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
 * // Other specific generateText params can be included here.
 * @returns {Promise<string>} The generated text content.
 */
async function generateTextService(params) {
	return _unifiedServiceRunner('generateText', params);
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
 * // Other specific streamText params can be included here.
 * @returns {Promise<ReadableStream<string>>} A readable stream of text deltas.
 */
async function streamTextService(params) {
	return _unifiedServiceRunner('streamText', params);
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
 * @returns {Promise<object>} The generated object matching the schema.
 */
async function generateObjectService(params) {
	const defaults = {
		objectName: 'generated_object',
		maxRetries: 3
	};
	const combinedParams = { ...defaults, ...params };
	return _unifiedServiceRunner('generateObject', combinedParams);
}

export { generateTextService, streamTextService, generateObjectService };
