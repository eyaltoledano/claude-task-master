#!/usr/bin/env node

/**
 * Test script for Flow TUI backends
 */

import { DirectBackend } from './scripts/modules/flow/backends/direct-backend.js';
import { CliBackend } from './scripts/modules/flow/backends/cli-backend.js';
import { findProjectRoot } from './scripts/modules/utils.js';

async function testBackend(backend, name) {
	console.log(`\n=== Testing ${name} Backend ===`);

	try {
		// Initialize
		console.log('Initializing...');
		await backend.initialize();
		console.log('✓ Initialized');

		// Check if tasks.json exists
		console.log('\nChecking tasks.json...');
		const hasTasksFile = await backend.hasTasksFile();
		console.log(`✓ Has tasks.json: ${hasTasksFile}`);

		if (hasTasksFile) {
			// List tasks
			console.log('\nListing tasks...');
			const { tasks, tag } = await backend.listTasks();
			console.log(`✓ Found ${tasks.length} tasks in tag: ${tag}`);

			// Get next task
			console.log('\nGetting next task...');
			const { task } = await backend.nextTask();
			if (task) {
				console.log(`✓ Next task: ${task.id} - ${task.title}`);
			} else {
				console.log('✓ No pending tasks');
			}

			// List tags
			console.log('\nListing tags...');
			const { tags, currentTag } = await backend.listTags();
			console.log(`✓ Found ${tags.length} tags, current: ${currentTag}`);
			tags.forEach((tag) => {
				console.log(`  - ${tag.name}${tag.isCurrent ? ' (current)' : ''}`);
			});
		}

		console.log(`\n✓ ${name} backend test completed successfully`);
	} catch (error) {
		console.error(`✗ ${name} backend test failed:`, error.message);
	}
}

async function main() {
	const projectRoot = findProjectRoot() || process.cwd();
	console.log(`Project root: ${projectRoot}`);

	// Test Direct Backend
	const directBackend = new DirectBackend({
		projectRoot,
		session: { env: process.env }
	});
	await testBackend(directBackend, 'Direct');

	// Test CLI Backend
	const cliBackend = new CliBackend({
		projectRoot,
		execPath: 'node',
		scriptPath: 'scripts/dev.js'
	});
	await testBackend(cliBackend, 'CLI');

	console.log('\n=== All tests completed ===');
}

main().catch(console.error);
