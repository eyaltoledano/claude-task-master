#!/usr/bin/env node

/**
 * TOON CLI Utility
 * 
 * Command-line interface for managing TOON (Token-Oriented Object Notation) settings
 * and testing TOON integration with Task Master's AI services.
 */

import { program } from 'commander';
import chalk from 'chalk';
import { 
	enableToonForAIServices, 
	disableToonForAIServices, 
	isToonIntegrationEnabled,
	getToonIntegrationStats,
	testToonWithTaskData
} from '../src/serialization/toon-ai-services-integration.js';
import { 
	jsonToToon, 
	toonToJson, 
	estimateTokenSavings, 
	validateToonRoundTrip 
} from '../src/serialization/index.js';
import { log } from './modules/utils.js';

program
	.name('toon-cli')
	.description('TOON (Token-Oriented Object Notation) CLI for Task Master')
	.version('1.0.0');

// Enable TOON integration
program
	.command('enable')
	.description('Enable TOON serialization for AI services')
	.option('--min-size <size>', 'Minimum data size to use TOON (default: 100)', '100')
	.option('--min-savings <percent>', 'Minimum savings percentage to use TOON (default: 10)', '10')
	.action(async (options) => {
		try {
			console.log(chalk.blue('🚀 Enabling TOON integration for AI services...'));
			
			const config = {
				minDataSize: parseInt(options.minSize),
				minSavingsThreshold: parseFloat(options.minSavings)
			};
			
			await enableToonForAIServices(config);
			
			console.log(chalk.green('✅ TOON integration enabled successfully!'));
			console.log(chalk.gray(`   Minimum data size: ${config.minDataSize} characters`));
			console.log(chalk.gray(`   Minimum savings threshold: ${config.minSavingsThreshold}%`));
			
		} catch (error) {
			console.error(chalk.red(`❌ Failed to enable TOON integration: ${error.message}`));
			process.exit(1);
		}
	});

// Disable TOON integration
program
	.command('disable')
	.description('Disable TOON serialization for AI services')
	.action(async () => {
		try {
			console.log(chalk.blue('🛑 Disabling TOON integration for AI services...'));
			
			await disableToonForAIServices();
			
			console.log(chalk.green('✅ TOON integration disabled successfully!'));
			
		} catch (error) {
			console.error(chalk.red(`❌ Failed to disable TOON integration: ${error.message}`));
			process.exit(1);
		}
	});

// Show TOON status
program
	.command('status')
	.description('Show TOON integration status and statistics')
	.action(async () => {
		try {
			const isEnabled = isToonIntegrationEnabled();
			const stats = getToonIntegrationStats();
			
			console.log(chalk.bold('\n📊 TOON Integration Status\n'));
			console.log(`Status: ${isEnabled ? chalk.green('✅ Enabled') : chalk.red('❌ Disabled')}`);
			
			if (isEnabled) {
				console.log(chalk.gray('\nConfiguration:'));
				console.log(`  Min data size: ${stats.config.minDataSize} characters`);
				console.log(`  Min savings threshold: ${stats.config.minSavingsThreshold}%`);
				
				console.log(chalk.gray('\nProvider Statistics:'));
				console.log(`  Enhanced providers: ${stats.totalEnhancedProviders}`);
				if (stats.providerNames.length > 0) {
					console.log(`  Provider names: ${stats.providerNames.join(', ')}`);
				}
			}
			
		} catch (error) {
			console.error(chalk.red(`❌ Failed to get TOON status: ${error.message}`));
			process.exit(1);
		}
	});

// Test TOON with sample data
program
	.command('test')
	.description('Test TOON serialization with sample task data')
	.option('--enable-first', 'Enable TOON integration before testing')
	.action(async (options) => {
		try {
			console.log(chalk.blue('🧪 Testing TOON serialization...'));
			
			if (options.enableFirst) {
				console.log(chalk.gray('  Enabling TOON integration first...'));
				await enableToonForAIServices();
			}
			
			if (!isToonIntegrationEnabled()) {
				console.log(chalk.yellow('⚠️  TOON integration is not enabled. Use --enable-first or run "toon-cli enable" first.'));
				console.log(chalk.gray('   Running basic serialization test without AI integration...'));
				
				// Run basic serialization test
				const testData = {
					tasks: [
						{ id: 'task-1', title: 'Test task', status: 'pending' },
						{ id: 'task-2', title: 'Another task', status: 'done' }
					]
				};
				
				const validation = validateToonRoundTrip(testData);
				const savings = estimateTokenSavings(testData);
				
				console.log(chalk.gray('\nSerialization Test Results:'));
				console.log(`  Round-trip valid: ${validation.isValid ? chalk.green('✅') : chalk.red('❌')}`);
				if (savings) {
					console.log(`  Token savings: ${savings.estimatedTokenSavings} (${savings.estimatedTokenSavingsPercentage}%)`);
					console.log(`  Character savings: ${savings.characterSavings} (${savings.savingsPercentage}%)`);
				}
				
				return;
			}
			
			// Run full integration test
			const testResults = await testToonWithTaskData();
			
			console.log(chalk.green('\n✅ TOON Integration Test Results:'));
			console.log(`  Test successful: ${testResults.testSuccessful ? '✅' : '❌'}`);
			console.log(`  Data suitable for TOON: ${testResults.suitability.suitable ? '✅' : '❌'}`);
			console.log(`  Reason: ${testResults.suitability.reason}`);
			
			if (testResults.savings) {
				console.log(chalk.gray('\nToken Savings Analysis:'));
				console.log(`  Character savings: ${testResults.savings.characterSavings} chars (${testResults.savings.savingsPercentage}%)`);
				console.log(`  Estimated token savings: ${testResults.savings.estimatedTokenSavings} tokens (${testResults.savings.estimatedTokenSavingsPercentage}%)`);
				console.log(`  Original size: ${testResults.savings.jsonLength} chars (≈${testResults.savings.estimatedJsonTokens} tokens)`);
				console.log(`  TOON size: ${testResults.savings.toonLength} chars (≈${testResults.savings.estimatedToonTokens} tokens)`);
			}
			
		} catch (error) {
			console.error(chalk.red(`❌ TOON test failed: ${error.message}`));
			process.exit(1);
		}
	});

// Convert JSON to TOON
program
	.command('convert <file>')
	.description('Convert a JSON file to TOON format')
	.option('-o, --output <file>', 'Output file (default: stdout)')
	.action(async (file, options) => {
		try {
			const fs = await import('fs/promises');
			const path = await import('path');
			
			console.log(chalk.blue(`📄 Converting ${file} to TOON format...`));
			
			// Read input file
			const jsonContent = await fs.readFile(file, 'utf8');
			const jsonData = JSON.parse(jsonContent);
			
			// Convert to TOON
			const toonContent = jsonToToon(jsonData);
			
			// Calculate savings
			const savings = estimateTokenSavings(jsonData);
			
			if (options.output) {
				await fs.writeFile(options.output, toonContent);
				console.log(chalk.green(`✅ TOON output written to ${options.output}`));
			} else {
				console.log(chalk.gray('\n--- TOON Output ---'));
				console.log(toonContent);
				console.log(chalk.gray('--- End TOON ---\n'));
			}
			
			if (savings) {
				console.log(chalk.gray('Conversion Statistics:'));
				console.log(`  Original: ${savings.jsonLength} chars (≈${savings.estimatedJsonTokens} tokens)`);
				console.log(`  TOON: ${savings.toonLength} chars (≈${savings.estimatedToonTokens} tokens)`);
				console.log(`  Savings: ${savings.characterSavings} chars (${savings.savingsPercentage}%) / ${savings.estimatedTokenSavings} tokens (${savings.estimatedTokenSavingsPercentage}%)`);
			}
			
		} catch (error) {
			console.error(chalk.red(`❌ Conversion failed: ${error.message}`));
			process.exit(1);
		}
	});

// Parse and handle commands
if (process.argv.length <= 2) {
	program.help();
} else {
	program.parse();
}