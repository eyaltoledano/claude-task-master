import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSnowflake } from '../../../src/index.js';
import { clearAuthCache } from '../../../src/auth/index.js';
import type { SnowflakeProviderSettings } from '../../../src/types.js';

// Import model lists from the SINGLE SOURCE OF TRUTH
import {
	CLAUDE_PREFIXED_MODEL_IDS,
	OPENAI_PREFIXED_MODEL_IDS,
	LLAMA_PREFIXED_MODEL_IDS,
	MISTRAL_PREFIXED_MODEL_IDS,
	OTHER_PREFIXED_MODEL_IDS,
} from '../../../src/utils/models.js';

// Load environment variables
config({ path: resolve(process.cwd(), '../../.env') });

// Re-export centralized test utilities
export { 
	hasCredentials, 
	skipIfNoCredentials,
	checkCliAvailability,
	logTestEnvironment
} from '../../test-utils.js';

// Model groups - derived from single source of truth
export const CLAUDE_MODELS = CLAUDE_PREFIXED_MODEL_IDS;
export const OPENAI_MODELS = OPENAI_PREFIXED_MODEL_IDS;

// Combine Llama, Mistral, and Other into one "other" category for testing
export const OTHER_MODELS = [
	...LLAMA_PREFIXED_MODEL_IDS,
	...MISTRAL_PREFIXED_MODEL_IDS,
	...OTHER_PREFIXED_MODEL_IDS,
];

// Model test result tracking
export interface ModelTestResult {
	modelId: string;
	mode: 'rest' | 'cli';
	category: 'claude' | 'openai' | 'other';
	success: boolean;
	error?: string;
	responseText?: string;
	durationMs: number;
	requestDetails?: any;
}

export const testResults: ModelTestResult[] = [];

// Simple schema for structured output tests
// This schema follows OpenAI requirements:
// - additionalProperties: false on all object nodes
// - required array with all property names
const TestResponseSchema = z.object({
	response: z.string().describe('The response text'),
	status: z.enum(['ok', 'error']).describe('Status of the response'),
});

// Helper to run a model test with detailed debugging
export async function testModelGeneration(
	modelId: string,
	mode: 'rest' | 'cli',
	category: 'claude' | 'openai' | 'other',
	enableDebug: boolean = false
): Promise<ModelTestResult> {
	const startTime = Date.now();
	const result: ModelTestResult = {
		modelId,
		mode,
		category,
		success: false,
		durationMs: 0
	};

	try {
		const settings: SnowflakeProviderSettings = {
			executionMode: mode,
		};
		
		const provider = createSnowflake(settings);
		const model = provider(modelId);

		if (enableDebug) {
			console.log(`\n[DEBUG] Testing ${modelId} via ${mode.toUpperCase()}`);
			console.log(`[DEBUG] Model ID normalized: ${modelId.replace('cortex/', '')}`);
		}

		const response = await generateText({
			model,
			prompt: 'Say "ok" and nothing else.',
			maxOutputTokens: 20,
		});

		result.success = true;
		result.responseText = response.text;
		
		if (enableDebug) {
			console.log(`[DEBUG] Success! Response: "${response.text}"`);
			console.log(`[DEBUG] Usage: ${JSON.stringify(response.usage)}`);
		}
	} catch (error) {
		result.success = false;
		result.error = error instanceof Error ? error.message : String(error);
		
		if (enableDebug) {
			console.log(`[DEBUG] FAILED: ${result.error}`);
			// Log full error for debugging
			if (error instanceof Error && error.cause) {
				console.log(`[DEBUG] Cause: ${JSON.stringify(error.cause, null, 2)}`);
			}
		}
	} finally {
		result.durationMs = Date.now() - startTime;
		testResults.push(result);
	}

	return result;
}

// Helper to run a structured output test - required for OpenAI models
export async function testModelStructuredOutput(
	modelId: string,
	mode: 'rest' | 'cli',
	category: 'claude' | 'openai' | 'other',
	enableDebug: boolean = false
): Promise<ModelTestResult> {
	const startTime = Date.now();
	const result: ModelTestResult = {
		modelId,
		mode,
		category,
		success: false,
		durationMs: 0
	};

	try {
		const settings: SnowflakeProviderSettings = {
			executionMode: mode,
		};
		
		const provider = createSnowflake(settings);
		const model = provider(modelId);

		if (enableDebug) {
			console.log(`\n[DEBUG] Testing ${modelId} via ${mode.toUpperCase()} with STRUCTURED OUTPUT`);
			console.log(`[DEBUG] Model ID normalized: ${modelId.replace('cortex/', '')}`);
		}

		// Use generateObject with a schema - this is what OpenAI models need
		const response: any = await generateObject({
			model,
			schema: TestResponseSchema,
			prompt: 'Respond with status "ok".',
		});

		result.success = true;
		result.responseText = JSON.stringify(response.object);
		
		if (enableDebug) {
			console.log(`[DEBUG] Success! Response: ${JSON.stringify(response.object)}`);
			console.log(`[DEBUG] Usage: ${JSON.stringify(response.usage)}`);
		}
	} catch (error) {
		result.success = false;
		result.error = error instanceof Error ? error.message : String(error);
		
		if (enableDebug) {
			console.log(`[DEBUG] FAILED: ${result.error}`);
			// Log full error for debugging
			if (error instanceof Error && error.cause) {
				console.log(`[DEBUG] Cause: ${JSON.stringify(error.cause, null, 2)}`);
			}
		}
	} finally {
		result.durationMs = Date.now() - startTime;
		testResults.push(result);
	}

	return result;
}
