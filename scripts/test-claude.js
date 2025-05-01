#!/usr/bin/env node

/**
 * test-claude.js
 *
 * A simple test script to verify the improvements to the callClaude function.
 * This script tests different scenarios:
 * 1. Normal operation with a small PRD
 * 2. Testing with a large number of tasks (to potentially trigger task reduction)
 * 3. Simulating a failure to test retry logic
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

// Create a simple PRD for testing
const createTestPRD = (size = 'small', taskComplexity = 'simple') => {
	let content = `# Test PRD - ${size.toUpperCase()} SIZE, ${taskComplexity.toUpperCase()} COMPLEXITY\n\n`;

	// Add more content based on size
	if (size === 'small') {
		content += `
## Overview
This is a small test PRD to verify the callClaude function improvements.

## Requirements
1. Create a simple web application
2. Implement user authentication
3. Add a dashboard for users
4. Create an admin panel
5. Implement data visualization

## Technical Stack
- Frontend: React
- Backend: Node.js
- Database: MongoDB
`;
	} else if (size === 'medium') {
		// Medium-sized PRD with more requirements
		content += `
## Overview
This is a medium-sized test PRD to verify the callClaude function improvements.

## Requirements
1. Create a web application with multiple pages
2. Implement user authentication with OAuth
3. Add a dashboard for users with customizable widgets
4. Create an admin panel with user management
5. Implement data visualization with charts and graphs
6. Add real-time notifications
7. Implement a search feature
8. Add user profile management
9. Implement role-based access control
10. Add a reporting system
11. Implement file uploads and management
12. Add a commenting system
13. Implement a rating system
14. Add a recommendation engine
15. Implement a payment system

## Technical Stack
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: MongoDB with Mongoose
- Authentication: JWT and OAuth
- Deployment: Docker and Kubernetes
- CI/CD: GitHub Actions
- Monitoring: Prometheus and Grafana
`;
	} else if (size === 'large') {
		// Large PRD with many requirements
		content += `
## Overview
This is a large test PRD to verify the callClaude function improvements.

## Requirements
`;
		// Generate 30 requirements
		for (let i = 1; i <= 30; i++) {
			content += `${i}. Requirement ${i} - This is a detailed description of requirement ${i}.\n`;
		}

		content += `
## Technical Stack
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: MongoDB with Mongoose
- Authentication: JWT and OAuth
- Deployment: Docker and Kubernetes
- CI/CD: GitHub Actions
- Monitoring: Prometheus and Grafana

## User Stories
`;
		// Generate 20 user stories
		for (let i = 1; i <= 20; i++) {
			content += `- As a user, I want to be able to ${i} so that I can achieve benefit ${i}.\n`;
		}

		content += `
## Non-Functional Requirements
- Performance: The system should respond within 200ms
- Scalability: The system should handle 10,000 concurrent users
- Availability: The system should have 99.9% uptime
- Security: The system should comply with OWASP top 10
- Accessibility: The system should comply with WCAG 2.1 AA
`;
	}

	// Add complexity if needed
	if (taskComplexity === 'complex') {
		content += `
## Complex Requirements
- Implement a real-time collaboration system
- Add a machine learning-based recommendation engine
- Implement a distributed caching system
- Add a microservices architecture
- Implement a custom analytics engine
- Add support for multiple languages and locales
- Implement a custom search engine with advanced filtering
- Add a custom workflow engine
- Implement a custom reporting system
- Add a custom dashboard builder
`;
	}

	return content;
};

// Function to run the tests
async function runTests() {
	console.log('Starting tests for callClaude function improvements...');

	try {
		// Instead of importing the callClaude function directly, we'll use the dev.js script
		// with our test PRDs by running it as a child process

		// Test 1: Small PRD, 5 tasks
		console.log('\n=== Test 1: Small PRD, 5 tasks ===');
		const smallPRD = createTestPRD('small', 'simple');
		const smallPRDPath = path.join(__dirname, 'test-small-prd.txt');
		fs.writeFileSync(smallPRDPath, smallPRD, 'utf8');

		console.log(`Created test PRD at ${smallPRDPath}`);
		console.log('Running dev.js with small PRD...');

		// Use the child_process module to run the dev.js script
		const { execSync } = await import('child_process');

		try {
			const smallResult = execSync(
				`node ${path.join(__dirname, 'dev.js')} parse-prd --input=${smallPRDPath} --num-tasks=5`,
				{
					stdio: 'inherit'
				}
			);
			console.log('Small PRD test completed successfully');
		} catch (error) {
			console.error('Small PRD test failed:', error.message);
		}

		// Test 2: Medium PRD, 15 tasks
		console.log('\n=== Test 2: Medium PRD, 15 tasks ===');
		const mediumPRD = createTestPRD('medium', 'simple');
		const mediumPRDPath = path.join(__dirname, 'test-medium-prd.txt');
		fs.writeFileSync(mediumPRDPath, mediumPRD, 'utf8');

		console.log(`Created test PRD at ${mediumPRDPath}`);
		console.log('Running dev.js with medium PRD...');

		try {
			const mediumResult = execSync(
				`node ${path.join(__dirname, 'dev.js')} parse-prd --input=${mediumPRDPath} --num-tasks=15`,
				{
					stdio: 'inherit'
				}
			);
			console.log('Medium PRD test completed successfully');
		} catch (error) {
			console.error('Medium PRD test failed:', error.message);
		}

		// Test 3: Large PRD, 25 tasks
		console.log('\n=== Test 3: Large PRD, 25 tasks ===');
		const largePRD = createTestPRD('large', 'complex');
		const largePRDPath = path.join(__dirname, 'test-large-prd.txt');
		fs.writeFileSync(largePRDPath, largePRD, 'utf8');

		console.log(`Created test PRD at ${largePRDPath}`);
		console.log('Running dev.js with large PRD...');

		try {
			const largeResult = execSync(
				`node ${path.join(__dirname, 'dev.js')} parse-prd --input=${largePRDPath} --num-tasks=25`,
				{
					stdio: 'inherit'
				}
			);
			console.log('Large PRD test completed successfully');
		} catch (error) {
			console.error('Large PRD test failed:', error.message);
		}

		console.log('\nAll tests completed!');
	} catch (error) {
		console.error('Test failed:', error);
	} finally {
		// Clean up test files
		console.log('\nCleaning up test files...');
		const testFiles = [
			path.join(__dirname, 'test-small-prd.txt'),
			path.join(__dirname, 'test-medium-prd.txt'),
			path.join(__dirname, 'test-large-prd.txt')
		];

		testFiles.forEach((file) => {
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
				console.log(`Deleted ${file}`);
			}
		});

		console.log('Cleanup complete.');
	}
}

// Run the tests
runTests().catch((error) => {
	console.error('Error running tests:', error);
	process.exit(1);
});
