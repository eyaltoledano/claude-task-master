#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = ['--config', 'jest.e2e.config.js', ...process.argv.slice(2)];

const jest = spawn('jest', args, {
	cwd: path.join(__dirname, '../..'),
	stdio: 'inherit',
	env: { ...process.env, NODE_ENV: 'test' }
});

jest.on('exit', (code) => {
	process.exit(code);
});
