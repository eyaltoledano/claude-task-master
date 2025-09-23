#!/usr/bin/env node
import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRootDir, runCommand } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = findRootDir(__dirname);

console.log('🚀 Starting release process...');

// Double-check we're not in pre-release mode (safety net)
const preJsonPath = join(rootDir, '.changeset', 'pre.json');
if (existsSync(preJsonPath)) {
	console.log('⚠️  Warning: pre.json still exists. Removing it...');
	unlinkSync(preJsonPath);
}

// Check if the extension version has changed and tag it
// This prevents changeset from trying to publish the private package
runCommand('node', [join(__dirname, 'tag-extension.mjs')]);

// Run changeset publish for npm packages
runCommand('npx', ['changeset', 'publish']);

console.log('✅ Release process completed!');

// The extension tag (if created) will trigger the extension-release workflow
