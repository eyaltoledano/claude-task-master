#!/usr/bin/env node

/**
 * Task Master Prompt Template Testing Tool
 *
 * Interactive menu system for testing prompt templates with realistic data.
 * Tests all 8 prompt templates with multiple variants and error conditions.
 *
 * Usage:
 *   node prompt-test.js              # Interactive menu
 *   node prompt-test.js --batch      # Run all tests
 *   node prompt-test.js --full       # Run all tests with full prompts
 *   node prompt-test.js --help       # Show help
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

// Get project root and import prompt manager
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

// Import prompt manager
import { getPromptManager } from '../../../scripts/modules/prompt-manager.js';
const promptManager = getPromptManager();

// ANSI color codes for better output formatting
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m'
};

// Test data for all prompt templates
const sampleData = {
	'add-task': {
		scenarios: [
			{
				name: 'Basic Task Creation',
				params: {
					prompt: 'Implement user authentication with JWT tokens',
					newTaskId: 15,
					existingTasks: [
						{ id: 1, title: 'Setup Express Server', status: 'done' },
						{ id: 2, title: 'Setup Database Connection', status: 'done' },
						{ id: 14, title: 'Create User Model', status: 'pending' }
					],
					gatheredContext:
						'Project uses Express.js, MongoDB, and has existing user registration functionality.',
					contextFromArgs:
						'Use bcrypt for password hashing and jsonwebtoken library.',
					priority: 'high',
					dependencies: [1, 2],
					useResearch: false
				},
				variants: ['default']
			},
			{
				name: 'Research-Enhanced Task Creation',
				params: {
					prompt: 'Implement real-time chat feature with WebSockets',
					newTaskId: 20,
					existingTasks: [
						{ id: 1, title: 'Setup Express Server', status: 'done' },
						{ id: 18, title: 'User Authentication', status: 'done' }
					],
					gatheredContext: 'Node.js project with Socket.io already installed.',
					priority: 'medium',
					dependencies: [18],
					useResearch: true
				},
				variants: ['research']
			}
		]
	},
	'expand-task': {
		scenarios: [
			{
				name: 'Basic Task Expansion',
				params: {
					task: {
						id: 8,
						title: 'Implement User Dashboard',
						description: 'Create a comprehensive user dashboard with analytics',
						details:
							'Dashboard should include user profile, activity history, and statistics.'
					},
					subtaskCount: 4,
					nextSubtaskId: 1,
					additionalContext:
						'Use React components and Chart.js for visualizations.',
					complexityReasoningContext: '',
					gatheredContext:
						'React application with existing user authentication and data models for user activities and preferences.',
					useResearch: false
				},
				variants: ['default']
			},
			{
				name: 'Research-Enhanced Expansion',
				params: {
					task: {
						id: 12,
						title: 'Implement Microservices Architecture',
						description: 'Refactor monolith to microservices',
						details:
							'Break down existing application into independently deployable services.'
					},
					subtaskCount: 6,
					nextSubtaskId: 1,
					additionalContext:
						'Current tech stack: Node.js, PostgreSQL, Redis. Consider Docker and Kubernetes.',
					complexityReasoningContext:
						'\nComplexity Analysis Reasoning: This task involves significant architectural changes requiring careful planning, service decomposition, data migration, and deployment orchestration.',
					gatheredContext:
						'Monolithic Express.js application with tightly coupled modules, shared database, and existing API contracts that need to be maintained during migration.',
					useResearch: true
				},
				variants: ['research']
			},
			{
				name: 'Complexity Report Driven',
				params: {
					task: {
						id: 15,
						title: 'Advanced Search Implementation',
						description: 'Implement full-text search with filters and sorting',
						details:
							'Search should include autocomplete, faceted search, and relevance scoring.'
					},
					subtaskCount: 5,
					nextSubtaskId: 1,
					additionalContext:
						'Existing data is in PostgreSQL. Consider Elasticsearch integration.',
					complexityReasoningContext:
						'\nComplexity Analysis Reasoning: High complexity due to search infrastructure requirements, indexing strategy design, query optimization needs, and performance considerations.',
					gatheredContext:
						'E-commerce application with product catalog, user reviews, and inventory data stored in PostgreSQL. Current simple search using LIKE queries is insufficient for growing data volume.',
					useResearch: false,
					expansionPrompt:
						'Break down this complex search implementation focusing on: 1) Search infrastructure setup, 2) Indexing strategy, 3) Query optimization, 4) User interface components, 5) Performance testing and monitoring.'
				},
				variants: ['complexity-report']
			}
		]
	},
	'analyze-complexity': {
		scenarios: [
			{
				name: 'Standard Complexity Analysis',
				params: {
					tasks: [
						{
							id: 5,
							title: 'Implement Payment Processing',
							description:
								'Integrate Stripe payments with error handling and webhooks',
							details:
								'Need to handle multiple payment methods, subscription billing, and compliance.'
						},
						{
							id: 6,
							title: 'Add CSS Styling',
							description: 'Style the login form',
							details: 'Basic styling with CSS.'
						},
						{
							id: 7,
							title: 'Setup CI/CD Pipeline',
							description: 'Configure automated testing and deployment',
							details: 'Multi-environment deployment with Docker and AWS.'
						}
					],
					gatheredContext:
						'E-commerce project using Node.js, React, and AWS infrastructure.',
					threshold: 6,
					useResearch: false
				},
				variants: ['default']
			},
			{
				name: 'Research-Enhanced Complexity Analysis',
				params: {
					tasks: [
						{
							id: 10,
							title: 'Implement Microservices Architecture',
							description:
								'Refactor monolith to microservices using latest patterns',
							details:
								'Break down existing application into independently deployable services following current industry standards.'
						},
						{
							id: 11,
							title: 'AI-Powered Search Integration',
							description: 'Implement semantic search with AI/ML capabilities',
							details:
								'Modern search implementation using vector databases and LLM integration.'
						}
					],
					gatheredContext:
						'Modern web application requiring scalable architecture and AI integration.',
					threshold: 7,
					useResearch: true,
					testName: 'research'
				},
				variants: ['research']
			}
		]
	},
	research: {
		scenarios: [
			{
				name: 'Default Research Query',
				params: {
					query:
						'What are the latest trends in full-stack JavaScript development?',
					gatheredContext:
						'MERN stack application with microservices architecture. Looking to modernize tech stack.',
					detailLevel: 'medium',
					projectInfo: {
						root: '/project',
						taskCount: 25,
						fileCount: 80
					}
				},
				variants: ['default']
			},
			{
				name: 'Low Detail Research',
				params: {
					query:
						'What are the best practices for implementing JWT authentication in Node.js?',
					gatheredContext:
						'Express.js application with existing user registration. Using bcrypt for passwords.',
					detailLevel: 'low',
					projectInfo: {
						root: '/project',
						taskCount: 15,
						fileCount: 45
					}
				},
				variants: ['low']
			},
			{
				name: 'Medium Detail Research',
				params: {
					query:
						'How to implement real-time notifications in a React application?',
					gatheredContext:
						'React frontend with Redux state management. Backend uses Socket.io and Redis.',
					detailLevel: 'medium',
					projectInfo: {
						root: '/project',
						taskCount: 20,
						fileCount: 67
					}
				},
				variants: ['medium']
			},
			{
				name: 'High Detail Research',
				params: {
					query: 'Best architecture patterns for microservices with Node.js?',
					gatheredContext:
						'Monolithic Express application being refactored. Uses PostgreSQL, Redis, and AWS infrastructure.',
					detailLevel: 'high',
					projectInfo: {
						root: '/project',
						taskCount: 35,
						fileCount: 120
					}
				},
				variants: ['high']
			}
		]
	},
	'parse-prd': {
		scenarios: [
			{
				name: 'Standard PRD Parsing',
				params: {
					prdContent: `# Social Media Dashboard

## Overview
Create a comprehensive social media management dashboard that allows users to manage multiple social platforms from a single interface.

## Features
1. Multi-platform integration (Twitter, Facebook, Instagram)
2. Post scheduling and automation
3. Analytics and reporting
4. Team collaboration features
5. Content calendar view

## Technical Requirements
- React frontend with TypeScript
- Node.js backend with Express
- PostgreSQL database
- Redis for caching
- AWS deployment

## Success Metrics
- Support for 3 social platforms
- Handle 10,000+ scheduled posts
- 99.9% uptime requirement`,
					numTasks: 8,
					nextId: 1,
					prdPath: 'social-media-dashboard-prd.txt',
					defaultTaskPriority: 'medium',
					research: false
				},
				variants: ['default']
			},
			{
				name: 'Research-Enhanced PRD Parsing',
				params: {
					prdContent: `# AI-Powered E-commerce Platform

## Overview
Build a next-generation e-commerce platform with AI-driven recommendations, voice search, and predictive analytics.

## Core Features
1. AI product recommendations using machine learning
2. Voice search integration with natural language processing
3. Predictive inventory management
4. Real-time fraud detection
5. Automated customer service chatbot

## Technical Requirements
- Modern JavaScript framework (latest best practices)
- Cloud-native architecture with microservices
- AI/ML integration for recommendations and analytics
- Real-time data processing pipeline
- Enterprise-grade security and compliance

## Performance Goals
- Sub-200ms API response times
- Support for 1M+ concurrent users
- 99.99% uptime SLA
- Global CDN distribution`,
					numTasks: 10,
					nextId: 1,
					prdPath: 'ai-ecommerce-prd.txt',
					defaultTaskPriority: 'high',
					research: true
				},
				variants: ['research']
			}
		]
	},
	'update-subtask': {
		scenarios: [
			{
				name: 'Implementation Progress Update',
				params: {
					parentTask: {
						id: 8,
						title: 'Implement User Authentication',
						description: 'Build complete authentication system with JWT',
						status: 'in-progress'
					},
					currentDetails:
						'Implement JWT authentication middleware with token validation and refresh capabilities.',
					updatePrompt:
						'Made significant progress on the authentication middleware. Successfully implemented JWT token validation and user session management. Encountered issue with token refresh mechanism - tokens were expiring too quickly. Modified the refresh logic to use sliding expiration. All tests are now passing.',
					useResearch: false,
					gatheredContext:
						'Project uses Express.js and MongoDB for user data storage.'
				},
				variants: ['default']
			},
			{
				name: 'Research-Enhanced Update',
				params: {
					parentTask: {
						id: 12,
						title: 'Implement OAuth Integration',
						description: 'Add OAuth 2.0 support for third-party login',
						status: 'in-progress'
					},
					currentDetails:
						'Implement OAuth 2.0 authentication flow with proper security measures.',
					updatePrompt:
						'Researched latest OAuth 2.0 security best practices. Found vulnerability in current implementation regarding PKCE. Need to implement state parameter validation and secure code exchange. Updated implementation to follow RFC 7636 recommendations.',
					useResearch: true,
					gatheredContext:
						'Security is critical for this project. Need to follow industry standards.'
				},
				variants: ['research']
			}
		]
	},
	'update-task': {
		scenarios: [
			{
				name: 'Task Details Update',
				params: {
					task: {
						id: 10,
						title: 'Implement Payment Processing',
						description: 'Integrate Stripe payment processing',
						details: 'Basic Stripe integration with credit card processing.',
						status: 'pending'
					},
					taskJson:
						'{"id": 10, "title": "Implement Payment Processing", "description": "Integrate Stripe payment processing", "details": "Basic Stripe integration with credit card processing.", "status": "pending", "dependencies": [], "priority": "high"}',
					updatePrompt:
						'After reviewing the current codebase, the payment integration needs to support additional payment methods beyond Stripe. Add support for PayPal and Apple Pay. Also need to implement webhook security validation and transaction logging for compliance.',
					useResearch: false,
					gatheredContext:
						'E-commerce platform with existing user accounts and shopping cart functionality.'
				},
				variants: ['default']
			},
			{
				name: 'Append Mode Update',
				params: {
					task: {
						id: 15,
						title: 'Database Migration System',
						description: 'Implement automated database schema migrations',
						details:
							'Create migration scripts for PostgreSQL schema updates with rollback capabilities.',
						status: 'in-progress'
					},
					taskJson:
						'{"id": 15, "title": "Database Migration System", "description": "Implement automated database schema migrations", "details": "Create migration scripts for PostgreSQL schema updates with rollback capabilities.", "status": "in-progress", "dependencies": [], "priority": "high"}',
					currentDetails:
						'Create migration scripts for PostgreSQL schema updates with rollback capabilities.',
					updatePrompt:
						'Discovered additional requirement for zero-downtime migrations. Research shows we need to implement blue-green deployment strategy with gradual schema changes. Added connection pooling considerations and automated testing for migration validation.',
					appendMode: true,
					useResearch: false,
					gatheredContext:
						'Production database with strict uptime requirements and high transaction volume.'
				},
				variants: ['append']
			},
			{
				name: 'Research-Enhanced Task Update',
				params: {
					task: {
						id: 12,
						title: 'Payment Security Compliance',
						description: 'Ensure payment processing meets security standards',
						details:
							'Implement basic security measures for payment processing.',
						status: 'in-progress'
					},
					taskJson:
						'{"id": 12, "title": "Payment Security Compliance", "description": "Ensure payment processing meets security standards", "details": "Implement basic security measures for payment processing.", "status": "in-progress", "dependencies": [10], "priority": "high"}',
					updatePrompt:
						'Need to incorporate latest PCI DSS 4.0 compliance requirements and implement Strong Customer Authentication (SCA) for European markets. Research shows new requirements for biometric authentication and dynamic linking.',
					useResearch: true,
					gatheredContext:
						'Security compliance is critical for international payment processing.'
				},
				variants: ['research']
			}
		]
	},
	'update-tasks': {
		scenarios: [
			{
				name: 'Bulk Task Updates',
				params: {
					tasks: [
						{
							id: 5,
							title: 'User API Endpoints',
							description: 'Create REST endpoints for user operations',
							status: 'pending',
							dependencies: [],
							priority: 'high'
						},
						{
							id: 6,
							title: 'Product API Integration',
							description: 'Integrate with product REST API',
							status: 'in-progress',
							dependencies: [5],
							priority: 'medium'
						},
						{
							id: 7,
							title: 'Authentication API',
							description: 'Implement REST-based auth API',
							status: 'pending',
							dependencies: [],
							priority: 'high'
						}
					],
					updatePrompt:
						'Migration from REST API to GraphQL. All API-related tasks need to be updated to use GraphQL schemas, resolvers, and Apollo Client instead of traditional REST endpoints.',
					useResearch: false,
					projectContext:
						'Full-stack application migrating from REST to GraphQL for better data fetching.'
				},
				variants: ['default']
			}
		]
	}
};

// Interactive menu system
class PromptTestMenu {
	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		this.promptManager = getPromptManager();
		this.showFullPrompts = true;
	}

	async start() {
		console.log(
			`${colors.cyan}${colors.bright}=== Task Master Prompt Template Testing Menu ===${colors.reset}\n`
		);
		await this.showMainMenu();
	}

	async showMainMenu() {
		console.clear();
		console.log(
			`${colors.cyan}=== Task Master Prompt Template Testing Menu ===${colors.reset}\n`
		);

		console.log('Main Menu:');
		console.log('  1. Test specific prompt template');
		console.log('  2. Run all tests');
		console.log(
			`  3. Toggle full prompt display (currently: ${this.showFullPrompts ? 'ON' : 'OFF'})`
		);
		console.log('  4. Generate HTML report');
		console.log('  5. Exit');

		const choice = await this.getInput('\nSelect an option (1-5): ');

		switch (choice) {
			case '1':
				await this.showTemplateMenu();
				break;
			case '2':
				await this.runAllTests();
				break;
			case '3':
				this.showFullPrompts = !this.showFullPrompts;
				console.log(
					`${colors.green}Full prompt display ${this.showFullPrompts ? 'enabled' : 'disabled'}${colors.reset}`
				);
				await this.waitForEnter();
				await this.showMainMenu();
				break;
			case '4':
				await this.generateHTMLReport();
				break;
			case '5':
				console.log('Goodbye!');
				this.rl.close();
				return;
			default:
				console.log(
					`${colors.red}Invalid option. Please try again.${colors.reset}`
				);
				await this.waitForEnter();
				await this.showMainMenu();
		}
	}

	async showTemplateMenu() {
		const templates = [
			{ key: 'add-task', name: 'Add Task', variants: ['default', 'research'] },
			{
				key: 'expand-task',
				name: 'Expand Task',
				variants: ['default', 'research', 'complexity-report']
			},
			{
				key: 'analyze-complexity',
				name: 'Analyze Complexity',
				variants: ['default', 'research']
			},
			{
				key: 'research',
				name: 'Research',
				variants: ['default', 'low', 'medium', 'high']
			},
			{
				key: 'parse-prd',
				name: 'Parse PRD',
				variants: ['default', 'research']
			},
			{
				key: 'update-subtask',
				name: 'Update Subtask',
				variants: ['default', 'research']
			},
			{
				key: 'update-task',
				name: 'Update Task',
				variants: ['default', 'append', 'research']
			},
			{
				key: 'update-tasks',
				name: 'Update Tasks',
				variants: ['default']
			}
		];

		console.log(
			`${colors.bright}Select a prompt template to test:${colors.reset}`
		);
		templates.forEach((template, index) => {
			console.log(
				`  ${index + 1}. ${template.name} (${template.variants.join(', ')})`
			);
		});
		console.log(`  ${templates.length + 1}. Back to main menu`);
		console.log();

		const choice = await this.prompt(
			`Select template (1-${templates.length + 1}): `
		);
		const choiceNum = parseInt(choice.trim());

		if (choiceNum >= 1 && choiceNum <= templates.length) {
			const selectedTemplate = templates[choiceNum - 1];
			await this.showVariantMenu(selectedTemplate);
		} else if (choiceNum === templates.length + 1) {
			await this.showMainMenu();
		} else {
			console.log(
				`${colors.red}Invalid option. Please try again.${colors.reset}\n`
			);
			await this.showTemplateMenu();
		}
	}

	async showVariantMenu(template) {
		console.log(
			`${colors.bright}${template.name} - Select variant:${colors.reset}`
		);
		template.variants.forEach((variant, index) => {
			console.log(`  ${index + 1}. ${variant}`);
		});
		console.log(`  ${template.variants.length + 1}. Test all variants`);
		console.log(`  ${template.variants.length + 2}. Back to template menu`);
		console.log();

		const choice = await this.prompt(
			`Select variant (1-${template.variants.length + 2}): `
		);
		const choiceNum = parseInt(choice.trim());

		if (choiceNum >= 1 && choiceNum <= template.variants.length) {
			const selectedVariant = template.variants[choiceNum - 1];
			await this.runSingleTest(template.key, selectedVariant);
		} else if (choiceNum === template.variants.length + 1) {
			console.log(
				`${colors.cyan}Testing all variants for ${template.name}...${colors.reset}\n`
			);
			for (const variant of template.variants) {
				await this.runSingleTest(template.key, variant);
				console.log(); // Extra spacing between variants
			}
		} else if (choiceNum === template.variants.length + 2) {
			await this.showTemplateMenu();
		} else {
			console.log(
				`${colors.red}Invalid option. Please try again.${colors.reset}\n`
			);
			await this.showVariantMenu(template);
		}

		// After running test(s), show options to continue
		await this.showPostTestMenu(template);
	}

	async showPostTestMenu(template) {
		console.log(
			`${colors.bright}What would you like to do next?${colors.reset}`
		);
		console.log('  1. Test another variant of this template');
		console.log('  2. Choose a different template');
		console.log('  3. Back to main menu');
		console.log();

		const choice = await this.prompt('Select option (1-3): ');

		switch (choice.trim()) {
			case '1':
				await this.showVariantMenu(template);
				break;
			case '2':
				await this.showTemplateMenu();
				break;
			case '3':
				await this.showMainMenu();
				break;
			default:
				console.log(
					`${colors.red}Invalid option. Please try again.${colors.reset}\n`
				);
				await this.showPostTestMenu(template);
		}
	}

	async runSingleTest(templateKey, variant) {
		console.log(
			`${colors.magenta}${colors.bright}Testing ${templateKey} - ${variant} variant${colors.reset}`
		);
		console.log('='.repeat(60));

		try {
			// Handle special research mode variants
			let actualVariant = variant;
			let useResearch = false;
			let research = false;
			let detailLevel = null;
			if (
				(templateKey === 'add-task' ||
					templateKey === 'analyze-complexity' ||
					templateKey === 'update-subtask' ||
					templateKey === 'update-task' ||
					templateKey === 'update-tasks') &&
				variant === 'research'
			) {
				actualVariant = 'default';
				useResearch = true;
			}
			if (templateKey === 'parse-prd' && variant === 'research') {
				actualVariant = 'default';
				research = true;
			}
			if (
				templateKey === 'research' &&
				['low', 'medium', 'high'].includes(variant)
			) {
				actualVariant = 'default';
				detailLevel = variant;
			}

			const testData = getTestDataForTemplate(templateKey, actualVariant);

			// Override useResearch, research, or detailLevel if needed
			if (useResearch) {
				testData.params.useResearch = true;
			}
			if (research) {
				testData.params.research = true;
			}
			if (detailLevel) {
				testData.params.detailLevel = detailLevel;
			}

			const result = await this.promptManager.loadPrompt(
				templateKey,
				testData.params,
				templateVariant
			);

			console.log(
				`${colors.green}✓ SUCCESS${colors.reset} - Template loaded and processed successfully`
			);
			console.log(`${colors.bright}Parameters used:${colors.reset}`);
			console.log(JSON.stringify(testData.params, null, 2));

			if (this.showFullPrompts) {
				console.log(`\n${colors.bright}System Prompt:${colors.reset}`);
				console.log('-'.repeat(40));
				console.log(result.systemPrompt);

				console.log(`\n${colors.bright}User Prompt:${colors.reset}`);
				console.log('-'.repeat(40));
				console.log(result.userPrompt);
			} else {
				console.log(`\n${colors.bright}System Prompt Preview:${colors.reset}`);
				console.log(result.systemPrompt.substring(0, 200) + '...');

				console.log(`\n${colors.bright}User Prompt Preview:${colors.reset}`);
				console.log(result.userPrompt.substring(0, 200) + '...');

				console.log(
					`\n${colors.yellow}Tip: Use option 3 in main menu to toggle full prompt display${colors.reset}`
				);
			}
		} catch (error) {
			console.log(`${colors.red}✗ FAILED${colors.reset} - ${error.message}`);
			if (error.stack) {
				console.log(`${colors.red}Stack trace:${colors.reset}`);
				console.log(error.stack);
			}
		}

		console.log('='.repeat(60));
	}

	async runAllTests() {
		console.log(
			`${colors.cyan}Running all comprehensive tests...${colors.reset}\n`
		);

		const results = await runComprehensiveTests(true);

		console.log(`\n${colors.bright}Test Results Summary:${colors.reset}`);
		console.log(`Total tests: ${results.total}`);
		console.log(`Passed: ${colors.green}${results.passed}${colors.reset}`);
		console.log(`Failed: ${colors.red}${results.failed}${colors.reset}`);

		if (results.failedTests.length > 0) {
			console.log(`\n${colors.red}Failed tests:${colors.reset}`);
			results.failedTests.forEach((test) => {
				console.log(`  - ${test.template} (${test.variant}): ${test.error}`);
			});
		}

		console.log();
		await this.prompt('Press Enter to continue...');
		await this.showMainMenu();
	}

	prompt(question) {
		return new Promise((resolve) => {
			this.rl.question(question, resolve);
		});
	}

	async getInput(question) {
		const answer = await this.prompt(question);
		return answer.trim();
	}

	async waitForEnter() {
		await this.prompt('Press Enter to continue...');
	}

	async generateHTMLReport() {
		const { filepath, results } = await generateAndSaveHTMLReport();
		await this.waitForEnter();
		await this.showMainMenu();
	}
}

// Helper function to get test data for a specific template and variant
function getTestDataForTemplate(templateKey, variant) {
	if (!sampleData[templateKey] || !sampleData[templateKey].scenarios) {
		return { name: 'Unknown Template', params: {} };
	}

	// Find appropriate scenario for this variant
	const scenario = sampleData[templateKey].scenarios.find((s) =>
		s.variants.includes(variant)
	);

	// If no scenario found for this variant, use the first scenario but mark it as a test case
	if (!scenario) {
		const firstScenario = sampleData[templateKey].scenarios[0];
		if (!firstScenario) {
			return { name: 'No Scenarios', params: {} };
		}
		return {
			name: `${firstScenario.name} (variant test)`,
			params: firstScenario.params
		};
	}

	return {
		name: scenario.name,
		params: scenario.params
	};
}

// Run all comprehensive tests
async function runComprehensiveTests(generateDetailed = false) {
	console.log('Task Master Prompt Template Comprehensive Test');
	console.log('=============================================\n');

	let passed = 0;
	let failed = 0;
	const failedTests = [];
	const detailedResults = [];

	// Test all combinations
	const testCases = [
		{ template: 'add-task', variant: 'default' },
		{
			template: 'add-task',
			variant: 'default',
			useResearch: true,
			testName: 'research'
		},
		{ template: 'expand-task', variant: 'default' },
		{ template: 'expand-task', variant: 'research' },
		{ template: 'expand-task', variant: 'complexity-report' },
		{ template: 'analyze-complexity', variant: 'default' },
		{
			template: 'analyze-complexity',
			variant: 'default',
			useResearch: true,
			testName: 'research'
		},
		{
			template: 'research',
			variant: 'default',
			detailLevel: 'low',
			testName: 'low'
		},
		{
			template: 'research',
			variant: 'default',
			detailLevel: 'medium',
			testName: 'medium'
		},
		{
			template: 'research',
			variant: 'default',
			detailLevel: 'high',
			testName: 'high'
		},
		{ template: 'parse-prd', variant: 'default' },
		{
			template: 'parse-prd',
			variant: 'default',
			research: true,
			testName: 'research'
		},
		{ template: 'update-subtask', variant: 'default' },
		{
			template: 'update-subtask',
			variant: 'default',
			useResearch: true,
			testName: 'research'
		},
		{ template: 'update-task', variant: 'default' },
		{ template: 'update-task', variant: 'append' },
		{
			template: 'update-task',
			variant: 'default',
			useResearch: true,
			testName: 'research'
		},
		{ template: 'update-tasks', variant: 'default' },

		// Conditional logic tests for new helper functions
		{
			template: 'parse-prd',
			variant: 'default',
			customData: {
				name: 'Test Zero Tasks Conditional Logic',
				params: {
					prdContent: 'Test PRD content for zero tasks validation',
					numTasks: 0,
					nextId: 1,
					prdPath: 'test-zero-tasks.txt',
					defaultTaskPriority: 'medium',
					research: false
				}
			},
			testName: 'conditional-zero-tasks',
			validateOutput: (result) => {
				return (
					result.systemPrompt.includes('an appropriate number of') &&
					!result.systemPrompt.includes('approximately 0')
				);
			}
		},
		{
			template: 'expand-task',
			variant: 'default',
			customData: {
				name: 'Test Zero Subtasks Conditional Logic',
				params: {
					task: {
						id: 99,
						title: 'Test Zero Subtasks Conditional',
						description: 'Test conditional logic with zero subtasks',
						details: 'Testing gt helper with zero value'
					},
					subtaskCount: 0,
					nextSubtaskId: 1,
					additionalContext: 'Testing conditional logic',
					complexityReasoningContext: '',
					gatheredContext: 'Test context'
				}
			},
			testName: 'conditional-zero-subtasks',
			validateOutput: (result) => {
				return (
					result.systemPrompt.includes('an appropriate number of') &&
					!result.systemPrompt.includes('0 specific subtasks')
				);
			}
		},
		{
			template: 'parse-prd',
			variant: 'default',
			customData: {
				name: 'Test Positive Tasks Conditional Logic',
				params: {
					prdContent: 'Test PRD content for positive tasks validation',
					numTasks: 5,
					nextId: 1,
					prdPath: 'test-positive-tasks.txt',
					defaultTaskPriority: 'medium',
					research: false
				}
			},
			testName: 'conditional-positive-tasks',
			validateOutput: (result) => {
				return (
					result.systemPrompt.includes('approximately 5') &&
					!result.systemPrompt.includes('an appropriate number of')
				);
			}
		},
		{
			template: 'expand-task',
			variant: 'default',
			customData: {
				name: 'Test Positive Subtasks Conditional Logic',
				params: {
					task: {
						id: 98,
						title: 'Test Positive Subtasks Conditional',
						description: 'Test conditional logic with positive subtasks',
						details: 'Testing gt helper with positive value'
					},
					subtaskCount: 3,
					nextSubtaskId: 1,
					additionalContext: 'Testing conditional logic',
					complexityReasoningContext: '',
					gatheredContext: 'Test context'
				}
			},
			testName: 'conditional-positive-subtasks',
			validateOutput: (result) => {
				return (
					result.systemPrompt.includes('3 specific subtasks') &&
					!result.systemPrompt.includes('an appropriate number of')
				);
			}
		},

		// Error condition tests
		{ template: 'expand-task', variant: 'nonexistent', expectError: true },
		{ template: 'nonexistent-template', variant: 'default', expectError: true },
		{
			template: 'parse-prd',
			variant: 'default',
			params: {},
			expectError: true
		},
		{
			template: 'add-task',
			variant: 'default',
			params: { prompt: '' },
			expectError: true
		},
		{
			template: 'research',
			variant: 'default',
			detailLevel: 'invalid-detail',
			expectError: true,
			testName: 'invalid-detail'
		}
	];

	for (const testCase of testCases) {
		try {
			// Handle variant conversion for comprehensive tests
			let scenarioVariant = testCase.variant;
			let templateVariant = testCase.variant;

			// For templates using detail levels, convert to default with detailLevel param
			if (
				testCase.template === 'research' &&
				['low', 'medium', 'high'].includes(testCase.variant)
			) {
				templateVariant = 'default';
			}

			// For consolidated templates, convert research variant to default for template loading only
			if (
				(testCase.template === 'add-task' ||
					testCase.template === 'analyze-complexity' ||
					testCase.template === 'update-subtask' ||
					testCase.template === 'update-task' ||
					testCase.template === 'parse-prd') &&
				testCase.variant === 'research'
			) {
				templateVariant = 'default';
			}

			// Get test data using scenario variant (research scenarios will be found correctly)
			const testData =
				testCase.customData ||
				(testCase.params
					? { name: 'Custom Test Data', params: testCase.params }
					: null) ||
				getTestDataForTemplate(testCase.template, scenarioVariant);

			// Override test data with custom parameters if specified
			if (testCase.useResearch !== undefined) {
				testData.params.useResearch = testCase.useResearch;
			}
			if (testCase.research !== undefined) {
				testData.params.research = testCase.research;
			}
			if (testCase.detailLevel !== undefined) {
				testData.params.detailLevel = testCase.detailLevel;
			}

			const result = await promptManager.loadPrompt(
				testCase.template,
				testData.params,
				templateVariant
			);

			const displayName = testCase.testName || testCase.variant;

			if (testCase.expectError) {
				console.log(
					`✗ FAILED - ${testCase.template} (${displayName}): Expected error but test passed`
				);
				failedTests.push({
					template: testCase.template,
					variant: displayName,
					error: 'Expected error but test passed'
				});
				failed++;

				if (generateDetailed) {
					detailedResults.push({
						template: testCase.template,
						variant: displayName,
						success: false,
						expectedError: true,
						error: 'Expected error but test passed'
					});
				}
			} else {
				// Check output validation if provided
				let validationPassed = true;
				let validationError = null;

				if (testCase.validateOutput) {
					try {
						validationPassed = testCase.validateOutput(result);
						if (!validationPassed) {
							validationError =
								'Output validation failed - conditional logic did not produce expected content';
						}
					} catch (error) {
						validationPassed = false;
						validationError = `Output validation error: ${error.message}`;
					}
				}

				if (validationPassed) {
					console.log(`✓ PASSED - ${testCase.template} (${displayName})`);
					passed++;

					if (generateDetailed) {
						detailedResults.push({
							template: testCase.template,
							variant: displayName,
							success: true,
							prompts: {
								systemPrompt: result.systemPrompt,
								userPrompt: result.userPrompt
							}
						});
					}
				} else {
					console.log(
						`✗ FAILED - ${testCase.template} (${displayName}): ${validationError}`
					);
					failedTests.push({
						template: testCase.template,
						variant: displayName,
						error: validationError
					});
					failed++;

					if (generateDetailed) {
						detailedResults.push({
							template: testCase.template,
							variant: displayName,
							success: false,
							error: validationError,
							prompts: {
								systemPrompt: result.systemPrompt,
								userPrompt: result.userPrompt
							}
						});
					}
				}
			}
		} catch (error) {
			const displayName = testCase.testName || testCase.variant;

			if (testCase.expectError) {
				console.log(
					`✓ PASSED - ${testCase.template} (${displayName}): Expected error occurred`
				);
				passed++;

				if (generateDetailed) {
					detailedResults.push({
						template: testCase.template,
						variant: displayName,
						success: true,
						expectedError: true,
						error: error.message
					});
				}
			} else {
				console.log(
					`✗ FAILED - ${testCase.template} (${displayName}): ${error.message}`
				);
				failedTests.push({
					template: testCase.template,
					variant: displayName,
					error: error.message
				});
				failed++;

				if (generateDetailed) {
					detailedResults.push({
						template: testCase.template,
						variant: displayName,
						success: false,
						error: error.message
					});
				}
			}
		}
	}

	const total = passed + failed;
	const results = { passed, failed, total, failedTests };

	if (generateDetailed) {
		results.detailedResults = detailedResults;
	}

	return results;
}

// Test a specific template and variant
async function testSpecificTemplate(
	templateKey,
	variant,
	showFullOutput = false
) {
	console.log(
		`${colors.cyan}Testing: ${templateKey} (${variant})${colors.reset}\n`
	);

	try {
		// Handle special research mode variants for template loading
		let actualVariant = variant;
		let detailLevel = null;

		// For templates with separate research scenarios, keep the research variant
		// For templates using detail levels, convert to default with detailLevel param
		if (
			templateKey === 'research' &&
			['low', 'medium', 'high'].includes(variant)
		) {
			actualVariant = 'default';
			detailLevel = variant;
		}

		// Get test data using the actual variant (research scenarios will be found)
		const testData = getTestDataForTemplate(templateKey, actualVariant);

		// For consolidated templates, convert research variant to default for template loading
		let templateVariant = actualVariant;
		if (
			(templateKey === 'add-task' ||
				templateKey === 'analyze-complexity' ||
				templateKey === 'update-subtask' ||
				templateKey === 'update-task' ||
				templateKey === 'parse-prd') &&
			variant === 'research'
		) {
			templateVariant = 'default';
		}

		// Override detailLevel if needed for research template
		if (detailLevel) {
			testData.params.detailLevel = detailLevel;
		}

		const result = await promptManager.loadPrompt(
			templateKey,
			testData.params,
			templateVariant
		);

		console.log(`${colors.green}✓ SUCCESS${colors.reset}\n`);
		console.log(`${colors.bright}Template:${colors.reset} ${templateKey}`);
		console.log(`${colors.bright}Variant:${colors.reset} ${variant}`);
		console.log(`${colors.bright}Test Data:${colors.reset} ${testData.name}\n`);

		if (showFullOutput) {
			console.log(`${colors.bright}=== SYSTEM PROMPT ===${colors.reset}`);
			console.log(result.systemPrompt);
			console.log(`\n${colors.bright}=== USER PROMPT ===${colors.reset}`);
			console.log(result.userPrompt);
		} else {
			console.log(`${colors.bright}System Prompt Preview:${colors.reset}`);
			console.log(result.systemPrompt.substring(0, 200) + '...');
			console.log(`\n${colors.bright}User Prompt Preview:${colors.reset}`);
			console.log(result.userPrompt.substring(0, 200) + '...');
		}
	} catch (error) {
		console.log(`${colors.red}✗ FAILED: ${error.message}${colors.reset}`);
		return false;
	}

	return true;
}

// Main execution
async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log(`Task Master Prompt Template Testing Tool

Usage:
  node prompt-test.js [options]

Options:
  --help, -h     Show this help message
  --full         Run all tests and show full prompts
  --batch        Run all tests in batch mode (non-interactive)
  --html         Generate HTML report and open in browser
  --test <template>:<variant>  Test specific template variant (e.g., --test add-task:default)

Interactive Mode:
  Run without arguments to start the interactive menu system.
  
Examples:
  node prompt-test.js              # Interactive menu
  node prompt-test.js --batch      # Run all tests
  node prompt-test.js --full       # Run all tests with full prompts
  node prompt-test.js --html       # Generate HTML report
  node prompt-test.js --test add-task:default  # Test specific template`);
		process.exit(0);
	}

	const showFullPrompts = args.includes('--full');
	const batchMode = args.includes('--batch');
	const htmlMode = args.includes('--html');
	const testArg = args.find((arg) => arg.startsWith('--test'));

	if (testArg) {
		let templateVariant;
		if (testArg.includes('=')) {
			// Handle --test=template:variant format
			templateVariant = testArg.split('=')[1];
		} else {
			// Handle --test template:variant format
			const testIndex = args.indexOf('--test');
			templateVariant = args[testIndex + 1];
		}

		if (!templateVariant) {
			console.error(
				'Usage: --test template:variant (e.g., --test add-task:default)'
			);
			process.exit(1);
		}
		const [templateKey, variant] = templateVariant.split(':');
		await testSpecificTemplate(templateKey, variant || 'default', true);
		process.exit(0);
	}

	if (htmlMode) {
		await generateAndSaveHTMLReport();
		process.exit(0);
	}

	if (batchMode) {
		const results = await runComprehensiveTests(true);
		console.log(`\nTest Results: ${results.passed}/${results.total} passed`);
		process.exit(results.failed > 0 ? 1 : 0);
	} else if (showFullPrompts) {
		// Legacy full test mode
		const results = await runComprehensiveTests(true);
		console.log(`\nTest Results: ${results.passed}/${results.total} passed`);

		// Show sample full prompts
		console.log('\n=== Sample Full Prompts ===\n');
		try {
			const promptManager = getPromptManager();
			const testData = getTestDataForTemplate('add-task', 'default');
			const result = await promptManager.loadPrompt(
				'add-task',
				testData.params,
				'default'
			);

			console.log('System Prompt (add-task, default):');
			console.log('-'.repeat(40));
			console.log(result.systemPrompt);

			console.log('\nUser Prompt (add-task, default):');
			console.log('-'.repeat(40));
			console.log(result.userPrompt);
		} catch (error) {
			console.log('Error showing sample prompts:', error.message);
		}
	} else {
		// Interactive mode
		const menu = new PromptTestMenu();
		await menu.start();
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}

export { runComprehensiveTests, getTestDataForTemplate };

// HTML report generation
function generateHTMLReport(testResults, templateResults = []) {
	const timestamp = new Date().toISOString();
	const passed = testResults.passed;
	const total = testResults.total;
	const failed = testResults.failed;

	// Helper function to generate consistent anchor IDs
	function generateAnchorId(template, variant) {
		return `test-${template.replace(/[^a-zA-Z0-9]/g, '_')}-${variant.replace(/[^a-zA-Z0-9]/g, '_')}`;
	}

	// Sort template results alphabetically by template name, then by variant
	const sortedResults = [...templateResults].sort((a, b) => {
		if (a.template !== b.template) {
			return a.template.localeCompare(b.template);
		}
		return a.variant.localeCompare(b.variant);
	});

	let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Master Prompt Template Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
        .title { color: #2c3e50; margin: 0; font-size: 2.5em; font-weight: 300; }
        .subtitle { color: #7f8c8d; margin: 10px 0; font-size: 1.1em; }
        .summary { display: flex; justify-content: center; gap: 30px; margin: 30px 0; flex-wrap: wrap; }
        .stat { text-align: center; padding: 20px; border-radius: 8px; min-width: 120px; }
        .stat.passed { background: #d4edda; color: #155724; }
        .stat.failed { background: #f8d7da; color: #721c24; }
        .stat.total { background: #e2e3e5; color: #383d41; }
        .stat-number { font-size: 2em; font-weight: bold; margin: 0; }
        .stat-label { margin: 5px 0 0 0; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .test-section { margin: 40px 0; }
        .test-grid { display: block; }
        .test-grid .test-case { margin-bottom: 16px; }
        .section-title { color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px; margin-bottom: 20px; font-size: 1.5em; }
        .summary-section { margin: 20px 0; }
        .template-group { margin: 4px 0; padding: 6px 10px; border-radius: 4px; background: #f8f9fa; border-left: 3px solid #dee2e6; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .template-name { font-size: 0.9em; font-weight: 600; color: #2c3e50; margin-right: 4px; }
        .template-status { padding: 2px 6px; border-radius: 8px; font-size: 0.7em; font-weight: 600; text-transform: uppercase; margin-left: auto; flex-shrink: 0; }
        .template-status.passed { background: #d4edda; color: #155724; }
        .template-status.failed { background: #f8d7da; color: #721c24; }
        .variant-item { padding: 2px 6px; border-radius: 3px; background: white; border: 1px solid #e9ecef; font-size: 0.75em; display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
        .variant-item.passed { border-left: 2px solid #28a745; color: #155724; }
        .variant-item.failed { border-left: 2px solid #dc3545; color: #721c24; background: #fff5f5; }
        .variant-name { font-weight: 500; }
        .variant-name a { text-decoration: none; color: inherit; }
        .variant-name a:hover { text-decoration: underline; }
        .variant-badge { font-size: 0.8em; font-weight: bold; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .summary-item { padding: 15px; border-radius: 8px; border-left: 4px solid #3498db; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center; }
        .summary-item.passed { border-left-color: #28a745; }
        .summary-item.failed { border-left-color: #dc3545; background: #fff5f5; }
        .summary-name { font-weight: 600; color: #2c3e50; }
        .summary-status { padding: 4px 8px; border-radius: 15px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; }
        .summary-status.passed { background: #d4edda; color: #155724; }
        .summary-status.failed { background: #f8d7da; color: #721c24; }
        .test-case { margin: 8px 0; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #3498db; background: #f8f9fa; }
        .test-case.passed { border-left-color: #28a745; }
        .test-case.failed { border-left-color: #dc3545; background: #fff5f5; }
        .test-header { margin-bottom: 8px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: space-between; }
        .test-name { font-weight: 600; color: #2c3e50; font-size: 1em; margin: 0; flex-shrink: 0; }
        .test-status { padding: 4px 8px; border-radius: 12px; font-size: 0.7em; font-weight: 600; text-transform: uppercase; display: inline-block; flex-shrink: 0; }
        .test-status.passed { background: #d4edda; color: #155724; }
        .test-status.failed { background: #f8d7da; color: #721c24; }
        .prompt-section { margin-top: 20px; }
        .prompt-title { font-weight: 600; color: #495057; margin: 20px 0 10px 0; font-size: 1em; text-transform: uppercase; letter-spacing: 0.5px; }
        .prompt-content { background: #f1f3f4; padding: 20px; border-radius: 6px; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 0.9em; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #e9ecef; overflow-x: auto; }
        .error-message { color: #dc3545; font-style: italic; margin-top: 15px; padding: 10px; background: #fff5f5; border-radius: 4px; }
        .toggle-button { background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75em; margin: 0; transition: all 0.2s ease; margin-left: auto; min-height: 44px; min-width: 44px; touch-action: manipulation; user-select: none; }
        .toggle-button:hover { background: #0056b3; transform: translateY(-1px); }
        .toggle-button:active { background: #004085; transform: translateY(0); }
        .toggle-button:focus { outline: 2px solid #80bdff; outline-offset: 2px; }
        .toggle-content { display: none; margin-top: 8px; }
        .toggle-content.expanded { display: block; }
        .footer { text-align: center; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; color: #6c757d; font-size: 0.9em; }
        .divider { height: 2px; background: linear-gradient(to right, #e9ecef, #dee2e6, #e9ecef); margin: 40px 0; border-radius: 1px; }
        .error-tests-section { margin: 20px 0; }
        .error-section-title { color: #856404; font-size: 1.1em; font-weight: 600; margin-bottom: 10px; border-bottom: 1px solid #ffc107; padding-bottom: 5px; }
        .error-group { margin: 4px 0; padding: 6px 10px; border-radius: 4px; background: #fff3cd; border-left: 3px solid #ffc107; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
            body { padding: 15px; }
            .container { padding: 20px; }
            .header { margin-bottom: 25px; padding-bottom: 15px; }
            .title { font-size: 2em; line-height: 1.2; }
            .subtitle { font-size: 0.95em; }
            .summary { gap: 20px; margin: 25px 0; }
            .stat { min-width: 90px; padding: 12px 8px; }
            .stat-number { font-size: 1.6em; }
            .stat-label { font-size: 0.75em; }
            .section-title { font-size: 1.25em; }
            .test-section { margin: 25px 0; }
            .test-grid .test-case { margin-bottom: 10px; }
            .template-group { gap: 4px; padding: 8px 12px; align-items: center; }
            .template-name { font-size: 0.85em; flex-shrink: 0; }
            .template-status { font-size: 0.65em; padding: 3px 6px; flex-shrink: 0; }
            .variant-item { margin: 1px; padding: 3px 5px; font-size: 0.7em; min-height: 24px; flex-shrink: 0; }
            .summary-grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
            .test-case { margin: 6px 0; padding: 8px 12px; }
            .test-header { gap: 6px; justify-content: space-between; }
            .test-name { font-size: 0.9em; }
            .test-status { font-size: 0.65em; padding: 3px 6px; }
            .toggle-button { padding: 6px 10px; font-size: 0.7em; min-height: 38px; min-width: 38px; touch-action: manipulation; }
            .prompt-content { padding: 12px; font-size: 0.75em; }
            .prompt-title { font-size: 0.85em; margin: 12px 0 6px 0; }
            .divider { margin: 25px 0; }
            .footer { margin-top: 25px; font-size: 0.8em; }
        }

        @media (max-width: 480px) {
            body { padding: 10px; }
            .container { padding: 15px; }
            .title { font-size: 1.7em; }
            .summary { gap: 12px; }
            .stat { min-width: 75px; padding: 10px 6px; }
            .stat-number { font-size: 1.4em; }
            .stat-label { font-size: 0.7em; }
            .template-group { gap: 3px; align-items: center; }
            .template-name { font-size: 0.8em; flex-shrink: 0; }
            .template-status { font-size: 0.6em; padding: 2px 4px; flex-shrink: 0; }
            .variant-item { font-size: 0.65em; padding: 2px 4px; min-height: 20px; }
            .test-header { gap: 4px; justify-content: space-between; align-items: center; }
            .test-name { font-size: 0.85em; }
            .test-status { font-size: 0.6em; padding: 2px 4px; }
            .toggle-button { padding: 6px 10px; font-size: 0.7em; min-height: 40px; min-width: 40px; touch-action: manipulation; }
            .prompt-content { padding: 10px; font-size: 0.7em; line-height: 1.3; }
            .test-case { padding: 6px 8px; }
            .test-grid .test-case { margin-bottom: 8px; }
        }

        /* Touch-friendly enhancements */
        @media (hover: none) and (pointer: coarse) {
            .variant-name a { padding: 6px; margin: -6px; min-height: 44px; display: inline-flex; align-items: center; }
            .toggle-button { min-height: 44px; min-width: 44px; }
            .toggle-button:hover { transform: none; } /* Disable hover effects on touch devices */
        }
    </style>
    <script>
        function togglePrompts(buttonId) {
            const button = document.getElementById(buttonId);
            const content = document.getElementById(buttonId + '-content');
            
            if (content.classList.contains('expanded')) {
                content.classList.remove('expanded');
                button.textContent = 'Show Prompts';
                button.style.background = '#007bff';
            } else {
                content.classList.add('expanded');
                button.textContent = 'Hide Prompts';
                button.style.background = '#6c757d';
            }
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">Task Master Prompt Template Test Report</h1>
            <p class="subtitle">Generated on ${timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="stat total">
                <p class="stat-number">${total}</p>
                <p class="stat-label">Total Tests</p>
            </div>
            <div class="stat passed">
                <p class="stat-number">${passed}</p>
                <p class="stat-label">Passed</p>
            </div>
            <div class="stat failed">
                <p class="stat-number">${failed}</p>
                <p class="stat-label">Failed</p>
            </div>
        </div>`;

	if (sortedResults.length > 0) {
		// Separate real templates from error condition tests
		const realTemplateResults = sortedResults.filter(
			(result) =>
				!result.expectedError &&
				result.template !== 'nonexistent-template' &&
				!(
					result.template === 'research' && result.testName === 'invalid-detail'
				) &&
				!(result.template === 'expand-task' && result.variant === 'nonexistent')
		);

		const errorConditionResults = sortedResults.filter(
			(result) =>
				result.expectedError ||
				result.template === 'nonexistent-template' ||
				(result.template === 'research' &&
					result.testName === 'invalid-detail') ||
				(result.template === 'expand-task' && result.variant === 'nonexistent')
		);

		// Group real template results by template
		const groupedResults = {};
		realTemplateResults.forEach((result) => {
			if (!groupedResults[result.template]) {
				groupedResults[result.template] = [];
			}
			groupedResults[result.template].push(result);
		});

		// Test Results Summary Section for Real Templates
		html += `
        <div class="summary-section">
            <h2 class="section-title">Test Results Summary</h2>`;

		Object.keys(groupedResults)
			.sort()
			.forEach((templateName) => {
				const templateResults = groupedResults[templateName];
				const passedCount = templateResults.filter((r) => r.success).length;
				const totalCount = templateResults.length;
				const allPassed = passedCount === totalCount;

				html += `
            <div class="template-group">
                <span class="template-name">${templateName}:</span>`;

				templateResults.forEach((result) => {
					const status = result.success ? 'passed' : 'failed';
					const badge = result.success ? '✓' : '✗';
					const anchorId = generateAnchorId(result.template, result.variant);
					html += `
                    <span class="variant-item ${status}">
                        <span class="variant-name"><a href="#${anchorId}">${result.variant}</a></span>
                        <span class="variant-badge">${badge}</span>
                    </span>`;
				});

				html += `
                <span class="template-status ${allPassed ? 'passed' : 'failed'}">${passedCount}/${totalCount} passed</span>
            </div>`;
			});

		// Error Condition Tests Section
		if (errorConditionResults.length > 0) {
			html += `
        </div>
        
        <div class="error-tests-section">
            <h3 class="error-section-title">Error Condition Tests</h3>
            <div class="error-group">`;

			errorConditionResults.forEach((result) => {
				const status = result.success ? 'passed' : 'failed';
				const badge = result.success ? '✓' : '✗';
				let testName = '';

				if (result.template === 'nonexistent-template') {
					testName = 'nonexistent-template';
				} else if (
					result.template === 'expand-task' &&
					result.variant === 'nonexistent'
				) {
					testName = 'nonexistent-variant';
				} else if (result.template === 'parse-prd' && result.error) {
					testName = 'missing-parameters';
				} else if (
					result.template === 'add-task' &&
					result.error &&
					result.error.includes('prompt')
				) {
					testName = 'empty-prompt';
				} else if (
					result.template === 'research' &&
					result.variant === 'invalid-detail'
				) {
					testName = 'invalid-variant';
				} else {
					testName = `${result.template}-${result.variant}`;
				}

				html += `
                <span class="variant-item ${status}">
                    <span class="variant-name">${testName}</span>
                    <span class="variant-badge">${badge}</span>
                </span>`;
			});

			const errorPassedCount = errorConditionResults.filter(
				(r) => r.success
			).length;
			const errorTotalCount = errorConditionResults.length;
			const allErrorsPassed = errorPassedCount === errorTotalCount;

			html += `
                <span class="template-status ${allErrorsPassed ? 'passed' : 'failed'}">${errorPassedCount}/${errorTotalCount} passed</span>
            </div>
        </div>`;
		}

		html += `
        
        <div class="divider"></div>`;

		// Detailed Prompts Section
		html += `
        <div class="test-section">
            <h2 class="section-title">Detailed Prompt Content</h2>
            <div class="test-grid">`;

		realTemplateResults.forEach((result, index) => {
			const status = result.success ? 'passed' : 'failed';
			const anchorId = generateAnchorId(result.template, result.variant);
			html += `
            <div class="test-case ${status}" id="${anchorId}">
                <div class="test-header">
                    <div class="test-name">${result.template} (${result.variant})</div>
                    <span class="test-status ${status}">${status}</span>`;

			if (result.success && result.prompts) {
				const safeTemplate = (result.template || 'unknown').replace(
					/[^a-zA-Z0-9]/g,
					'_'
				);
				const safeVariant = (result.variant || 'default').replace(
					/[^a-zA-Z0-9]/g,
					'_'
				);
				const toggleId = `toggle-${safeTemplate}-${safeVariant}-${index}`;
				html += `
                    <button class="toggle-button" id="${toggleId}" onclick="togglePrompts('${toggleId}')">Show Prompts</button>
                </div>
                <div class="toggle-content" id="${toggleId}-content">
                    <div class="prompt-section">
                        <div class="prompt-title">System Prompt</div>
                        <div class="prompt-content">${escapeHtml(result.prompts.systemPrompt)}</div>
                    </div>
                    <div class="prompt-section">
                        <div class="prompt-title">User Prompt</div>
                        <div class="prompt-content">${escapeHtml(result.prompts.userPrompt)}</div>
                    </div>
                </div>`;
			} else {
				html += `
                </div>`;
			}

			if (!result.success) {
				html += `<div class="error-message">Error: ${escapeHtml(result.error)}</div>`;
			}

			html += `</div>`;
		});

		html += `</div></div>`;
	}

	html += `
        <div class="footer">
            <p>Task Master Prompt Template Testing Tool</p>
        </div>
    </div>
</body>
</html>`;

	return html;
}

// Helper function to escape HTML
function escapeHtml(text) {
	if (!text) return '';
	return text
		.toString()
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

// Generate and save HTML report
async function generateAndSaveHTMLReport() {
	console.log(`${colors.cyan}Generating HTML Report...${colors.reset}\n`);

	const results = await runComprehensiveTests(true);
	const html = generateHTMLReport(results, results.detailedResults);

	// Create output directory if it doesn't exist
	const outputDir = path.join(projectRoot, 'tests/manual/prompts/output');
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	// Generate filename with timestamp
	const timestamp = new Date()
		.toISOString()
		.replace(/[:.]/g, '-')
		.substring(0, 19);
	const filename = `prompt-test-report-${timestamp}.html`;
	const filepath = path.join(outputDir, filename);

	// Save HTML file
	fs.writeFileSync(filepath, html, 'utf8');

	console.log(
		`${colors.green}✓ HTML report generated: ${filepath}${colors.reset}`
	);
	console.log(
		`${colors.cyan}Results: ${results.passed}/${results.total} tests passed${colors.reset}`
	);

	// Try to open in browser (cross-platform)
	try {
		const { exec } = await import('child_process');
		const command =
			process.platform === 'darwin'
				? 'open'
				: process.platform === 'win32'
					? 'start'
					: 'xdg-open';
		exec(`${command} "${filepath}"`);
		console.log(`${colors.blue}Opening report in browser...${colors.reset}`);
	} catch (error) {
		console.log(
			`${colors.yellow}Couldn't auto-open browser. Please open: ${filepath}${colors.reset}`
		);
	}

	return { filepath, results };
}
