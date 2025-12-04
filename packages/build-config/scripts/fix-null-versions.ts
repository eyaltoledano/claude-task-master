#!/usr/bin/env npx tsx

/**
 * Fixes package.json files where version is null (changeset quirk).
 * Replaces "version": null with "version": ""
 *
 * Usage: npx tsx packages/build-config/scripts/fix-null-versions.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..', '..');

const packageFiles = globSync('**/package.json', {
	cwd: rootDir,
	ignore: ['**/node_modules/**'],
	absolute: true
});

let fixed = 0;

for (const file of packageFiles) {
	const content = readFileSync(file, 'utf8');

	if (content.includes('"version": null')) {
		const updated = content.replace(/"version": null/g, '"version": ""');
		writeFileSync(file, updated);
		console.log(`Fixed: ${file}`);
		fixed++;
	}
}

console.log(`\nDone. Fixed ${fixed} file(s).`);
