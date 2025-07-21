import { BaseAIProvider } from './base-provider.js';
import { v4 as uuidv4 } from 'uuid';

class AgentLLMProvider extends BaseAIProvider {
	constructor() {
		super();
		this.name = 'AgentLLM';
	}

	validateAuth(params) {
		// AgentLLM delegates calls to MCP clients and doesn't require API key validation
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
			//modelId,
			messages,
			//maxTokens,
			//temperature,
			...restApiParams
		};
		return {
			type: 'agent_llm_delegation',
			interactionId,
			details: packagedParams
		};
	}

	async streamText(params) {
		// Basic validation before delegation
		if (!params.messages || !Array.isArray(params.messages)) {
			throw new Error('Messages array is required for delegation');
		}
		const { modelId, messages, maxTokens, temperature, ...restApiParams } =
			params;
		const interactionId = uuidv4();
		const packagedParams = {
			//modelId,
			messages,
			//maxTokens,
			//temperature,
			...restApiParams
		};
		return {
			type: 'agent_llm_delegation',
			interactionId,
			details: packagedParams
		};
	}

	async generateObject(params) {
		// Basic validation before delegation
		if (!params.messages || !Array.isArray(params.messages)) {
			throw new Error('Messages array is required for delegation');
		}
		if (!params.schema) {
			throw new Error('Schema is required for object generation delegation');
		}
		if (!params.objectName) {
			throw new Error('Object name is required for object generation delegation');
		}
		const {
			//modelId,
			messages,
			//maxTokens,
			//temperature,
			schema,
			objectName,
			...restApiParams
		} = params;
		const interactionId = uuidv4();
		const packagedParams = {
			//modelId,
			messages,
			//maxTokens,
			//temperature,
			schema,
			objectName,
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
