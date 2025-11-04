#!/usr/bin/env node
/**
 * Quick test script for package manager utilities
 */

import { 
	detectPackageManager, 
	getPackageManagerExecutor, 
	getSuggestedInstallCommand 
} from './src/utils/package-manager-utils.js';

console.log('Testing package manager detection...');

// Test current directory
const currentManager = detectPackageManager();
const currentExecutor = getPackageManagerExecutor();
const sampleInstallCommand = getSuggestedInstallCommand('@anthropic-ai/claude-code', true);

console.log(`Detected package manager: ${currentManager}`);
console.log(`Executor command: ${currentExecutor}`);
console.log(`Sample install command: ${sampleInstallCommand}`);

// Test a few mock scenarios
console.log('\nTesting mock scenarios...');

// Create temporary test directories
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, 'temp-test-pm');

// Create test directory
if (!fs.existsSync(testDir)) {
	fs.mkdirSync(testDir);
}

// Test npm detection
const npmTestDir = path.join(testDir, 'npm-test');
fs.mkdirSync(npmTestDir, { recursive: true });
fs.writeFileSync(path.join(npmTestDir, 'package-lock.json'), '{}');
console.log(`npm test dir: ${detectPackageManager(npmTestDir)}`);

// Test pnpm detection
const pnpmTestDir = path.join(testDir, 'pnpm-test');
fs.mkdirSync(pnpmTestDir, { recursive: true });
fs.writeFileSync(path.join(pnpmTestDir, 'pnpm-lock.yaml'), 'lockfileVersion: 5.4');
console.log(`pnpm test dir: ${detectPackageManager(pnpmTestDir)}`);

// Test yarn detection
const yarnTestDir = path.join(testDir, 'yarn-test');
fs.mkdirSync(yarnTestDir, { recursive: true });
fs.writeFileSync(path.join(yarnTestDir, 'yarn.lock'), '# yarn');
console.log(`yarn test dir: ${detectPackageManager(yarnTestDir)}`);

// Cleanup
fs.rmSync(testDir, { recursive: true, force: true });

console.log('\nTest completed successfully!');