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

describeWithCredentials('CLI Mode Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(`\n=== CLI Mode Tests ===`);
		console.log(`CLI: ${cliAvailable ? '✅ Available' : '❌ Not available'}\n`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	// Claude Models
	it.concurrent.each(CLAUDE_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			// CLI availability checked at module load
			if (!cliAvailable) {
				console.log(`Skipping ${modelId}: Cortex CLI not available`);
				return;
			}
			const result = await testModelGeneration(modelId, 'cli', 'claude');
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);

	// OpenAI Models
	it.concurrent.each(OPENAI_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			// CLI availability checked at module load
			if (!cliAvailable) {
				console.log(`Skipping ${modelId}: Cortex CLI not available`);
				return;
			}
			// Enable debug for comparison with REST
			const result = await testModelGeneration(modelId, 'cli', 'openai', true);
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);

	// Other Models
	it.concurrent.each(OTHER_MODELS)(
		'%s generates text via CLI',
		async (modelId) => {
			// CLI availability checked at module load
			if (!cliAvailable) {
				console.log(`Skipping ${modelId}: Cortex CLI not available`);
				return;
			}
			const result = await testModelGeneration(modelId, 'cli', 'other');
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
		},
		180000
	);
});
