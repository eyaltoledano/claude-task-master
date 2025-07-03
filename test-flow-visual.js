#!/usr/bin/env node

/**
 * Visual test for Flow TUI backends
 * Run this to see the Flow UI with different backends
 */

import { spawn } from 'child_process';

async function testBackend(backend) {
	console.log(`\n=== Testing ${backend} backend ===`);
	console.log(`Run: node scripts/dev.js flow --backend ${backend}`);
	console.log(
		'Press Ctrl+C in the Flow UI to exit and continue to next backend\n'
	);

	return new Promise((resolve) => {
		const proc = spawn(
			'node',
			['scripts/dev.js', 'flow', '--backend', backend],
			{
				stdio: 'inherit'
			}
		);

		proc.on('exit', () => {
			console.log(`\n${backend} backend test completed`);
			resolve();
		});
	});
}

async function main() {
	console.log('Task Master Flow - Backend Test');
	console.log('==============================');
	console.log('This will launch the Flow UI with each backend.');
	console.log('Use /exit or Ctrl+C to close each one.\n');

	// Test Direct Backend
	await testBackend('direct');

	// Test CLI Backend
	await testBackend('cli');

	console.log('\nAll backend tests completed!');
	console.log('\nNote: The MCP backend requires server configuration to test.');
}

main().catch(console.error);
