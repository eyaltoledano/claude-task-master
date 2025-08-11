#!/usr/bin/env node
/**
 * @fileoverview Simple cache management utility for models.dev integration
 * 
 * This is an optional utility that users can run to manage the models cache
 * Usage: node scripts/cache-models.js [refresh|status|clear]
 */

import { modelsDevService } from '../src/services/models-dev-service.js';
import chalk from 'chalk';

async function main() {
	const command = process.argv[2] || 'status';

	try {
		switch (command) {
			case 'refresh':
				console.log(chalk.blue('Refreshing models cache...'));
				await modelsDevService.clearCache();
				const models = await modelsDevService.fetchModels();
				const providers = Object.keys(models);
				console.log(chalk.green(`✅ Cache refreshed: ${providers.length} providers loaded`));
				break;

			case 'clear':
				console.log(chalk.blue('Clearing models cache...'));
				await modelsDevService.clearCache();
				console.log(chalk.green('✅ Cache cleared'));
				break;

			case 'status':
			default:
				const cacheInfo = await modelsDevService.getCacheInfo();
				console.log(chalk.blue('📦 Models Cache Status'));
				console.log(`Exists: ${cacheInfo.exists ? '✅' : '❌'}`);
				if (cacheInfo.exists) {
					console.log(`Age: ${cacheInfo.ageHours}h`);
					console.log(`Size: ${(cacheInfo.size / 1024).toFixed(1)}KB`);
					console.log(`Status: ${cacheInfo.expired ? '❌ Expired' : '✅ Fresh'}`);
				}
				break;
		}
	} catch (error) {
		console.error(chalk.red(`Error: ${error.message}`));
		process.exit(1);
	}
}

main();