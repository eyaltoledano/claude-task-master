#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Flow TUI with output capture...');

const flowProcess = spawn('node', ['scripts/dev.js', 'flow'], {
	cwd: process.cwd(),
	stdio: ['inherit', 'pipe', 'pipe'],
	env: { ...process.env, FORCE_COLOR: '0' }
});

let output = '';
let errorOutput = '';

flowProcess.stdout.on('data', (data) => {
	const text = data.toString();
	output += text;

	// Look for our debug logs
	if (text.includes('ChatScreen') || text.includes('AIMessageHandler')) {
		console.log('DEBUG OUTPUT:', text);
	}
});

flowProcess.stderr.on('data', (data) => {
	const text = data.toString();
	errorOutput += text;
	console.error('STDERR:', text);
});

flowProcess.on('close', (code) => {
	console.log(`Flow process exited with code ${code}`);

	// Save output to file for inspection
	require('fs').writeFileSync('flow-output.txt', output);
	require('fs').writeFileSync('flow-error.txt', errorOutput);

	console.log('Output saved to flow-output.txt and flow-error.txt');
});

// Give it some time then kill it
setTimeout(() => {
	console.log('Stopping Flow process...');
	flowProcess.kill('SIGTERM');
}, 30000); // 30 seconds

console.log('Waiting for Flow output...');
