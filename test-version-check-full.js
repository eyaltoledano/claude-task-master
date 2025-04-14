import {
	checkForUpdate,
	displayUpgradeNotification,
	compareVersions
} from './scripts/modules/commands.js';
import fs from 'fs';
import path from 'path';

// Force our current version for testing
process.env.FORCE_VERSION = '0.9.30';

// Create a mock package.json in memory for testing
const mockPackageJson = {
	name: 'task-master-ai',
	version: '0.9.30'
};

// Modified version of checkForUpdate that doesn't use HTTP for testing
async function testCheckForUpdate(simulatedLatestVersion) {
	// Get current version - use our forced version
	const currentVersion = process.env.FORCE_VERSION || '0.9.30';

	console.log(`Using simulated current version: ${currentVersion}`);
	console.log(`Using simulated latest version: ${simulatedLatestVersion}`);

	// Compare versions
	const needsUpdate =
		compareVersions(currentVersion, simulatedLatestVersion) < 0;

	return {
		currentVersion,
		latestVersion: simulatedLatestVersion,
		needsUpdate
	};
}

// Test with current version older than latest (should show update notice)
async function runTest() {
	console.log('=== Testing version check scenarios ===\n');

	// Scenario 1: Update available
	console.log(
		'\n--- Scenario 1: Update available (Current: 0.9.30, Latest: 1.0.0) ---'
	);
	const updateInfo1 = await testCheckForUpdate('1.0.0');
	console.log('Update check results:');
	console.log(`- Current version: ${updateInfo1.currentVersion}`);
	console.log(`- Latest version: ${updateInfo1.latestVersion}`);
	console.log(`- Update needed: ${updateInfo1.needsUpdate}`);

	if (updateInfo1.needsUpdate) {
		console.log('\nDisplaying upgrade notification:');
		displayUpgradeNotification(
			updateInfo1.currentVersion,
			updateInfo1.latestVersion
		);
	}

	// Scenario 2: No update needed (versions equal)
	console.log(
		'\n--- Scenario 2: No update needed (Current: 0.9.30, Latest: 0.9.30) ---'
	);
	const updateInfo2 = await testCheckForUpdate('0.9.30');
	console.log('Update check results:');
	console.log(`- Current version: ${updateInfo2.currentVersion}`);
	console.log(`- Latest version: ${updateInfo2.latestVersion}`);
	console.log(`- Update needed: ${updateInfo2.needsUpdate}`);

	// Scenario 3: Development version (current newer than latest)
	console.log(
		'\n--- Scenario 3: Development version (Current: 0.9.30, Latest: 0.9.0) ---'
	);
	const updateInfo3 = await testCheckForUpdate('0.9.0');
	console.log('Update check results:');
	console.log(`- Current version: ${updateInfo3.currentVersion}`);
	console.log(`- Latest version: ${updateInfo3.latestVersion}`);
	console.log(`- Update needed: ${updateInfo3.needsUpdate}`);

	console.log('\n=== Test complete ===');
}

// Run all tests
runTest();
