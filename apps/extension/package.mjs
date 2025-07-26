import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageDir = path.resolve(__dirname, 'vsix-build');
// --- End Configuration ---

try {
	console.log('🚀 Starting packaging process...');

	// 1. Build Project
	console.log('\nBuilding JavaScript...');
	execSync('pnpm run build:js', { stdio: 'inherit' });
	console.log('\nBuilding CSS...');
	execSync('pnpm run build:css', { stdio: 'inherit' });

	// 2. Prepare Clean Directory
	console.log(`\nPreparing clean directory at: ${packageDir}`);
	fs.emptyDirSync(packageDir);

	// 3. Copy Build Artifacts (excluding source maps)
	console.log('Copying build artifacts...');
	const distDir = path.resolve(__dirname, 'dist');
	const targetDistDir = path.resolve(packageDir, 'dist');
	fs.ensureDirSync(targetDistDir);

	// Only copy the files we need (exclude .map files)
	const filesToCopy = ['extension.js', 'index.js', 'index.css'];
	for (const file of filesToCopy) {
		const srcFile = path.resolve(distDir, file);
		const destFile = path.resolve(targetDistDir, file);
		if (fs.existsSync(srcFile)) {
			fs.copySync(srcFile, destFile);
			console.log(`  - Copied dist/${file}`);
		}
	}

	// 4. Copy additional files
	const additionalFiles = ['README.md', 'CHANGELOG.md', 'AGENTS.md'];
	for (const file of additionalFiles) {
		if (fs.existsSync(path.resolve(__dirname, file))) {
			fs.copySync(
				path.resolve(__dirname, file),
				path.resolve(packageDir, file)
			);
			console.log(`  - Copied ${file}`);
		}
	}

	// 5. Sync versions and prepare the final package.json
	console.log('Syncing versions and preparing the final package.json...');
	
	// Read current versions
	const devPackagePath = path.resolve(__dirname, 'package.json');
	const publishPackagePath = path.resolve(__dirname, 'package.publish.json');
	
	const devPackage = JSON.parse(fs.readFileSync(devPackagePath, 'utf8'));
	const publishPackage = JSON.parse(fs.readFileSync(publishPackagePath, 'utf8'));
	
	// Check if versions are in sync
	if (devPackage.version !== publishPackage.version) {
		console.log(`  - Version sync needed: ${publishPackage.version} → ${devPackage.version}`);
		publishPackage.version = devPackage.version;
		
		// Update the source package.publish.json file
		fs.writeFileSync(publishPackagePath, JSON.stringify(publishPackage, null, '\t') + '\n');
		console.log(`  - Updated package.publish.json version to ${devPackage.version}`);
	} else {
		console.log(`  - Versions already in sync: ${devPackage.version}`);
	}
	
	// Copy the (now synced) package.publish.json as package.json
	fs.copySync(publishPackagePath, path.resolve(packageDir, 'package.json'));
	console.log('  - Copied package.publish.json as package.json');

	// 6. Copy .vscodeignore if it exists
	if (fs.existsSync(path.resolve(__dirname, '.vscodeignore'))) {
		fs.copySync(
			path.resolve(__dirname, '.vscodeignore'),
			path.resolve(packageDir, '.vscodeignore')
		);
		console.log('  - Copied .vscodeignore');
	}

	// 7. Copy LICENSE if it exists
	if (fs.existsSync(path.resolve(__dirname, 'LICENSE'))) {
		fs.copySync(
			path.resolve(__dirname, 'LICENSE'),
			path.resolve(packageDir, 'LICENSE')
		);
		console.log('  - Copied LICENSE');
	}

	// 7a. Copy assets directory if it exists
	const assetsDir = path.resolve(__dirname, 'assets');
	if (fs.existsSync(assetsDir)) {
		const targetAssetsDir = path.resolve(packageDir, 'assets');
		fs.copySync(assetsDir, targetAssetsDir);
		console.log('  - Copied assets directory');
	}

	// Small delay to ensure file system operations complete
	await new Promise((resolve) => setTimeout(resolve, 100));

	// 8. Final step - manual packaging
	console.log('\n✅ Build preparation complete!');
	console.log('\nTo create the VSIX package, run:');
	console.log(
		'\x1b[36m%s\x1b[0m',
		`cd vsix-build && pnpm exec vsce package --no-dependencies`
	);

	// Use the synced version for output
	const finalVersion = devPackage.version;
	console.log(
		`\nYour extension will be packaged to: vsix-build/taskr-kanban-${finalVersion}.vsix`
	);
} catch (error) {
	console.error('\n❌ Packaging failed!');
	console.error(error.message);
	process.exit(1);
}
