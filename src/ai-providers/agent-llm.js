import { BaseAIProvider } from './base-provider.js';
import { v4 as uuidv4 } from 'uuid';

class AgentLLMProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'AgentLLM';
	}

	validateAuth(params) {
		// No validation needed
	}

	getClient(params) {
		// Return this, as we are not calling a traditional LLM client directly
		return this;
	}

	isRequiredApiKey() {
		// AgentLLM does not use traditional API keys
		return false;
	}

	getRequiredApiKeyName() {
		// AgentLLM does not use traditional API keys
		return null;
	}

	async generateText(params) {
		// Basic validation before delegation
		if (!params.messages || !Array.isArray(params.messages)) {
			throw new Error('Messages array is required for delegation');
		}
		const { modelId, messages, maxTokens, temperature, ...restApiParams } =
			params;
		const interactionId = uuidv4();
		const packagedParams = {
			apiKey: null,
			modelId,
			messages,
			maxTokens,
			temperature,
			baseURL: params.baseURL, // Though likely not used by agent-llm directly
			...restApiParams
		};
		return {
			type: 'agent_llm_delegation',
			interactionId,
			details: packagedParams
		};
	}

	async streamText(params) {
		const { modelId, messages, maxTokens, temperature, ...restApiParams } =
			params;
		const interactionId = uuidv4();
		const packagedParams = {
			apiKey: null,
			modelId,
			messages,
			maxTokens,
			temperature,
			baseURL: params.baseURL, // Though likely not used by agent-llm directly
			...restApiParams
		};
		return {
			type: 'agent_llm_delegation',
			interactionId,
			details: packagedParams
		};
	}

	async generateObject(params) {
		const {
			modelId,
			messages,
			maxTokens,
			temperature,
			schema,
			objectName,
			...restApiParams
		} = params;
		const interactionId = uuidv4();
		const packagedParams = {
			apiKey: null,
			modelId,
			messages,
			maxTokens,
			temperature,
			schema,
			objectName,
			baseURL: params.baseURL, // Though likely not used by agent-llm directly
			...restApiParams
		};
		return {
			type: 'agent_llm_delegation',
			interactionId,
			details: packagedParams
		};
	}
}

export { AgentLLMProvider };
