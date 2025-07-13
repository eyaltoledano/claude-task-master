import { BaseAIProvider } from './base-provider.js';
import { v4 as uuidv4 } from 'uuid';

class AgentLLMProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'AgentLLM';
	}

	validateAuth(params) {
		// AgentLLM does not use traditional API keys
		return true;
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

	generateText(params) {
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

	streamText(params) {
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

	generateObject(params) {
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
