import { beforeAll, afterAll, it, expect } from '@jest/globals';
import { clearAuthCache } from '../../../src/auth/index.js';
import {
	OTHER_MODELS,
	skipIfNoCredentials,
	testModelGeneration
} from './common.js';

skipIfNoCredentials('REST API - Other Models Integration Tests', () => {
	beforeAll(async () => {
		clearAuthCache();
		console.log(`\n=== Other REST API Tests ===`);
		console.log(`Models: ${OTHER_MODELS.length}\n`);
	}, 15000);

	afterAll(() => {
		clearAuthCache();
	});

	it.concurrent.each(OTHER_MODELS)(
		'%s generates text via REST',
		async (modelId) => {
			const result = await testModelGeneration(modelId, 'rest', 'other');
			expect(result.success).toBe(true);
			expect(result.responseText).toBeDefined();
			expect(result.responseText!.length).toBeGreaterThan(0);
		},
		120000
	);
});

