/**
 * Unit tests for CLI feature detector
 * Tests the structure and return types of the feature detection API
 */

import { describe, it, expect } from '@jest/globals';
import { detectAvailableFeatures, type CortexCodeFeatures } from '../../../src/cli/feature-detector.js';

describe('Feature Detector', () => {
	describe('detectAvailableFeatures', () => {
		it.concurrent('should return a CortexCodeFeatures object', async () => {
			const features = detectAvailableFeatures();
			
			expect(features).toBeDefined();
			expect(features).toHaveProperty('planningMode');
			expect(features).toHaveProperty('mcpControl');
			expect(features).toHaveProperty('skillsSupport');
			expect(features).toHaveProperty('cliVersion');
		});

		it.concurrent('should have boolean types for feature flags', async () => {
			const features = detectAvailableFeatures();
			
			expect(typeof features.planningMode).toBe('boolean');
			expect(typeof features.mcpControl).toBe('boolean');
			expect(typeof features.skillsSupport).toBe('boolean');
		});

		it.concurrent('should have string or null for cliVersion', async () => {
			const features = detectAvailableFeatures();
			
			expect(
				features.cliVersion === null || typeof features.cliVersion === 'string'
			).toBe(true);
		});

		it.concurrent('should return consistent results (caching)', async () => {
			// Features should be cached, so multiple calls should return the same object
			const features1 = detectAvailableFeatures();
			const features2 = detectAvailableFeatures();
			
			// Should be the exact same object reference due to caching
			expect(features1).toBe(features2);
		});

		it.concurrent('should not throw errors', async () => {
			// Feature detection should gracefully handle errors
			expect(() => detectAvailableFeatures()).not.toThrow();
		});

		it.concurrent('should detect if cortex CLI is available', async () => {
			const features = detectAvailableFeatures();
			
			// Log detected features for informational purposes
			console.log(`Cortex CLI features detected:`);
			console.log(`  Version: ${features.cliVersion || 'not detected'}`);
			console.log(`  Planning mode: ${features.planningMode}`);
			console.log(`  MCP control: ${features.mcpControl}`);
			console.log(`  Skills support: ${features.skillsSupport}`);
			
			// Features can be detected even if version detection fails
			// This is informational - test always passes
			expect(features).toBeDefined();
		});
	});

	describe('CortexCodeFeatures interface', () => {
		it.concurrent('should allow type assertion from detectAvailableFeatures', async () => {
			const features: CortexCodeFeatures = detectAvailableFeatures();
			
			// TypeScript compilation verifies the type
			expect(features).toBeDefined();
		});

		it.concurrent('should have expected properties', async () => {
			const features = detectAvailableFeatures();
			
			// All properties should exist
			const keys = Object.keys(features);
			expect(keys).toContain('planningMode');
			expect(keys).toContain('mcpControl');
			expect(keys).toContain('skillsSupport');
			expect(keys).toContain('cliVersion');
		});
	});
});
