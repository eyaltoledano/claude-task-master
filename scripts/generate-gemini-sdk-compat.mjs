import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdkName = 'ai-sdk-provider-gemini-cli';
const sdkVersion = '1.4.0';
const expectedSourceHash =
	'8212d6bec119b9d72aac97417e3e26c4c30fa33249bdadeaf72634e37264d934';
const expectedLicenseHash =
	'47108b8e8588b07addc4203ffbff01d5623fc5e034d529bd386a2228d78ce933';
const args = process.argv.slice(2);
assert(
	args.length === 0 || (args.length === 1 && args[0] === '--check'),
	'Usage: node scripts/generate-gemini-sdk-compat.mjs [--check]'
);
const checkOnly = args[0] === '--check';

// require.resolve works on Node 20.0 without experimental resolver flags.
const require = createRequire(import.meta.url);
const upstreamDist = dirname(require.resolve(sdkName));
const upstreamPackage = JSON.parse(
	await readFile(resolve(upstreamDist, '../package.json'), 'utf8')
);
assert.equal(upstreamPackage.name, sdkName);
assert.equal(
	upstreamPackage.version,
	sdkVersion,
	'Review the compatibility snapshot before upgrading the upstream SDK.'
);

const source = await readFile(resolve(upstreamDist, 'index.mjs'), 'utf8');
const license = await readFile(resolve(upstreamDist, '../LICENSE'), 'utf8');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(
	sha256(source),
	expectedSourceHash,
	'The upstream SDK source changed; review it before updating its SHA-256.'
);
assert.equal(
	sha256(license),
	expectedLicenseHash,
	'The upstream SDK license changed; review it before updating its SHA-256.'
);

const coreImport = `import {
  createContentGenerator,
  createContentGeneratorConfig,
  AuthType
} from "@google/gemini-cli-core";`;
assert.equal(
	source.split(coreImport).length - 1,
	1,
	'Expected exactly one core import with the three reviewed SDK symbols.'
);
assert.equal(source.split('"@google/gemini-cli-core"').length - 1, 1);
const sourceMapComment = /\n\/\/# sourceMappingURL=index\.mjs\.map\r?\n?$/;
assert.match(source, sourceMapComment);

const banner = `/**
 * Generated from ${sdkName} ${sdkVersion}, dist/index.mjs.
 * Upstream SHA-256: ${expectedSourceHash}
 * Copyright (c) 2025 Ben Vargas. MIT License; see ./LICENSE.
 * Only the Gemini core import is narrowed; the obsolete source map is removed.
 * Regenerate: node scripts/generate-gemini-sdk-compat.mjs
 */
`;
const generated =
	banner +
	source
		.replace(
			'"@google/gemini-cli-core"',
			'"@google/gemini-cli-core/dist/src/core/contentGenerator.js"'
		)
		.replace(sourceMapComment, '\n');
const outputDir = fileURLToPath(
	new URL('../src/ai-providers/gemini-cli-sdk/', import.meta.url)
);
const outputs = new Map([
	['index.js', generated],
	// Keep the upstream type boundary without loading the development SDK at runtime.
	['index.d.ts', "export * from 'ai-sdk-provider-gemini-cli';\n"],
	['LICENSE', license]
]);

if (!checkOnly) await mkdir(outputDir, { recursive: true });
for (const [filename, content] of outputs) {
	const outputPath = resolve(outputDir, filename);
	if (checkOnly) {
		// Git may check text files out with CRLF on Windows.
		assert.equal(
			(await readFile(outputPath, 'utf8')).replace(/\r\n/g, '\n'),
			content,
			`${filename} is stale. Run node scripts/generate-gemini-sdk-compat.mjs.`
		);
	} else {
		await writeFile(outputPath, content, 'utf8');
	}
}
console.log(
	`${checkOnly ? 'Verified' : 'Generated'} ${sdkName} ${sdkVersion} compatibility snapshot.`
);
