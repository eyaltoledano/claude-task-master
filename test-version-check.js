import {
	displayUpgradeNotification,
	compareVersions
} from './scripts/modules/commands.js';

// Simulate different version scenarios
console.log('=== Simulating version check ===\n');

// 1. Current version is older than latest (should show update notice)
console.log('Scenario 1: Current version older than latest');
displayUpgradeNotification('0.9.30', '1.0.0');

// 2. Current version same as latest (no update needed)
console.log(
	'\nScenario 2: Current version same as latest (this would not normally show a notice)'
);
console.log('Current: 1.0.0, Latest: 1.0.0');
console.log('compareVersions result:', compareVersions('1.0.0', '1.0.0'));
console.log(
	'Update needed:',
	compareVersions('1.0.0', '1.0.0') < 0 ? 'Yes' : 'No'
);

// 3. Current version newer than latest (e.g., development version, would not show notice)
console.log(
	'\nScenario 3: Current version newer than latest (this would not normally show a notice)'
);
console.log('Current: 1.1.0, Latest: 1.0.0');
console.log('compareVersions result:', compareVersions('1.1.0', '1.0.0'));
console.log(
	'Update needed:',
	compareVersions('1.1.0', '1.0.0') < 0 ? 'Yes' : 'No'
);

console.log('\n=== Test complete ===');
