/**
 * Task Master Flow - Effect Integration Test
 * Phase 0: Foundation & Setup
 *
 * Basic integration test to verify Effect functionality is working
 * without interfering with existing Flow module.
 */

import { runFlowEffect, runFlowEffectSync } from './runtime.js';
import {
	healthCheck,
	extendedHealthCheck,
	quickHealthCheck
} from './effects/health.js';
import { getDefaultConfig, validateEffectConfig } from './config.js';
import {
	isEffectAvailable,
	EFFECT_FEATURES,
	EFFECT_MODULE_VERSION
} from './index.js';

/**
 * Run basic integration tests
 *
 * @returns {Promise<Object>} Test results
 */
export async function runBasicIntegrationTest() {
	console.log('🧪 Running Task Master Flow Effect Integration Tests (Phase 0)');
	console.log('='.repeat(60));

	const results = {
		timestamp: new Date().toISOString(),
		version: EFFECT_MODULE_VERSION,
		tests: {},
		overall: 'pending'
	};

	try {
		// Test 1: Effect availability
		console.log('📦 Test 1: Effect availability...');
		const effectAvailable = await isEffectAvailable();
		results.tests.effectAvailable = {
			passed: effectAvailable,
			message: effectAvailable
				? 'Effect is available'
				: 'Effect is not available'
		};

		// Test 2: Basic health check
		console.log('💓 Test 2: Basic health check...');
		const healthResult = await runFlowEffect(healthCheck);
		results.tests.basicHealthCheck = {
			passed: healthResult.status === 'ok',
			message: `Health check returned: ${healthResult.status}`,
			data: healthResult
		};

		// Test 3: Quick health check (synchronous)
		console.log('⚡ Test 3: Quick health check...');
		const quickResult = runFlowEffectSync(quickHealthCheck);
		results.tests.quickHealthCheck = {
			passed: quickResult.status === 'ok',
			message: `Quick check returned: ${quickResult.status}`,
			data: quickResult
		};

		// Test 4: Configuration system
		console.log('⚙️  Test 4: Configuration system...');
		const defaultConfig = getDefaultConfig();
		const configValid = validateEffectConfig(defaultConfig);
		results.tests.configSystem = {
			passed: configValid,
			message: configValid
				? 'Configuration system working'
				: 'Configuration validation failed',
			data: defaultConfig
		};

		// Test 5: Feature flags
		console.log('🚩 Test 5: Feature flags...');
		const hasRequiredFeatures = EFFECT_FEATURES.HEALTH_CHECK === true;
		results.tests.featureFlags = {
			passed: hasRequiredFeatures,
			message: hasRequiredFeatures
				? 'Feature flags configured correctly'
				: 'Feature flags misconfigured',
			data: EFFECT_FEATURES
		};

		// Calculate overall result
		const allTestsPassed = Object.values(results.tests).every(
			(test) => test.passed
		);
		results.overall = allTestsPassed ? 'passed' : 'failed';

		console.log('\n📊 Test Results Summary:');
		console.log(`Overall: ${results.overall.toUpperCase()}`);
		Object.entries(results.tests).forEach(([name, result]) => {
			const status = result.passed ? '✅' : '❌';
			console.log(`${status} ${name}: ${result.message}`);
		});

		return results;
	} catch (error) {
		console.error('❌ Integration test failed:', error.message);
		results.overall = 'error';
		results.error = error.message;
		return results;
	}
}

/**
 * Run extended integration tests
 *
 * @returns {Promise<Object>} Extended test results
 */
export async function runExtendedIntegrationTest() {
	console.log('🔬 Running Extended Integration Tests...');

	try {
		// Run basic tests first
		const basicResults = await runBasicIntegrationTest();

		// Add extended health check
		console.log('🩺 Extended health check...');
		const extendedHealth = await runFlowEffect(extendedHealthCheck);

		return {
			...basicResults,
			extended: {
				healthCheck: extendedHealth,
				systemInfo: {
					nodejs: process.version,
					platform: process.platform,
					arch: process.arch,
					env: {
						flowEffectEnabled: process.env.FLOW_EFFECT_ENABLED,
						flowLogLevel: process.env.FLOW_EFFECT_LOG_LEVEL
					}
				}
			}
		};
	} catch (error) {
		console.error('❌ Extended integration test failed:', error.message);
		return { error: error.message };
	}
}

/**
 * Quick smoke test for CI/CD
 *
 * @returns {Promise<boolean>} True if basic functionality works
 */
export async function runSmokeTest() {
	try {
		const effectAvailable = await isEffectAvailable();
		if (!effectAvailable) return false;

		const healthResult = await runFlowEffect(healthCheck);
		return healthResult.status === 'ok';
	} catch (error) {
		console.error('Smoke test failed:', error.message);
		return false;
	}
}

/**
 * CLI interface for running tests
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	const testType = process.argv[2] || 'basic';

	switch (testType) {
		case 'basic':
			runBasicIntegrationTest();
			break;
		case 'extended':
			runExtendedIntegrationTest();
			break;
		case 'smoke':
			runSmokeTest().then((result) => {
				console.log(result ? '✅ Smoke test passed' : '❌ Smoke test failed');
				process.exit(result ? 0 : 1);
			});
			break;
		default:
			console.log('Usage: node test-integration.js [basic|extended|smoke]');
			process.exit(1);
	}
}
