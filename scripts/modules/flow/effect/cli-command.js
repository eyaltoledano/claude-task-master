/**
 * Task Master Flow - Effect CLI Command Integration
 * Phase 0: Foundation & Setup
 * 
 * Provides CLI commands for testing and managing Effect integration.
 */

import { runFlowEffect } from './runtime.js';
import { healthCheck, extendedHealthCheck } from './effects/health.js';
import { runBasicIntegrationTest, runSmokeTest } from './test-integration.js';
import { EFFECT_MODULE_VERSION, EFFECT_FEATURES, isEffectAvailable } from './index.js';

/**
 * Handle flow:health command
 * 
 * @param {Object} options - Command options
 */
export async function handleFlowHealthCommand(options = {}) {
  try {
    console.log(`🌊 Task Master Flow Effect Health Check v${EFFECT_MODULE_VERSION}`);
    console.log('─'.repeat(50));
    
    // Check if Effect is available
    const effectAvailable = await isEffectAvailable();
    if (!effectAvailable) {
      console.error('❌ Effect is not available. Please check installation.');
      process.exit(1);
    }
    
    // Run appropriate health check
    const healthResult = options.extended 
      ? await runFlowEffect(extendedHealthCheck)
      : await runFlowEffect(healthCheck);
    
    // Display results
    console.log('✅ Health Check Results:');
    console.log(`   Status: ${healthResult.status}`);
    console.log(`   Module: ${healthResult.module}`);
    console.log(`   Version: ${healthResult.version}`);
    console.log(`   Phase: ${healthResult.phase}`);
    console.log(`   Timestamp: ${healthResult.timestamp}`);
    
    if (options.extended && healthResult.extended) {
      console.log('\n🔍 Extended Diagnostics:');
      console.log(`   Environment: ${JSON.stringify(healthResult.extended.environment, null, 2)}`);
      console.log(`   File System: ${JSON.stringify(healthResult.extended.fileSystem, null, 2)}`);
    }
    
    if (options.json) {
      console.log('\n📄 JSON Output:');
      console.log(JSON.stringify(healthResult, null, 2));
    }
    
    return healthResult;
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Handle flow:test command
 * 
 * @param {Object} options - Command options
 */
export async function handleFlowTestCommand(options = {}) {
  try {
    console.log(`🧪 Task Master Flow Effect Integration Tests v${EFFECT_MODULE_VERSION}`);
    console.log('─'.repeat(60));
    
    if (options.smoke) {
      console.log('🚀 Running smoke test...');
      const passed = await runSmokeTest();
      console.log(passed ? '✅ Smoke test passed' : '❌ Smoke test failed');
      process.exit(passed ? 0 : 1);
    }
    
    // Run full integration test
    const results = await runBasicIntegrationTest();
    
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    }
    
    const success = results.overall === 'passed';
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test command failed:', error.message);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Handle flow:info command
 * 
 * @param {Object} options - Command options
 */
export async function handleFlowInfoCommand(options = {}) {
  try {
    const info = {
      module: 'task-master-flow-effect',
      version: EFFECT_MODULE_VERSION,
      phase: 'Phase 0: Foundation & Setup',
      features: EFFECT_FEATURES,
      effectAvailable: await isEffectAvailable(),
      environment: {
        nodejs: process.version,
        platform: process.platform,
        arch: process.arch
      },
      paths: {
        effectModule: 'scripts/modules/flow/effect',
        dataStorage: '.taskmaster/flow'
      }
    };
    
    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(`🌊 Task Master Flow Effect Information`);
      console.log('─'.repeat(40));
      console.log(`Module: ${info.module}`);
      console.log(`Version: ${info.version}`);
      console.log(`Phase: ${info.phase}`);
      console.log(`Effect Available: ${info.effectAvailable ? '✅' : '❌'}`);
      console.log(`Node.js: ${info.environment.nodejs}`);
      console.log(`Platform: ${info.environment.platform}`);
      
      console.log('\n🚩 Features:');
      Object.entries(info.features).forEach(([feature, enabled]) => {
        const status = enabled ? '✅' : '⏸️';
        console.log(`   ${status} ${feature}`);
      });
    }
    
    return info;
    
  } catch (error) {
    console.error('❌ Info command failed:', error.message);
    if (options.verbose) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

/**
 * Register Effect commands with Task Master CLI
 * 
 * @param {Object} program - Commander.js program instance
 */
export function registerEffectCommands(program) {
  // flow:health command
  program
    .command('flow:health')
    .description('Check Task Master Flow Effect integration health')
    .option('--extended', 'Run extended health check with diagnostics')
    .option('--json', 'Output results in JSON format')
    .option('--verbose', 'Show detailed error information')
    .action(handleFlowHealthCommand);
  
  // flow:test command
  program
    .command('flow:test')
    .description('Run Task Master Flow Effect integration tests')
    .option('--smoke', 'Run only smoke test (quick)')
    .option('--json', 'Output results in JSON format')
    .option('--verbose', 'Show detailed error information')
    .action(handleFlowTestCommand);
  
  // flow:info command
  program
    .command('flow:info')
    .description('Show Task Master Flow Effect module information')
    .option('--json', 'Output results in JSON format')
    .option('--verbose', 'Show detailed information')
    .action(handleFlowInfoCommand);
} 