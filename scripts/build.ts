#!/usr/bin/env bun
/**
 * Bun build script for Task Master monorepo
 * Replaces tsdown configuration for building the CLI and MCP server
 */
import { $ } from 'bun';
import {
	readFileSync,
	copyFileSync,
	mkdirSync,
	existsSync,
	readdirSync,
	statSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const isProduction = process.env.NODE_ENV === 'production';
const projectRoot = resolve(import.meta.dirname, '..');

console.log(
	`Building Task Master (${isProduction ? 'production' : 'development'})...`
);

// Import fs/promises once for use throughout
const fsPromises = await import('node:fs/promises');

// Clean dist directory (but preserve assets if they exist from a previous build)
const distDir = join(projectRoot, 'dist');
if (existsSync(distDir)) {
	const entries = readdirSync(distDir);
	for (const entry of entries) {
		if (entry !== 'assets') {
			const entryPath = join(distDir, entry);
			const stat = statSync(entryPath);
			if (stat.isDirectory()) {
				await fsPromises.rm(entryPath, { recursive: true });
			} else {
				await fsPromises.unlink(entryPath);
			}
		}
	}
}

/**
 * Get build-time environment variables
 */
function getBuildTimeEnvs(): Record<string, string> {
	const envs: Record<string, string> = {};

	// Inject package.json version at build time
	try {
		const packageJson = JSON.parse(
			readFileSync(join(projectRoot, 'package.json'), 'utf8')
		);
		envs['TM_PUBLIC_VERSION'] = packageJson.version || 'unknown';
	} catch (error) {
		console.warn('Could not read package.json version during build:', error);
		envs['TM_PUBLIC_VERSION'] = 'unknown';
	}

	// Include all TM_PUBLIC_* env variables
	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith('TM_PUBLIC_')) {
			envs[key] = value || '';
		}
	}

	return envs;
}

/**
 * Recursively copy a directory
 */
function copyDir(src: string, dest: string): void {
	mkdirSync(dest, { recursive: true });
	const entries = readdirSync(src);

	for (const entry of entries) {
		const srcPath = join(src, entry);
		const destPath = join(dest, entry);
		const stat = statSync(srcPath);

		if (stat.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

// Get external dependencies from package.json (exclude @tm/* workspace packages)
function getExternalDependencies(): string[] {
	try {
		const pkg = JSON.parse(
			readFileSync(join(projectRoot, 'package.json'), 'utf8')
		);
		const allDeps = [
			...Object.keys(pkg.dependencies || {}),
			...Object.keys(pkg.devDependencies || {}),
			...Object.keys(pkg.optionalDependencies || {})
		];
		// Keep npm packages external, but bundle @tm/* workspace packages
		return allDeps.filter((dep) => !dep.startsWith('@tm/'));
	} catch {
		return [];
	}
}

// Build main entry points
const result = await Bun.build({
	entrypoints: [
		join(projectRoot, 'scripts/dev.js'),
		join(projectRoot, 'mcp-server/server.js')
	],
	outdir: join(projectRoot, 'dist'),
	target: 'node',
	format: 'esm',
	splitting: false,
	// Keep npm packages external, bundle @tm/* workspace packages and local code
	external: getExternalDependencies(),
	minify: isProduction,
	sourcemap: isProduction ? 'none' : 'linked',
	naming: {
		entry: '[name].js'
	},
	define: Object.fromEntries(
		Object.entries(getBuildTimeEnvs()).map(([key, value]) => [
			`process.env.${key}`,
			JSON.stringify(value)
		])
	)
});

if (!result.success) {
	console.error('Build failed:');
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Rename output files to match expected names
const devOutputPath = join(distDir, 'dev.js');
const taskMasterPath = join(distDir, 'task-master.js');

/**
 * Ensure file has exactly one shebang at the top
 */
function ensureShebang(content: string): string {
	const shebang = '#!/usr/bin/env node\n';
	// Remove any existing shebangs (there might be multiple from bundling)
	let cleaned = content.replace(/^(#!.*\n)+/gm, '');
	// Also handle shebangs that appear after the first line
	cleaned = cleaned.replace(/\n#!\/usr\/bin\/env node\n/g, '\n');
	return shebang + cleaned;
}

if (existsSync(devOutputPath)) {
	const content = readFileSync(devOutputPath, 'utf8');
	await fsPromises.writeFile(taskMasterPath, ensureShebang(content));
	await fsPromises.unlink(devOutputPath);
	await fsPromises.chmod(taskMasterPath, 0o755);
}

// Rename and fix shebang for mcp-server.js
const mcpServerPath = join(distDir, 'server.js');
const mcpFinalPath = join(distDir, 'mcp-server.js');
if (existsSync(mcpServerPath)) {
	const content = readFileSync(mcpServerPath, 'utf8');
	await fsPromises.writeFile(mcpFinalPath, ensureShebang(content));
	await fsPromises.unlink(mcpServerPath);
	await fsPromises.chmod(mcpFinalPath, 0o755);
}

// Copy assets directory
const assetsDir = join(projectRoot, 'assets');
const distAssetsDir = join(distDir, 'assets');
if (existsSync(assetsDir)) {
	copyDir(assetsDir, distAssetsDir);
	console.log('Copied assets to dist/');
}

console.log(
	'Build complete:',
	result.outputs.map((o) => o.path.replace(projectRoot + '/', ''))
);
