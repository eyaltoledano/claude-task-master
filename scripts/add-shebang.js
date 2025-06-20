#!/usr/bin/env node

import {
	readFileSync,
	writeFileSync,
	chmodSync,
	copyFileSync,
	mkdirSync,
	existsSync
} from 'fs';
import { join, dirname } from 'path';

const bundlePaths = [
	join(process.cwd(), 'dist/task-master.cjs'), // CLI tool
	join(process.cwd(), 'dist/task-master-mcp.cjs') // MCP server
];

try {
	// Copy necessary asset files to dist
	const assetsToCopy = [
		{
			src: 'scripts/modules/supported-models.json',
			dest: 'dist/supported-models.json'
		},
		{ src: 'README-task-master.md', dest: 'dist/README-task-master.md' }
	];

	console.log('📁 Copying assets...');
	for (const asset of assetsToCopy) {
		const srcPath = join(process.cwd(), asset.src);
		const destPath = join(process.cwd(), asset.dest);

		if (existsSync(srcPath)) {
			// Ensure destination directory exists
			const destDir = dirname(destPath);
			if (!existsSync(destDir)) {
				mkdirSync(destDir, { recursive: true });
			}

			copyFileSync(srcPath, destPath);
			console.log(`  ✅ Copied ${asset.src} → ${asset.dest}`);
		} else {
			console.log(`  ⚠️  Source not found: ${asset.src}`);
		}
	}

	// Process each bundle file
	for (const bundlePath of bundlePaths) {
		const fileName = bundlePath.split('/').pop();

		if (!existsSync(bundlePath)) {
			console.log(`⚠️  Bundle not found: ${fileName}`);
			continue;
		}

		// Read the existing bundle
		const bundleContent = readFileSync(bundlePath, 'utf8');

		// Add shebang if it doesn't already exist
		if (!bundleContent.startsWith('#!/usr/bin/env node')) {
			const contentWithShebang = '#!/usr/bin/env node\n' + bundleContent;
			writeFileSync(bundlePath, contentWithShebang);
			console.log(`✅ Added shebang to ${fileName}`);
		} else {
			console.log(`✅ Shebang already exists in ${fileName}`);
		}

		// Make it executable
		chmodSync(bundlePath, 0o755);
		console.log(`✅ Made ${fileName} executable`);
	}

	console.log('📦 Both bundles ready:');
	console.log('  🔧 CLI tool: dist/task-master.cjs');
	console.log('  🔌 MCP server: dist/task-master-mcp.cjs');
	console.log('🧪 Test with:');
	console.log('  node dist/task-master.cjs --version');
	console.log('  node dist/task-master-mcp.cjs --help');
} catch (error) {
	console.error('❌ Post-build failed:', error.message);
	process.exit(1);
}
