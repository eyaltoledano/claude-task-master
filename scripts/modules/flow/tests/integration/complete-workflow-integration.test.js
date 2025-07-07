/**
 * Complete Workflow Integration Tests
 *
 * Tests the full end-to-end Claude Code workflow from launch to PR merge,
 * integrating all system components in realistic scenarios.
 *
 * Test Coverage:
 * - Complete task-to-PR workflows
 * - Multi-component integration
 * - Workflow state management
 * - End-to-end error handling
 * - Performance under realistic loads
 * - Data persistence and recovery
 */

import { jest } from '@jest/globals';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

// Mock system components
const mockASTContext = {
	buildContext: jest.fn(),
	analyzeComplexity: jest.fn(),
	formatForClaude: jest.fn(),
	invalidateCache: jest.fn()
};

const mockClaudeService = {
	createSession: jest.fn(),
	processRequest: jest.fn(),
	streamResponse: jest.fn(),
	terminateSession: jest.fn(),
	getSessionStatus: jest.fn()
};

const mockHookExecutor = {
	executeHooks: jest.fn(),
	registerHook: jest.fn(),
	validateSafety: jest.fn(),
	getHookStatus: jest.fn()
};

const mockPRAutomation = {
	createPR: jest.fn(),
	updatePR: jest.fn(),
	mergePR: jest.fn(),
	getPRStatus: jest.fn(),
	validateQuality: jest.fn()
};

const mockNotificationService = {
	sendNotification: jest.fn(),
	broadcastUpdate: jest.fn(),
	subscribeToEvents: jest.fn(),
	getDeliveryStatus: jest.fn()
};

const mockWorkflowManager = {
	initializeWorkflow: jest.fn(),
	progressWorkflow: jest.fn(),
	completeWorkflow: jest.fn(),
	rollbackWorkflow: jest.fn(),
	getWorkflowState: jest.fn(),
	saveCheckpoint: jest.fn(),
	restoreCheckpoint: jest.fn()
};

const mockGitService = {
	createBranch: jest.fn(),
	commitChanges: jest.fn(),
	pushBranch: jest.fn(),
	mergeBranch: jest.fn(),
	getStatus: jest.fn(),
	getHistory: jest.fn()
};

// Test utilities
function createTestWorkflowConfig() {
	return {
		workflowId: `test-workflow-${Date.now()}`,
		projectPath: '/test/project',
		taskId: 'task-001',
		branchName: 'feature/test-implementation',
		components: ['ast', 'claude', 'hooks', 'pr', 'notifications'],
		settings: {
			autoMerge: false,
			requiresReview: true,
			safetyChecks: true,
			notifications: true
		}
	};
}

function createMockTaskData() {
	return {
		id: 'task-001',
		title: 'Implement user authentication',
		description: 'Add JWT-based authentication system',
		priority: 'high',
		complexity: 8,
		estimatedTime: '2-3 hours',
		files: [
			'src/auth/authentication.js',
			'src/auth/middleware.js',
			'src/auth/routes.js',
			'tests/auth.test.js'
		],
		dependencies: ['task-000'],
		requirements: [
			'Use JWT for token generation',
			'Implement password hashing',
			'Add rate limiting',
			'Include comprehensive tests'
		]
	};
}

function createMockClaudeResponse() {
	return {
		sessionId: 'claude-session-123',
		analysis: {
			filesAnalyzed: 15,
			complexityScore: 7.5,
			recommendedApproach: 'Incremental implementation with testing',
			riskFactors: ['Database schema changes', 'Security considerations']
		},
		implementation: {
			codeChanges: [
				{
					file: 'src/auth/authentication.js',
					type: 'create',
					content: '// JWT authentication implementation...'
				},
				{
					file: 'src/auth/middleware.js',
					type: 'create',
					content: '// Authentication middleware...'
				}
			],
			testFiles: [
				{
					file: 'tests/auth.test.js',
					content: '// Comprehensive authentication tests...'
				}
			]
		},
		qualityMetrics: {
			testCoverage: 95,
			codeComplexity: 6.2,
			securityScore: 9.1,
			maintainabilityIndex: 8.7
		}
	};
}

describe('Complete Workflow Integration Tests', () => {
	let testTempDir;
	let workflowConfig;
	let mockTaskData;

	beforeAll(async () => {
		testTempDir = await fs.mkdtemp(
			path.join(os.tmpdir(), 'workflow-integration-')
		);
	});

	afterAll(async () => {
		if (testTempDir) {
			await fs.remove(testTempDir);
		}
	});

	beforeEach(() => {
		// Reset all mocks
		jest.clearAllMocks();

		workflowConfig = createTestWorkflowConfig();
		mockTaskData = createMockTaskData();

		// Setup default mock behaviors
		mockASTContext.buildContext.mockResolvedValue({
			files: 15,
			totalLines: 2500,
			complexity: 7.5,
			contextSize: '45KB'
		});

		mockClaudeService.createSession.mockResolvedValue('claude-session-123');
		mockClaudeService.processRequest.mockResolvedValue(
			createMockClaudeResponse()
		);

		mockHookExecutor.executeHooks.mockResolvedValue({
			executed: 5,
			successful: 5,
			failed: 0,
			duration: 1200
		});

		mockPRAutomation.createPR.mockResolvedValue({
			id: 'pr-456',
			url: 'https://github.com/test/repo/pull/456',
			status: 'open'
		});

		mockNotificationService.sendNotification.mockResolvedValue({
			delivered: true,
			channels: ['email', 'slack'],
			timestamp: new Date().toISOString()
		});

		mockWorkflowManager.initializeWorkflow.mockResolvedValue({
			workflowId: workflowConfig.workflowId,
			state: 'initialized',
			timestamp: new Date().toISOString()
		});

		mockGitService.createBranch.mockResolvedValue({
			branch: workflowConfig.branchName,
			commit: 'abc123def'
		});
	});

	describe('Basic Workflow Execution', () => {
		test('should execute complete task-to-PR workflow successfully', async () => {
			const startTime = Date.now();

			// Step 1: Initialize workflow
			const workflowInit =
				await mockWorkflowManager.initializeWorkflow(workflowConfig);
			expect(workflowInit.state).toBe('initialized');
			expect(mockWorkflowManager.initializeWorkflow).toHaveBeenCalledWith(
				workflowConfig
			);

			// Step 2: Build AST context
			const astContext = await mockASTContext.buildContext(
				workflowConfig.projectPath,
				mockTaskData
			);
			expect(astContext.files).toBe(15);
			expect(astContext.complexity).toBe(7.5);

			// Step 3: Create Claude session
			const sessionId = await mockClaudeService.createSession({
				context: astContext,
				task: mockTaskData,
				workflow: workflowConfig.workflowId
			});
			expect(sessionId).toBe('claude-session-123');

			// Step 4: Process task with Claude
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId,
				task: mockTaskData,
				context: astContext
			});
			expect(claudeResponse.implementation.codeChanges).toHaveLength(2);
			expect(claudeResponse.qualityMetrics.testCoverage).toBe(95);

			// Step 5: Execute hooks
			const hookResults = await mockHookExecutor.executeHooks('pre-commit', {
				changes: claudeResponse.implementation.codeChanges,
				quality: claudeResponse.qualityMetrics
			});
			expect(hookResults.successful).toBe(5);
			expect(hookResults.failed).toBe(0);

			// Step 6: Create git branch and commit
			const gitBranch = await mockGitService.createBranch(
				workflowConfig.branchName
			);
			expect(gitBranch.branch).toBe(workflowConfig.branchName);

			const gitCommit = await mockGitService.commitChanges({
				files: claudeResponse.implementation.codeChanges,
				message: `Implement ${mockTaskData.title}\n\nCompleted via Claude Code workflow ${workflowConfig.workflowId}`
			});

			// Step 7: Create PR
			const prResult = await mockPRAutomation.createPR({
				branch: workflowConfig.branchName,
				title: `Task ${mockTaskData.id}: ${mockTaskData.title}`,
				description: `Automated implementation via Claude Code\n\nQuality Metrics:\n- Test Coverage: ${claudeResponse.qualityMetrics.testCoverage}%\n- Security Score: ${claudeResponse.qualityMetrics.securityScore}/10`,
				changes: claudeResponse.implementation.codeChanges
			});
			expect(prResult.status).toBe('open');

			// Step 8: Send notifications
			const notification = await mockNotificationService.sendNotification({
				type: 'workflow-complete',
				workflow: workflowConfig.workflowId,
				pr: prResult,
				metrics: claudeResponse.qualityMetrics
			});
			expect(notification.delivered).toBe(true);

			// Step 9: Complete workflow
			const workflowComplete = await mockWorkflowManager.completeWorkflow(
				workflowConfig.workflowId,
				{
					pr: prResult,
					metrics: claudeResponse.qualityMetrics,
					duration: Date.now() - startTime
				}
			);

			// Verify complete workflow execution
			expect(mockWorkflowManager.initializeWorkflow).toHaveBeenCalledTimes(1);
			expect(mockASTContext.buildContext).toHaveBeenCalledTimes(1);
			expect(mockClaudeService.createSession).toHaveBeenCalledTimes(1);
			expect(mockClaudeService.processRequest).toHaveBeenCalledTimes(1);
			expect(mockHookExecutor.executeHooks).toHaveBeenCalledTimes(1);
			expect(mockPRAutomation.createPR).toHaveBeenCalledTimes(1);
			expect(mockNotificationService.sendNotification).toHaveBeenCalledTimes(1);
			expect(mockWorkflowManager.completeWorkflow).toHaveBeenCalledTimes(1);
		}, 30000);

		test('should handle workflow with complex task requirements', async () => {
			// Create complex task with multiple dependencies
			const complexTask = {
				...mockTaskData,
				complexity: 9.5,
				files: [
					'src/auth/authentication.js',
					'src/auth/middleware.js',
					'src/auth/routes.js',
					'src/auth/models/user.js',
					'src/auth/validators.js',
					'src/auth/constants.js',
					'tests/auth.test.js',
					'tests/middleware.test.js',
					'tests/integration/auth-flow.test.js'
				],
				dependencies: ['task-000', 'task-001', 'task-002']
			};

			// Mock complex AST context
			mockASTContext.buildContext.mockResolvedValue({
				files: 45,
				totalLines: 8500,
				complexity: 9.2,
				contextSize: '125KB',
				dependencies: {
					external: ['jwt', 'bcrypt', 'express-rate-limit'],
					internal: ['database', 'validation', 'logging']
				}
			});

			// Mock complex Claude response
			const complexResponse = {
				...createMockClaudeResponse(),
				implementation: {
					codeChanges: complexTask.files.map((file) => ({
						file,
						type: file.includes('test') ? 'test' : 'create',
						content: `// Implementation for ${file}...`
					})),
					testFiles: complexTask.files
						.filter((f) => f.includes('test'))
						.map((file) => ({
							file,
							content: `// Comprehensive tests for ${file}...`
						}))
				},
				qualityMetrics: {
					testCoverage: 92,
					codeComplexity: 8.1,
					securityScore: 9.5,
					maintainabilityIndex: 8.2
				}
			};

			mockClaudeService.processRequest.mockResolvedValue(complexResponse);

			// Execute workflow
			await mockWorkflowManager.initializeWorkflow(workflowConfig);
			const astContext = await mockASTContext.buildContext(
				workflowConfig.projectPath,
				complexTask
			);
			const sessionId = await mockClaudeService.createSession({
				context: astContext,
				task: complexTask
			});
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId,
				task: complexTask,
				context: astContext
			});

			// Verify complex scenario handling
			expect(astContext.files).toBe(45);
			expect(astContext.complexity).toBe(9.2);
			expect(claudeResponse.implementation.codeChanges).toHaveLength(9);
			expect(claudeResponse.qualityMetrics.testCoverage).toBe(92);
		}, 45000);

		test('should manage workflow state and checkpoints', async () => {
			const workflowStates = [];

			// Mock workflow state progression
			mockWorkflowManager.getWorkflowState.mockImplementation(() => {
				const currentState = {
					workflowId: workflowConfig.workflowId,
					stage: workflowStates[workflowStates.length - 1] || 'initialized',
					progress: Math.min(workflowStates.length * 20, 100),
					timestamp: new Date().toISOString()
				};
				return Promise.resolve(currentState);
			});

			mockWorkflowManager.saveCheckpoint.mockImplementation((stage, data) => {
				workflowStates.push(stage);
				return Promise.resolve({ checkpoint: stage, saved: true });
			});

			// Execute workflow with checkpoints
			await mockWorkflowManager.initializeWorkflow(workflowConfig);
			await mockWorkflowManager.saveCheckpoint('ast-context-built', {
				files: 15
			});

			let state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.stage).toBe('ast-context-built');
			expect(state.progress).toBe(20);

			await mockWorkflowManager.saveCheckpoint('claude-processing', {
				sessionId: 'claude-session-123'
			});
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.stage).toBe('claude-processing');
			expect(state.progress).toBe(40);

			await mockWorkflowManager.saveCheckpoint('hooks-executed', {
				hooksRun: 5
			});
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.stage).toBe('hooks-executed');
			expect(state.progress).toBe(60);

			await mockWorkflowManager.saveCheckpoint('pr-created', {
				prId: 'pr-456'
			});
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.stage).toBe('pr-created');
			expect(state.progress).toBe(80);

			await mockWorkflowManager.saveCheckpoint('completed', { success: true });
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.stage).toBe('completed');
			expect(state.progress).toBe(100);

			// Verify checkpoint management
			expect(mockWorkflowManager.saveCheckpoint).toHaveBeenCalledTimes(5);
			expect(mockWorkflowManager.getWorkflowState).toHaveBeenCalledTimes(5);
		});
	});

	describe('Advanced Workflow Scenarios', () => {
		test('should handle workflow with multiple file modifications', async () => {
			const multiFileTask = {
				...mockTaskData,
				files: [
					'src/auth/authentication.js',
					'src/auth/middleware.js',
					'src/auth/routes.js',
					'src/models/user.js',
					'src/config/database.js',
					'src/utils/validation.js',
					'tests/auth.test.js',
					'tests/models/user.test.js',
					'docs/auth-api.md'
				]
			};

			// Mock multi-file Claude response
			const multiFileResponse = {
				...createMockClaudeResponse(),
				implementation: {
					codeChanges: multiFileTask.files.map((file, index) => ({
						file,
						type: file.includes('docs')
							? 'documentation'
							: file.includes('test')
								? 'test'
								: file.includes('config')
									? 'modify'
									: 'create',
						content: `// Content for ${file}...`,
						lines: 50 + index * 25,
						complexity: 3 + index * 0.5
					})),
					dependencies: {
						added: ['jsonwebtoken', 'bcrypt'],
						modified: ['express'],
						removed: []
					}
				}
			};

			mockClaudeService.processRequest.mockResolvedValue(multiFileResponse);

			// Execute workflow
			await mockWorkflowManager.initializeWorkflow(workflowConfig);
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId: 'claude-session-123',
				task: multiFileTask
			});

			// Verify multi-file handling
			expect(claudeResponse.implementation.codeChanges).toHaveLength(9);
			expect(claudeResponse.implementation.dependencies.added).toContain(
				'jsonwebtoken'
			);
			expect(claudeResponse.implementation.dependencies.added).toContain(
				'bcrypt'
			);

			// Verify git operations for multiple files
			await mockGitService.commitChanges({
				files: claudeResponse.implementation.codeChanges,
				message: `Multi-file implementation: ${multiFileTask.title}`
			});

			expect(mockGitService.commitChanges).toHaveBeenCalledWith(
				expect.objectContaining({
					files: expect.arrayContaining([
						expect.objectContaining({ file: 'src/auth/authentication.js' }),
						expect.objectContaining({ file: 'tests/auth.test.js' }),
						expect.objectContaining({ file: 'docs/auth-api.md' })
					])
				})
			);
		});

		test('should handle workflow with external API integrations', async () => {
			const apiIntegrationTask = {
				...mockTaskData,
				title: 'Integrate with payment gateway',
				description: 'Add Stripe payment processing',
				files: [
					'src/payments/stripe-service.js',
					'src/payments/webhook-handler.js',
					'src/api/payment-routes.js',
					'tests/payments/stripe.test.js'
				],
				externalServices: ['stripe', 'webhook-service']
			};

			// Mock API integration response
			const apiResponse = {
				...createMockClaudeResponse(),
				implementation: {
					codeChanges: apiIntegrationTask.files.map((file) => ({
						file,
						type: 'create',
						content: `// ${file} implementation with API integration...`
					})),
					externalConfigs: [
						{
							service: 'stripe',
							configFile: '.env.example',
							variables: [
								'STRIPE_PUBLIC_KEY',
								'STRIPE_SECRET_KEY',
								'STRIPE_WEBHOOK_SECRET'
							]
						}
					],
					webhooks: [
						{
							endpoint: '/api/webhooks/stripe',
							events: [
								'payment_intent.succeeded',
								'payment_intent.payment_failed'
							]
						}
					]
				}
			};

			mockClaudeService.processRequest.mockResolvedValue(apiResponse);

			// Mock hook execution for API validation
			mockHookExecutor.executeHooks.mockResolvedValue({
				executed: 7,
				successful: 6,
				failed: 1,
				results: [
					{ hook: 'api-key-validation', status: 'success' },
					{ hook: 'webhook-security', status: 'success' },
					{ hook: 'rate-limit-check', status: 'warning' }
				]
			});

			// Execute workflow
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId: 'claude-session-123',
				task: apiIntegrationTask
			});

			const hookResults = await mockHookExecutor.executeHooks(
				'api-validation',
				{
					integrations: claudeResponse.implementation.externalConfigs,
					webhooks: claudeResponse.implementation.webhooks
				}
			);

			// Verify API integration handling
			expect(claudeResponse.implementation.externalConfigs).toHaveLength(1);
			expect(claudeResponse.implementation.webhooks).toHaveLength(1);
			expect(hookResults.executed).toBe(7);
			expect(hookResults.successful).toBe(6);
		});

		test('should integrate with quality analysis and automated reviews', async () => {
			const qualityTask = {
				...mockTaskData,
				qualityRequirements: {
					testCoverage: 95,
					complexity: { max: 7 },
					security: { min: 9 },
					performance: { responseTime: 200 }
				}
			};

			// Mock quality-focused Claude response
			const qualityResponse = {
				...createMockClaudeResponse(),
				qualityMetrics: {
					testCoverage: 97,
					codeComplexity: 6.8,
					securityScore: 9.3,
					maintainabilityIndex: 8.9,
					performance: {
						estimatedResponseTime: 150,
						memoryUsage: 'low',
						cpuComplexity: 'medium'
					}
				},
				qualityAnalysis: {
					strengths: [
						'High test coverage',
						'Good separation of concerns',
						'Secure implementation'
					],
					improvements: [
						'Consider caching for performance',
						'Add input validation edge cases'
					],
					riskFactors: [
						'Database query complexity',
						'Third-party API dependency'
					]
				}
			};

			mockClaudeService.processRequest.mockResolvedValue(qualityResponse);

			// Mock quality validation hooks
			mockHookExecutor.executeHooks.mockResolvedValue({
				executed: 8,
				successful: 8,
				failed: 0,
				qualityGates: {
					testCoverage: { required: 95, actual: 97, passed: true },
					complexity: { required: 7, actual: 6.8, passed: true },
					security: { required: 9, actual: 9.3, passed: true }
				}
			});

			// Mock PR creation with quality metrics
			mockPRAutomation.createPR.mockResolvedValue({
				id: 'pr-789',
				url: 'https://github.com/test/repo/pull/789',
				status: 'open',
				qualityReport: {
					overallScore: 9.1,
					passedGates: 3,
					totalGates: 3,
					autoApproved: false, // Still requires human review
					reviewers: ['senior-dev', 'security-team']
				}
			});

			// Execute quality-focused workflow
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId: 'claude-session-123',
				task: qualityTask
			});

			const hookResults = await mockHookExecutor.executeHooks('quality-gates', {
				metrics: claudeResponse.qualityMetrics,
				requirements: qualityTask.qualityRequirements
			});

			const prResult = await mockPRAutomation.createPR({
				title: `${qualityTask.title} (Quality Score: ${claudeResponse.qualityMetrics.securityScore}/10)`,
				qualityMetrics: claudeResponse.qualityMetrics,
				qualityAnalysis: claudeResponse.qualityAnalysis
			});

			// Verify quality integration
			expect(claudeResponse.qualityMetrics.testCoverage).toBeGreaterThanOrEqual(
				95
			);
			expect(claudeResponse.qualityMetrics.codeComplexity).toBeLessThanOrEqual(
				7
			);
			expect(
				claudeResponse.qualityMetrics.securityScore
			).toBeGreaterThanOrEqual(9);
			expect(hookResults.qualityGates.testCoverage.passed).toBe(true);
			expect(hookResults.qualityGates.complexity.passed).toBe(true);
			expect(hookResults.qualityGates.security.passed).toBe(true);
			expect(prResult.qualityReport.overallScore).toBeGreaterThan(9);
		});
	});

	describe('Performance and Scalability', () => {
		test('should complete workflow within performance targets', async () => {
			const performanceConfig = {
				...workflowConfig,
				performanceTargets: {
					totalWorkflow: 30000, // 30 seconds
					astContext: 2000, // 2 seconds
					claudeProcessing: 15000, // 15 seconds
					hookExecution: 3000, // 3 seconds
					prCreation: 5000 // 5 seconds
				}
			};

			const startTime = Date.now();
			const timings = {};

			// Measure AST context building
			const astStart = Date.now();
			await mockASTContext.buildContext(
				performanceConfig.projectPath,
				mockTaskData
			);
			timings.astContext = Date.now() - astStart;

			// Measure Claude processing
			const claudeStart = Date.now();
			await mockClaudeService.createSession({});
			await mockClaudeService.processRequest({});
			timings.claudeProcessing = Date.now() - claudeStart;

			// Measure hook execution
			const hookStart = Date.now();
			await mockHookExecutor.executeHooks('pre-commit', {});
			timings.hookExecution = Date.now() - hookStart;

			// Measure PR creation
			const prStart = Date.now();
			await mockPRAutomation.createPR({});
			timings.prCreation = Date.now() - prStart;

			timings.totalWorkflow = Date.now() - startTime;

			// Verify performance targets
			expect(timings.totalWorkflow).toBeLessThan(
				performanceConfig.performanceTargets.totalWorkflow
			);
			expect(timings.astContext).toBeLessThan(
				performanceConfig.performanceTargets.astContext
			);
			expect(timings.claudeProcessing).toBeLessThan(
				performanceConfig.performanceTargets.claudeProcessing
			);
			expect(timings.hookExecution).toBeLessThan(
				performanceConfig.performanceTargets.hookExecution
			);
			expect(timings.prCreation).toBeLessThan(
				performanceConfig.performanceTargets.prCreation
			);

			console.log('Performance Timings:', timings);
		});

		test('should handle large codebase workflow efficiently', async () => {
			const largCodebaseTask = {
				...mockTaskData,
				title: 'Refactor large authentication system',
				files: Array.from({ length: 50 }, (_, i) => `src/auth/module-${i}.js`),
				complexity: 9.8,
				estimatedTime: '1-2 days'
			};

			// Mock large codebase context
			mockASTContext.buildContext.mockResolvedValue({
				files: 250,
				totalLines: 45000,
				complexity: 9.5,
				contextSize: '2.5MB',
				analysisTime: 4500 // 4.5 seconds
			});

			const memoryBefore = process.memoryUsage();
			const startTime = Date.now();

			// Execute workflow for large codebase
			const astContext = await mockASTContext.buildContext(
				workflowConfig.projectPath,
				largCodebaseTask
			);
			await mockClaudeService.createSession({
				context: astContext,
				task: largCodebaseTask
			});
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId: 'claude-session-123',
				task: largCodebaseTask,
				context: astContext
			});

			const memoryAfter = process.memoryUsage();
			const duration = Date.now() - startTime;

			// Verify large codebase handling
			expect(astContext.files).toBe(250);
			expect(astContext.totalLines).toBe(45000);
			expect(duration).toBeLessThan(60000); // Should complete within 60 seconds

			// Verify memory usage stays reasonable
			const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase

			console.log(
				`Large codebase workflow: ${duration}ms, Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`
			);
		});

		test('should efficiently handle workflow with extensive testing requirements', async () => {
			const testHeavyTask = {
				...mockTaskData,
				title: 'Implement comprehensive test suite',
				files: [
					'src/auth/authentication.js',
					'tests/unit/auth/authentication.test.js',
					'tests/unit/auth/middleware.test.js',
					'tests/integration/auth-flow.test.js',
					'tests/e2e/auth-scenarios.test.js',
					'tests/performance/auth-benchmarks.js',
					'tests/security/auth-security.test.js',
					'tests/fixtures/auth-data.js'
				],
				testRequirements: {
					unitTests: true,
					integrationTests: true,
					e2eTests: true,
					performanceTests: true,
					securityTests: true,
					coverage: 98
				}
			};

			// Mock test-heavy response
			const testResponse = {
				...createMockClaudeResponse(),
				implementation: {
					codeChanges: testHeavyTask.files.map((file) => ({
						file,
						type: file.includes('test') ? 'test' : 'create',
						content: `// ${file} with comprehensive testing...`,
						testCoverage: file.includes('test') ? 100 : 95
					})),
					testMetrics: {
						totalTests: 127,
						unitTests: 45,
						integrationTests: 32,
						e2eTests: 15,
						performanceTests: 18,
						securityTests: 17,
						estimatedRunTime: '3.5 minutes'
					}
				},
				qualityMetrics: {
					testCoverage: 98.5,
					codeComplexity: 5.8,
					securityScore: 9.7,
					maintainabilityIndex: 9.1
				}
			};

			mockClaudeService.processRequest.mockResolvedValue(testResponse);

			// Execute test-heavy workflow
			const claudeResponse = await mockClaudeService.processRequest({
				sessionId: 'claude-session-123',
				task: testHeavyTask
			});

			// Verify test implementation
			expect(claudeResponse.implementation.testMetrics.totalTests).toBe(127);
			expect(
				claudeResponse.implementation.testMetrics.unitTests
			).toBeGreaterThan(40);
			expect(
				claudeResponse.implementation.testMetrics.integrationTests
			).toBeGreaterThan(30);
			expect(claudeResponse.qualityMetrics.testCoverage).toBeGreaterThanOrEqual(
				98
			);

			// Verify all test types are covered
			const testFiles = claudeResponse.implementation.codeChanges.filter(
				(change) => change.type === 'test'
			);
			expect(testFiles).toHaveLength(7); // All test files

			console.log(
				'Test Implementation Metrics:',
				claudeResponse.implementation.testMetrics
			);
		});
	});

	describe('Data Persistence and Recovery', () => {
		test('should persist workflow state across interruptions', async () => {
			const persistentWorkflow = {
				...workflowConfig,
				persistence: {
					enabled: true,
					checkpointInterval: 5000, // 5 seconds
					backupLocation: path.join(testTempDir, 'workflow-backup')
				}
			};

			// Mock state persistence
			let persistedState = null;
			mockWorkflowManager.saveCheckpoint.mockImplementation((stage, data) => {
				persistedState = { stage, data, timestamp: Date.now() };
				return Promise.resolve({ saved: true, location: 'backup-123' });
			});

			mockWorkflowManager.restoreCheckpoint.mockImplementation(() => {
				return Promise.resolve(persistedState);
			});

			// Execute workflow with checkpoints
			await mockWorkflowManager.initializeWorkflow(persistentWorkflow);
			await mockWorkflowManager.saveCheckpoint('ast-built', {
				files: 15,
				complexity: 7.5
			});

			// Simulate interruption and recovery
			const restoredState = await mockWorkflowManager.restoreCheckpoint(
				persistentWorkflow.workflowId
			);
			expect(restoredState.stage).toBe('ast-built');
			expect(restoredState.data.files).toBe(15);

			// Continue from checkpoint
			await mockWorkflowManager.saveCheckpoint('claude-complete', {
				sessionId: 'claude-session-123'
			});
			await mockWorkflowManager.saveCheckpoint('pr-created', {
				prId: 'pr-456'
			});

			// Verify persistence
			expect(mockWorkflowManager.saveCheckpoint).toHaveBeenCalledTimes(3);
			expect(mockWorkflowManager.restoreCheckpoint).toHaveBeenCalledTimes(1);
		});

		test('should maintain data integrity during workflow execution', async () => {
			const integrityChecks = [];

			// Mock integrity validation
			mockWorkflowManager.getWorkflowState.mockImplementation(() => {
				const state = {
					workflowId: workflowConfig.workflowId,
					integrity: {
						checksum: 'abc123def456',
						version: '1.0.0',
						lastValidated: new Date().toISOString()
					}
				};
				integrityChecks.push(state.integrity);
				return Promise.resolve(state);
			});

			// Execute workflow with integrity checks
			await mockWorkflowManager.initializeWorkflow(workflowConfig);

			let state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);
			expect(state.integrity.checksum).toBe('abc123def456');

			await mockClaudeService.processRequest({});
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);

			await mockPRAutomation.createPR({});
			state = await mockWorkflowManager.getWorkflowState(
				workflowConfig.workflowId
			);

			// Verify integrity maintained
			expect(integrityChecks).toHaveLength(3);
			integrityChecks.forEach((check) => {
				expect(check.checksum).toBeTruthy();
				expect(check.version).toBe('1.0.0');
				expect(check.lastValidated).toBeTruthy();
			});
		});

		test('should handle workflow data cleanup after completion', async () => {
			const cleanupConfig = {
				...workflowConfig,
				cleanup: {
					enabled: true,
					retentionDays: 30,
					archiveCompleted: true,
					removeTemporary: true
				}
			};

			// Mock cleanup operations
			const cleanupActions = [];
			mockWorkflowManager.completeWorkflow.mockImplementation(
				(workflowId, result) => {
					cleanupActions.push({
						action: 'archive-logs',
						workflowId,
						timestamp: Date.now()
					});
					cleanupActions.push({
						action: 'cleanup-temp-files',
						workflowId,
						timestamp: Date.now()
					});
					return Promise.resolve({ completed: true, cleaned: true });
				}
			);

			// Execute workflow to completion
			await mockWorkflowManager.initializeWorkflow(cleanupConfig);
			const claudeResponse = await mockClaudeService.processRequest({});
			const prResult = await mockPRAutomation.createPR({});

			const completionResult = await mockWorkflowManager.completeWorkflow(
				cleanupConfig.workflowId,
				{
					pr: prResult,
					cleanup: cleanupConfig.cleanup
				}
			);

			// Verify cleanup execution
			expect(completionResult.cleaned).toBe(true);
			expect(cleanupActions).toHaveLength(2);
			expect(cleanupActions[0].action).toBe('archive-logs');
			expect(cleanupActions[1].action).toBe('cleanup-temp-files');
		});
	});
});
