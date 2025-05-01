// test-config-manager.js
console.log('=== ENVIRONMENT TEST ===');
console.log('Working directory:', process.cwd());
console.log('NODE_PATH:', process.env.NODE_PATH);

// Test basic imports
try {
	console.log('Importing config-manager');
	// Use dynamic import for ESM
	const configManagerModule = await import(
		'./scripts/modules/config-manager.js'
	);
	const configManager = configManagerModule.default || configManagerModule;
	console.log('Config manager loaded successfully');

	console.log('Loading supported models');
	// Add after line 14 (after "Config manager loaded successfully")
	console.log('Config manager exports:', Object.keys(configManager));
} catch (error) {
	console.error('Import error:', error.message);
	console.error(error.stack);
}

// Test file access
try {
	console.log('Checking for .taskmasterconfig');
	// Use dynamic import for ESM
	const { readFileSync, existsSync } = await import('fs');
	const { resolve } = await import('path');

	const configExists = existsSync('./.taskmasterconfig');
	console.log('.taskmasterconfig exists:', configExists);

	if (configExists) {
		const config = JSON.parse(readFileSync('./.taskmasterconfig', 'utf-8'));
		console.log('Config keys:', Object.keys(config));
	}

	console.log('Checking for supported-models.json');
	const modelsPath = resolve('./scripts/modules/supported-models.json');
	console.log('Models path:', modelsPath);
	const modelsExists = existsSync(modelsPath);
	console.log('supported-models.json exists:', modelsExists);
} catch (error) {
	console.error('File access error:', error.message);
}

console.log('=== TEST COMPLETE ===');
