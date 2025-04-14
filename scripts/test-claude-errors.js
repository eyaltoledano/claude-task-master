#!/usr/bin/env node

/**
 * test-claude-errors.js
 *
 * A test script to verify the error handling and retry logic in the callClaude function.
 * This script creates a modified version of dev.js that simulates different error scenarios.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Create a simple PRD for testing
const createTestPRD = () => {
	return `# Test PRD for Error Handling

## Overview
This is a simple test PRD to verify the error handling in the callClaude function.

## Requirements
1. Create a simple web application
2. Implement user authentication
3. Add a dashboard for users
`;
};

// Create a modified version of dev.js that simulates errors
function createErrorSimulationScript(errorType, failureCount = 2) {
	// Read the original dev.js file
	const devJsPath = path.join(__dirname, 'dev.js');
	const devJsContent = fs.readFileSync(devJsPath, 'utf8');

	// Create a modified version that simulates errors
	let modifiedContent = devJsContent;

	// Find the anthropic.messages.create call and replace it with our mock
	const anthropicCallRegex =
		/const response = await anthropic\.messages\.create\(/;

	let mockCode = '';

	switch (errorType) {
		case 'network':
			mockCode = `
      // Mock for network error simulation
      let currentAttempt = 0;
      const failureCount = ${failureCount};
      
      // Simulate network error for the first few attempts
      currentAttempt++;
      console.log(\`[Mock] API call attempt \${currentAttempt}\`);
      
      if (currentAttempt <= failureCount) {
        console.log(\`[Mock] Simulating network error (attempt \${currentAttempt}/\${failureCount})\`);
        throw new Error('Network error: Connection refused');
      }
      
      const response = await anthropic.messages.create(`;
			break;

		case 'timeout':
			mockCode = `
      // Mock for timeout error simulation
      let currentAttempt = 0;
      const failureCount = ${failureCount};
      
      // Simulate timeout error for the first few attempts
      currentAttempt++;
      console.log(\`[Mock] API call attempt \${currentAttempt}\`);
      
      if (currentAttempt <= failureCount) {
        console.log(\`[Mock] Simulating timeout error (attempt \${currentAttempt}/\${failureCount})\`);
        throw new Error('Request timed out after 60000ms');
      }
      
      const response = await anthropic.messages.create(`;
			break;

		case 'invalid-json':
			mockCode = `
      // Mock for invalid JSON response
      let currentAttempt = 0;
      const failureCount = ${failureCount};
      
      // Simulate invalid JSON for the first few attempts
      currentAttempt++;
      console.log(\`[Mock] API call attempt \${currentAttempt}\`);
      
      if (currentAttempt <= failureCount) {
        console.log(\`[Mock] Simulating invalid JSON response (attempt \${currentAttempt}/\${failureCount})\`);
        return {
          content: [
            {
              text: \`\`\`json\\n{"meta": {"projectName": "Test Project"}, "tasks": [{"id": 1, "title": "Task 1"\`
            }
          ]
        };
      }
      
      const response = await anthropic.messages.create(`;
			break;

		case 'empty-tasks':
			mockCode = `
      // Mock for empty tasks array
      let currentAttempt = 0;
      const failureCount = ${failureCount};
      
      // Simulate empty tasks array for the first few attempts
      currentAttempt++;
      console.log(\`[Mock] API call attempt \${currentAttempt}\`);
      
      if (currentAttempt <= failureCount) {
        console.log(\`[Mock] Simulating empty tasks array (attempt \${currentAttempt}/\${failureCount})\`);
        return {
          content: [
            {
              text: \`\`\`json\\n{"meta": {"projectName": "Test Project"}, "tasks": []}\\n\`\`\`
            }
          ]
        };
      }
      
      const response = await anthropic.messages.create(`;
			break;

		default:
			// No modification
			mockCode = `const response = await anthropic.messages.create(`;
	}

	// Replace the anthropic call with our mock
	modifiedContent = modifiedContent.replace(anthropicCallRegex, mockCode);

	// Write the modified script to a temporary file
	const tempScriptPath = path.join(__dirname, `temp-dev-${errorType}.js`);
	fs.writeFileSync(tempScriptPath, modifiedContent, 'utf8');

	return tempScriptPath;
}

// Function to run a test with a specific error type
async function runErrorTest(errorType, numTasks = 5, failureCount = 2) {
	console.log(`\n=== Test: ${errorType.toUpperCase()} Error Simulation ===`);

	// Create a test PRD
	const testPRD = createTestPRD();
	const testPRDPath = path.join(__dirname, `test-prd-${errorType}.txt`);
	fs.writeFileSync(testPRDPath, testPRD, 'utf8');

	// Create a modified dev.js that simulates the specified error
	const tempScriptPath = createErrorSimulationScript(errorType, failureCount);

	console.log(`Created test PRD at ${testPRDPath}`);
	console.log(`Created error simulation script at ${tempScriptPath}`);
	console.log(
		`Running with error type: ${errorType}, failure count: ${failureCount}, tasks: ${numTasks}`
	);

	try {
		// Run the modified script
		execSync(
			`node ${tempScriptPath} parse-prd --input=${testPRDPath} --tasks=${numTasks}`,
			{
				stdio: 'inherit'
			}
		);
		console.log(`${errorType} error test completed successfully`);
	} catch (error) {
		console.error(`${errorType} error test failed:`, error.message);
	} finally {
		// Clean up temporary files
		if (fs.existsSync(tempScriptPath)) {
			fs.unlinkSync(tempScriptPath);
		}
		if (fs.existsSync(testPRDPath)) {
			fs.unlinkSync(testPRDPath);
		}
	}
}

// Function to run all error tests
async function runAllErrorTests() {
	console.log('Starting error handling tests for callClaude function...');

	// Test 1: Network error with automatic retry
	await runErrorTest('network', 5, 2);

	// Test 2: Timeout error with automatic retry
	await runErrorTest('timeout', 5, 2);

	// Test 3: Invalid JSON response with task reduction
	await runErrorTest('invalid-json', 10, 2);

	// Test 4: Empty tasks array with task reduction
	await runErrorTest('empty-tasks', 15, 2);

	// Test 5: Exhausted retries (more failures than MAX_RETRIES)
	await runErrorTest('network', 5, 4);

	console.log('\nAll error tests completed!');
}

// Run the tests
runAllErrorTests().catch((error) => {
	console.error('Error running tests:', error);
	process.exit(1);
});
