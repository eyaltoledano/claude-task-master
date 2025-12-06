import { beforeAll, afterAll, it, expect } from '@jest/globals';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	CLAUDE_MODELS,
	OPENAI_MODELS,
	OTHER_MODELS,
	hasCliAvailable,
	describeWithCredentials,
	testModelGeneration
} from './common.js';

// CLI availability is checked synchronously at module load by test-environment.ts
const cliAvailable = hasCliAvailable();

// Use skip.each when CLI is unavailable so tests are properly reported as skipped
const testRunner = cliAvailable ? it.concurrent.each : it.skip.each;

describeWithCredentials('CLI Mode Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	// Claude Models
	testRunner(CLAUDE_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			const result = await testModelGeneration(modelId, 'cli', 'claude');
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);

	// OpenAI Models
	testRunner(OPENAI_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			// Enable debug for comparison with REST
			const result = await testModelGeneration(modelId, 'cli', 'openai', true);
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);

	// Other Models
	testRunner(OTHER_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			const result = await testModelGeneration(modelId, 'cli', 'other');
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);
});
