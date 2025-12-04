/**
 * Shared fetch wrapper for Snowflake Cortex providers
 * 
 * This module provides a custom fetch wrapper that:
 * 1. Handles Snowflake authentication (JWT/PAT)
 * 2. Transforms JSON schemas for OpenAI models (additionalProperties: false)
 * 
 * Used by both the @ai-sdk/anthropic and @ai-sdk/openai-compatible wrappers
 * to add Snowflake-specific authentication and schema transformations.
 */

import { authenticate } from '../auth/index.js';
import { removeUnsupportedFeatures } from '../schema/index.js';
import type { SnowflakeProviderSettings, AuthResult } from '../types.js';

/**
 * Check if a model ID is an OpenAI model
 * OpenAI models require additionalProperties: false in all schema objects
 */
function isOpenAIModel(modelId: string): boolean {
	const normalizedId = modelId.toLowerCase().replace(/^cortex\//, '');
	return normalizedId.startsWith('openai') || normalizedId.startsWith('gpt-');
}

/**
 * Transform the request body for OpenAI models
 * Applies Snowflake-specific schema requirements:
 * - additionalProperties: false on all objects
 * - required array must contain all properties
 */
function transformRequestBody(body: unknown, modelId: string): unknown {
	if (!body || typeof body !== 'object' || !isOpenAIModel(modelId)) {
		return body;
	}

	const bodyObj = body as Record<string, unknown>;
	
	// Transform response_format schema for structured outputs
	if (bodyObj.response_format && typeof bodyObj.response_format === 'object') {
		const responseFormat = bodyObj.response_format as Record<string, unknown>;
		
		// Handle OpenAI API format (json_schema wrapper)
		if (responseFormat.type === 'json_schema' && responseFormat.json_schema) {
			const jsonSchema = responseFormat.json_schema as Record<string, unknown>;
			if (jsonSchema.schema) {
				jsonSchema.schema = removeUnsupportedFeatures(jsonSchema.schema as Record<string, unknown>);
			}
		}
		
		// Handle native Cortex format (type: json with schema directly)
		if (responseFormat.type === 'json' && responseFormat.schema) {
			responseFormat.schema = removeUnsupportedFeatures(responseFormat.schema as Record<string, unknown>);
		}
	}

	// Transform tools schemas
	if (Array.isArray(bodyObj.tools)) {
		bodyObj.tools = bodyObj.tools.map((tool: unknown) => {
			if (tool && typeof tool === 'object') {
				const toolObj = tool as Record<string, unknown>;
				if (toolObj.function && typeof toolObj.function === 'object') {
					const funcObj = toolObj.function as Record<string, unknown>;
					if (funcObj.parameters) {
						funcObj.parameters = removeUnsupportedFeatures(funcObj.parameters as Record<string, unknown>);
					}
				}
			}
			return tool;
		});
	}

	return bodyObj;
}

/**
 * Create a Snowflake-authenticated fetch wrapper
 * 
 * This wrapper adds Snowflake authentication headers and transforms
 * request bodies for compatibility with Snowflake Cortex APIs.
 * 
 * @param settings - Provider settings with authentication info
 * @param modelId - Model ID to determine schema transformation needs
 * @returns A fetch function that adds Snowflake auth
 */
export function createSnowflakeFetch(
	settings: SnowflakeProviderSettings,
	modelId?: string
): typeof fetch {
	// Cache the auth result to avoid repeated authentication
	let authPromise: Promise<AuthResult> | null = null;
	
	return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
		// Authenticate if not already
		if (!authPromise) {
			authPromise = authenticate(settings);
		}
		
		const auth = await authPromise;
		
		// Create new headers with auth
		const headers = new Headers(init?.headers);
		headers.set('Authorization', `Bearer ${auth.accessToken}`);
		
		// Don't override Content-Type if already set
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		
		// Transform request body if needed
		let body = init?.body;
		if (body && modelId && typeof body === 'string') {
			try {
				const parsedBody = JSON.parse(body);
				const transformedBody = transformRequestBody(parsedBody, modelId);
				body = JSON.stringify(transformedBody);
			} catch {
				// If body isn't valid JSON, pass it through unchanged
			}
		}
		
		return fetch(url, {
			...init,
			headers,
			body
		});
	};
}

/**
 * Create a Snowflake-authenticated fetch wrapper for Anthropic endpoint
 * 
 * The Anthropic endpoint doesn't need schema transformation as it uses
 * Anthropic's native tool_use pattern for structured outputs.
 * 
 * @param settings - Provider settings with authentication info
 * @returns A fetch function that adds Snowflake auth
 */
export function createSnowflakeAnthropicFetch(
	settings: SnowflakeProviderSettings
): typeof fetch {
	let authPromise: Promise<AuthResult> | null = null;
	
	return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
		if (!authPromise) {
			authPromise = authenticate(settings);
		}
		
		const auth = await authPromise;
		
		const headers = new Headers(init?.headers);
		headers.set('Authorization', `Bearer ${auth.accessToken}`);
		
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		
		return fetch(url, {
			...init,
			headers
		});
	};
}

/**
 * Get the base URL for a Snowflake account
 * 
 * @param settings - Provider settings
 * @returns Base URL for the Snowflake account
 */
export async function getSnowflakeBaseURL(settings: SnowflakeProviderSettings): Promise<string> {
	const auth = await authenticate(settings);
	return auth.baseURL;
}

// Re-export for convenience
export { authenticate } from '../auth/index.js';

