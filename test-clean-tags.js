import fs from 'fs';
import {
	createTag,
	listTags
} from './scripts/modules/task-manager/tag-management.js';

console.log('=== Testing Tag Management with Clean File ===');

// Create a clean test tasks.json file
const testTasksPath = './test-tasks.json';
const cleanData = {
	master: {
		tasks: [
			{ id: 1, title: 'Test Task 1', status: 'pending' },
			{ id: 2, title: 'Test Task 2', status: 'done' }
		],
		metadata: {
			created: new Date().toISOString(),
			description: 'Master tag'
		}
	}
};

// Write clean test file
fs.writeFileSync(testTasksPath, JSON.stringify(cleanData, null, 2));
console.log('Created clean test file');

try {
	// Test creating a new tag
	console.log('\n--- Testing createTag ---');
	await createTag(
		testTasksPath,
		'test-branch',
		{ copyFromCurrent: true, description: 'Test branch' },
		{ projectRoot: process.cwd() },
		'json'
	);

	// Read the file and check for corruption
	const resultData = JSON.parse(fs.readFileSync(testTasksPath, 'utf8'));
	console.log('Keys in result file:', Object.keys(resultData));
	console.log('Has _rawTaggedData in file:', !!resultData._rawTaggedData);

	if (resultData._rawTaggedData) {
		console.log('❌ CORRUPTION DETECTED: _rawTaggedData found in file!');
	} else {
		console.log('✅ SUCCESS: No _rawTaggedData corruption in file');
	}

	// Test listing tags
	console.log('\n--- Testing listTags ---');
	const tagList = await listTags(
		testTasksPath,
		{},
		{ projectRoot: process.cwd() },
		'json'
	);
	console.log(
		'Found tags:',
		tagList.tags.map((t) => t.name)
	);
} catch (error) {
	console.error('Error during test:', error.message);
} finally {
	// Clean up test file
	if (fs.existsSync(testTasksPath)) {
		fs.unlinkSync(testTasksPath);
		console.log('\nCleaned up test file');
	}
}
