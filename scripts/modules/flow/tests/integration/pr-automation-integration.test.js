/**
 * @fileoverview PR Automation Integration Tests
 * Comprehensive integration testing for automated PR creation with quality analysis,
 * hook coordination, and GitHub integration. Tests PR workflow automation,
 * quality gates, and review automation.
 *
 * @author Claude (Task Master Flow Testing Phase 3.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
const mockGitHubService = {
	createPullRequest: jest.fn(),
	updatePullRequest: jest.fn(),
	mergePullRequest: jest.fn(),
	closePullRequest: jest.fn(),
	addReviewers: jest.fn(),
	addLabels: jest.fn(),
	createComment: jest.fn(),
	getRepositoryInfo: jest.fn(),
	getBranches: jest.fn(),
	getCommits: jest.fn()
};

const mockQualityGates = {
	runQualityChecks: jest.fn(),
	generateQualityReport: jest.fn(),
	validateCoverage: jest.fn(),
	checkComplexity: jest.fn(),
	validatePerformance: jest.fn(),
	checkSecurity: jest.fn()
};

const mockTemplateService = {
	generatePRDescription: jest.fn(),
	generatePRTitle: jest.fn(),
	generateReviewRequest: jest.fn(),
	formatQualityReport: jest.fn(),
	generateChangelog: jest.fn()
};

const mockNotificationService = {
	sendPRCreated: jest.fn(),
	sendQualityCheckFailed: jest.fn(),
	sendReviewRequest: jest.fn(),
	sendMergeNotification: jest.fn()
};

const mockWorkflowEngine = {
	executeWorkflow: jest.fn(),
	getWorkflowStatus: jest.fn(),
	cancelWorkflow: jest.fn(),
	pauseWorkflow: jest.fn(),
	resumeWorkflow: jest.fn()
};

// Mock PR Automation Coordinator
class MockPRAutomationCoordinator extends EventEmitter {
	constructor() {
		super();
		this.workflows = new Map();
		this.qualityGates = new Map();
		this.templates = new Map();
		this.automationRules = new Map();
		this.statistics = {
			totalPRs: 0,
			automatedPRs: 0,
			qualityGatePassed: 0,
			qualityGateFailed: 0,
			averageProcessingTime: 0,
			successfulMerges: 0
		};
		this.config = {
			autoCreatePR: true,
			qualityGatesEnabled: true,
			autoAddReviewers: true,
			autoAssignLabels: true,
			requireQualityGate: true,
			autoMergeEnabled: false
		};
	}

	async createAutomatedPR(context) {
		const prId = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const startTime = Date.now();

		try {
			this.statistics.totalPRs++;
			this.statistics.automatedPRs++;

			const prContext = {
				prId,
				startTime,
				...context,
				qualityResults: {},
				automationSteps: [],
				reviewers: [],
				labels: [],
				status: 'initializing'
			};

			this.emit('prAutomationStarted', { prId, context: prContext });

			// Step 1: Validate source and target branches
			await this.validateBranches(prContext);

			// Step 2: Run quality gates if enabled
			if (this.config.qualityGatesEnabled) {
				await this.runQualityGates(prContext);
			}

			// Step 3: Generate PR content (title, description, etc.)
			await this.generatePRContent(prContext);

			// Step 4: Create the PR
			const pr = await this.createPR(prContext);

			// Step 5: Apply automation rules (reviewers, labels, etc.)
			await this.applyAutomationRules(prContext, pr);

			// Step 6: Send notifications
			await this.sendNotifications(prContext, pr);

			const endTime = Date.now();
			const processingTime = endTime - startTime;

			this.updateStatistics(prContext, processingTime, true);

			this.emit('prAutomationCompleted', {
				prId,
				pr,
				processingTime,
				qualityResults: prContext.qualityResults
			});

			return {
				success: true,
				prId,
				pr,
				processingTime,
				qualityResults: prContext.qualityResults,
				automationSteps: prContext.automationSteps,
				reviewers: prContext.reviewers,
				labels: prContext.labels
			};
		} catch (error) {
			this.emit('prAutomationError', { prId, error });

			return {
				success: false,
				prId,
				error: error.message,
				processingTime: Date.now() - startTime,
				qualityResults: {},
				automationSteps: [],
				reviewers: [],
				labels: []
			};
		}
	}

	async validateBranches(context) {
		this.emit('branchValidationStarted', { prId: context.prId });

		try {
			const branches = await mockGitHubService.getBranches();

			if (!branches.includes(context.sourceBranch)) {
				throw new Error(`Source branch ${context.sourceBranch} not found`);
			}

			if (!branches.includes(context.targetBranch)) {
				throw new Error(`Target branch ${context.targetBranch} not found`);
			}

			// Check for conflicts
			const commits = await mockGitHubService.getCommits(context.sourceBranch);
			context.commitCount = commits.length;
			context.lastCommit = commits[0];

			context.automationSteps.push({
				step: 'branch-validation',
				status: 'completed',
				timestamp: new Date().toISOString(),
				details: {
					sourceBranch: context.sourceBranch,
					targetBranch: context.targetBranch
				}
			});

			this.emit('branchValidationCompleted', {
				prId: context.prId,
				sourceBranch: context.sourceBranch,
				targetBranch: context.targetBranch,
				commitCount: context.commitCount
			});
		} catch (error) {
			context.automationSteps.push({
				step: 'branch-validation',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});
			throw error;
		}
	}

	async runQualityGates(context) {
		this.emit('qualityGatesStarted', { prId: context.prId });

		try {
			const qualityResults = await mockQualityGates.runQualityChecks({
				sourceBranch: context.sourceBranch,
				changedFiles: context.changedFiles,
				projectRoot: context.projectRoot
			});

			context.qualityResults = qualityResults;

			// Check if quality gates pass
			const qualityPassed = this.evaluateQualityGates(qualityResults);

			if (!qualityPassed && this.config.requireQualityGate) {
				this.statistics.qualityGateFailed++;
				throw new Error('Quality gates failed - PR creation blocked');
			}

			this.statistics.qualityGatePassed++;

			context.automationSteps.push({
				step: 'quality-gates',
				status: qualityPassed ? 'passed' : 'passed-with-warnings',
				timestamp: new Date().toISOString(),
				details: qualityResults.summary
			});

			this.emit('qualityGatesCompleted', {
				prId: context.prId,
				qualityResults,
				passed: qualityPassed
			});
		} catch (error) {
			context.automationSteps.push({
				step: 'quality-gates',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});

			if (this.config.requireQualityGate) {
				throw error;
			}
		}
	}

	evaluateQualityGates(qualityResults) {
		const { coverage, complexity, security, performance } = qualityResults;

		// Define quality thresholds
		const thresholds = {
			minCoverage: 80,
			maxComplexity: 10,
			maxSecurityIssues: 0,
			maxPerformanceRegression: 5
		};

		return (
			(coverage?.percentage || 100) >= thresholds.minCoverage &&
			(complexity?.average || 0) <= thresholds.maxComplexity &&
			(security?.criticalIssues || 0) <= thresholds.maxSecurityIssues &&
			(performance?.regressionPercentage || 0) <=
				thresholds.maxPerformanceRegression
		);
	}

	async generatePRContent(context) {
		this.emit('prContentGenerationStarted', { prId: context.prId });

		try {
			// Generate PR title
			context.prTitle = await mockTemplateService.generatePRTitle({
				sourceBranch: context.sourceBranch,
				targetBranch: context.targetBranch,
				taskDescription: context.taskDescription,
				commitCount: context.commitCount
			});

			// Generate PR description
			context.prDescription = await mockTemplateService.generatePRDescription({
				sourceBranch: context.sourceBranch,
				targetBranch: context.targetBranch,
				changedFiles: context.changedFiles,
				qualityResults: context.qualityResults,
				taskDescription: context.taskDescription,
				commits: context.commits
			});

			// Generate changelog if applicable
			if (context.includeChangelog) {
				context.changelog = await mockTemplateService.generateChangelog({
					commits: context.commits,
					changedFiles: context.changedFiles
				});
			}

			context.automationSteps.push({
				step: 'content-generation',
				status: 'completed',
				timestamp: new Date().toISOString(),
				details: { titleGenerated: true, descriptionGenerated: true }
			});

			this.emit('prContentGenerationCompleted', {
				prId: context.prId,
				title: context.prTitle,
				descriptionLength: context.prDescription.length
			});
		} catch (error) {
			context.automationSteps.push({
				step: 'content-generation',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});
			throw error;
		}
	}

	async createPR(context) {
		this.emit('prCreationStarted', { prId: context.prId });

		try {
			const prData = {
				title: context.prTitle,
				body: context.prDescription,
				head: context.sourceBranch,
				base: context.targetBranch,
				draft: context.isDraft || false,
				maintainer_can_modify: true
			};

			const pr = await mockGitHubService.createPullRequest(prData);

			context.githubPRNumber = pr.number;
			context.githubPRUrl = pr.html_url;

			context.automationSteps.push({
				step: 'pr-creation',
				status: 'completed',
				timestamp: new Date().toISOString(),
				details: { prNumber: pr.number, prUrl: pr.html_url }
			});

			this.emit('prCreationCompleted', {
				prId: context.prId,
				githubPR: pr
			});

			return pr;
		} catch (error) {
			context.automationSteps.push({
				step: 'pr-creation',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});
			throw error;
		}
	}

	async applyAutomationRules(context, pr) {
		this.emit('automationRulesStarted', {
			prId: context.prId,
			prNumber: pr.number
		});

		try {
			// Auto-assign reviewers
			if (this.config.autoAddReviewers) {
				const reviewers = await this.determineReviewers(context);
				if (reviewers.length > 0) {
					await mockGitHubService.addReviewers(pr.number, reviewers);
					context.reviewers = reviewers;
				}
			}

			// Auto-assign labels
			if (this.config.autoAssignLabels) {
				const labels = await this.determineLabels(context);
				if (labels.length > 0) {
					await mockGitHubService.addLabels(pr.number, labels);
					context.labels = labels;
				}
			}

			// Add quality report comment if applicable
			if (
				context.qualityResults &&
				Object.keys(context.qualityResults).length > 0
			) {
				const qualityComment = await mockTemplateService.formatQualityReport(
					context.qualityResults
				);
				await mockGitHubService.createComment(pr.number, qualityComment);
			}

			context.automationSteps.push({
				step: 'automation-rules',
				status: 'completed',
				timestamp: new Date().toISOString(),
				details: {
					reviewersAdded: context.reviewers.length,
					labelsAdded: context.labels.length,
					qualityReportAdded: !!context.qualityResults
				}
			});

			this.emit('automationRulesCompleted', {
				prId: context.prId,
				reviewers: context.reviewers,
				labels: context.labels
			});
		} catch (error) {
			context.automationSteps.push({
				step: 'automation-rules',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});
			// Don't throw - this is not a critical failure
			this.emit('automationRulesError', { prId: context.prId, error });
		}
	}

	async determineReviewers(context) {
		// Mock reviewer determination logic
		const reviewers = [];

		// Add code owners based on changed files
		if (context.changedFiles) {
			const jsFiles = context.changedFiles.filter(
				(f) => f.endsWith('.js') || f.endsWith('.ts')
			);
			if (jsFiles.length > 0) {
				reviewers.push('js-team-lead');
			}

			const testFiles = context.changedFiles.filter((f) =>
				f.includes('.test.')
			);
			if (testFiles.length > 0) {
				reviewers.push('qa-lead');
			}
		}

		// Add quality reviewers if quality issues found
		if (context.qualityResults?.hasIssues) {
			reviewers.push('quality-engineer');
		}

		return [...new Set(reviewers)]; // Remove duplicates
	}

	async determineLabels(context) {
		const labels = [];

		// Add type labels based on changes
		if (context.changedFiles) {
			const hasFeatureChanges = context.changedFiles.some((f) =>
				f.includes('feature')
			);
			const hasBugFixes =
				context.prTitle?.toLowerCase().includes('fix') ||
				context.taskDescription?.toLowerCase().includes('fix');
			const hasTests = context.changedFiles.some((f) => f.includes('.test.'));

			if (hasFeatureChanges) labels.push('enhancement');
			if (hasBugFixes) labels.push('bug');
			if (hasTests) labels.push('testing');
		}

		// Add size labels based on changes
		const changeSize = context.changedFiles?.length || 0;
		if (changeSize <= 3) labels.push('size/small');
		else if (changeSize <= 10) labels.push('size/medium');
		else labels.push('size/large');

		// Add quality labels
		if (context.qualityResults) {
			if (context.qualityResults.coverage?.percentage >= 90) {
				labels.push('high-coverage');
			}
			if (context.qualityResults.security?.issues === 0) {
				labels.push('security-approved');
			}
		}

		return labels;
	}

	async sendNotifications(context, pr) {
		this.emit('notificationsStarted', {
			prId: context.prId,
			prNumber: pr.number
		});

		try {
			// Send PR created notification
			await mockNotificationService.sendPRCreated({
				prNumber: pr.number,
				prUrl: pr.html_url,
				author: context.author,
				reviewers: context.reviewers,
				qualityStatus: context.qualityResults ? 'checked' : 'skipped'
			});

			// Send review requests
			if (context.reviewers.length > 0) {
				for (const reviewer of context.reviewers) {
					await mockNotificationService.sendReviewRequest({
						prNumber: pr.number,
						prUrl: pr.html_url,
						reviewer,
						author: context.author
					});
				}
			}

			context.automationSteps.push({
				step: 'notifications',
				status: 'completed',
				timestamp: new Date().toISOString(),
				details: {
					prNotificationSent: true,
					reviewRequestsSent: context.reviewers.length
				}
			});

			this.emit('notificationsCompleted', {
				prId: context.prId,
				notificationsSent: 1 + context.reviewers.length
			});
		} catch (error) {
			context.automationSteps.push({
				step: 'notifications',
				status: 'failed',
				timestamp: new Date().toISOString(),
				error: error.message
			});
			// Don't throw - notifications are not critical
			this.emit('notificationsError', { prId: context.prId, error });
		}
	}

	async executeWorkflow(workflowName, context) {
		const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		try {
			this.emit('workflowStarted', { workflowId, workflowName, context });

			const result = await mockWorkflowEngine.executeWorkflow(workflowName, {
				...context,
				workflowId
			});

			this.emit('workflowCompleted', { workflowId, result });

			return {
				success: true,
				workflowId,
				result
			};
		} catch (error) {
			this.emit('workflowError', { workflowId, error });

			return {
				success: false,
				workflowId,
				error: error.message
			};
		}
	}

	updateStatistics(context, processingTime, success) {
		const total = this.statistics.totalPRs;
		const current = this.statistics.averageProcessingTime;
		this.statistics.averageProcessingTime =
			(current * (total - 1) + processingTime) / total;

		if (success) {
			this.statistics.successfulMerges++;
		}
	}

	getStatistics() {
		return { ...this.statistics };
	}

	async reset() {
		this.workflows.clear();
		this.qualityGates.clear();
		this.templates.clear();
		this.automationRules.clear();
		this.statistics = {
			totalPRs: 0,
			automatedPRs: 0,
			qualityGatePassed: 0,
			qualityGateFailed: 0,
			averageProcessingTime: 0,
			successfulMerges: 0
		};
	}
}

describe('PR Automation Integration Suite', () => {
	let prCoordinator;

	beforeEach(async () => {
		prCoordinator = new MockPRAutomationCoordinator();

		jest.clearAllMocks();

		// Setup mock service responses
		mockGitHubService.getBranches.mockResolvedValue([
			'main',
			'feature/test',
			'develop'
		]);
		mockGitHubService.getCommits.mockResolvedValue([
			{ sha: 'abc123', message: 'feat: implement new feature' },
			{ sha: 'def456', message: 'test: add unit tests' }
		]);

		mockGitHubService.createPullRequest.mockResolvedValue({
			number: 123,
			html_url: 'https://github.com/repo/pull/123',
			id: 456789,
			title: 'Test PR',
			body: 'Test description'
		});

		mockQualityGates.runQualityChecks.mockResolvedValue({
			coverage: { percentage: 85, lines: { covered: 850, total: 1000 } },
			complexity: { average: 6, max: 12 },
			security: { criticalIssues: 0, issues: [] },
			performance: { regressionPercentage: 2 },
			summary: { passed: true, warnings: 1, errors: 0 }
		});

		mockTemplateService.generatePRTitle.mockResolvedValue(
			'feat: Implement user authentication feature'
		);
		mockTemplateService.generatePRDescription.mockResolvedValue(`
## Summary
This PR implements user authentication feature with JWT tokens.

## Changes
- Add login/logout endpoints
- Implement JWT token validation
- Add user session management

## Quality Report
✅ Coverage: 85%
✅ Security: No issues
⚠️ Complexity: 6 (acceptable)
    `);

		mockTemplateService.formatQualityReport.mockResolvedValue(`
## Quality Analysis Report

### Coverage
- **Line Coverage**: 85%
- **Branch Coverage**: 82%

### Security
- **Critical Issues**: 0
- **Security Score**: 95/100

### Performance
- **Regression**: 2% (acceptable)
    `);

		mockNotificationService.sendPRCreated.mockResolvedValue(true);
		mockNotificationService.sendReviewRequest.mockResolvedValue(true);

		mockWorkflowEngine.executeWorkflow.mockResolvedValue({
			status: 'completed',
			steps: ['validate', 'test', 'deploy'],
			duration: 300
		});
	});

	afterEach(async () => {
		await prCoordinator.reset();
	});

	describe('Basic PR Creation Automation', () => {
		test('should create automated PR successfully', async () => {
			const context = {
				sourceBranch: 'feature/test',
				targetBranch: 'main',
				taskDescription: 'Implement user authentication',
				changedFiles: ['src/auth.js', 'src/login.js', 'tests/auth.test.js'],
				author: 'developer@example.com',
				projectRoot: '/test/project'
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.success).toBe(true);
			expect(result.pr.number).toBe(123);
			expect(mockGitHubService.createPullRequest).toHaveBeenCalled();
			expect(result.automationSteps).toHaveLength(6); // All automation steps completed
		});

		test('should handle branch validation errors', async () => {
			mockGitHubService.getBranches.mockResolvedValue(['main', 'develop']);

			const context = {
				sourceBranch: 'feature/nonexistent',
				targetBranch: 'main',
				taskDescription: 'Test feature'
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.success).toBe(false);
			expect(result.error).toContain(
				'Source branch feature/nonexistent not found'
			);
		});

		test('should generate comprehensive PR content', async () => {
			const context = {
				sourceBranch: 'feature/auth',
				targetBranch: 'main',
				taskDescription: 'Implement user authentication with JWT',
				changedFiles: ['src/auth.js', 'src/middleware/jwt.js'],
				commitCount: 5,
				includeChangelog: true
			};

			await prCoordinator.createAutomatedPR(context);

			expect(mockTemplateService.generatePRTitle).toHaveBeenCalledWith(
				expect.objectContaining({
					sourceBranch: 'feature/auth',
					targetBranch: 'main',
					taskDescription: 'Implement user authentication with JWT'
				})
			);

			expect(mockTemplateService.generatePRDescription).toHaveBeenCalledWith(
				expect.objectContaining({
					changedFiles: ['src/auth.js', 'src/middleware/jwt.js'],
					qualityResults: expect.any(Object)
				})
			);
		});
	});

	describe('Quality Gates Integration', () => {
		test('should run quality gates before PR creation', async () => {
			const context = {
				sourceBranch: 'feature/test',
				targetBranch: 'main',
				changedFiles: ['src/feature.js'],
				projectRoot: '/test/project'
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(mockQualityGates.runQualityChecks).toHaveBeenCalledWith({
				sourceBranch: 'feature/test',
				changedFiles: ['src/feature.js'],
				projectRoot: '/test/project'
			});

			expect(result.qualityResults).toBeDefined();
			expect(result.qualityResults.coverage.percentage).toBe(85);
		});

		test('should block PR creation on quality gate failure', async () => {
			mockQualityGates.runQualityChecks.mockResolvedValue({
				coverage: { percentage: 45 }, // Below threshold
				complexity: { average: 15 }, // Above threshold
				security: { criticalIssues: 2 }, // Has critical issues
				summary: { passed: false, errors: 3 }
			});

			const context = {
				sourceBranch: 'feature/poor-quality',
				targetBranch: 'main',
				changedFiles: ['src/bad-code.js']
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.success).toBe(false);
			expect(result.error).toContain('Quality gates failed');
			expect(mockGitHubService.createPullRequest).not.toHaveBeenCalled();
		});

		test('should allow PR creation with warnings when quality gate passes', async () => {
			mockQualityGates.runQualityChecks.mockResolvedValue({
				coverage: { percentage: 82 }, // Just above threshold
				complexity: { average: 8 }, // Acceptable
				security: { criticalIssues: 0 }, // No critical issues
				performance: { regressionPercentage: 3 },
				summary: { passed: true, warnings: 2, errors: 0 }
			});

			const context = {
				sourceBranch: 'feature/acceptable-quality',
				targetBranch: 'main',
				changedFiles: ['src/code.js']
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.success).toBe(true);
			expect(result.pr.number).toBe(123);
			expect(result.qualityResults.summary.warnings).toBe(2);
		});

		test('should add quality report as PR comment', async () => {
			const context = {
				sourceBranch: 'feature/test',
				targetBranch: 'main',
				changedFiles: ['src/feature.js']
			};

			await prCoordinator.createAutomatedPR(context);

			expect(mockTemplateService.formatQualityReport).toHaveBeenCalledWith(
				expect.objectContaining({
					coverage: expect.any(Object),
					complexity: expect.any(Object),
					security: expect.any(Object)
				})
			);

			expect(mockGitHubService.createComment).toHaveBeenCalledWith(
				123,
				expect.stringContaining('Quality Analysis Report')
			);
		});
	});

	describe('Automation Rules Application', () => {
		test('should auto-assign reviewers based on changed files', async () => {
			const context = {
				sourceBranch: 'feature/auth',
				targetBranch: 'main',
				changedFiles: ['src/auth.js', 'tests/auth.test.js', 'docs/api.md'],
				qualityResults: { hasIssues: true }
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.reviewers).toEqual(
				expect.arrayContaining(['js-team-lead', 'qa-lead', 'quality-engineer'])
			);

			expect(mockGitHubService.addReviewers).toHaveBeenCalledWith(
				123,
				expect.arrayContaining(['js-team-lead', 'qa-lead'])
			);
		});

		test('should auto-assign labels based on PR characteristics', async () => {
			const context = {
				sourceBranch: 'feature/user-management',
				targetBranch: 'main',
				prTitle: 'feat: Add user management feature',
				changedFiles: ['src/users.js', 'src/roles.js', 'tests/users.test.js'],
				qualityResults: {
					coverage: { percentage: 92 },
					security: { issues: 0 }
				}
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.labels).toEqual(
				expect.arrayContaining([
					'enhancement',
					'testing',
					'size/small',
					'high-coverage',
					'security-approved'
				])
			);

			expect(mockGitHubService.addLabels).toHaveBeenCalledWith(
				123,
				expect.arrayContaining(['enhancement', 'testing'])
			);
		});

		test('should handle automation rule failures gracefully', async () => {
			mockGitHubService.addReviewers.mockRejectedValue(
				new Error('GitHub API error')
			);

			const context = {
				sourceBranch: 'feature/test',
				targetBranch: 'main',
				changedFiles: ['src/test.js']
			};

			const result = await prCoordinator.createAutomatedPR(context);

			// PR should still be created successfully despite reviewer assignment failure
			expect(result.success).toBe(true);
			expect(result.pr.number).toBe(123);

			// Check that automation step recorded the failure
			const automationStep = result.automationSteps.find(
				(step) => step.step === 'automation-rules'
			);
			expect(automationStep.status).toBe('failed');
		});
	});

	describe('Notification Integration', () => {
		test('should send comprehensive notifications', async () => {
			const context = {
				sourceBranch: 'feature/notifications',
				targetBranch: 'main',
				author: 'developer@example.com',
				changedFiles: ['src/feature.js']
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(mockNotificationService.sendPRCreated).toHaveBeenCalledWith({
				prNumber: 123,
				prUrl: 'https://github.com/repo/pull/123',
				author: 'developer@example.com',
				reviewers: expect.any(Array),
				qualityStatus: 'checked'
			});

			// Should send review requests to assigned reviewers
			expect(mockNotificationService.sendReviewRequest).toHaveBeenCalled();
		});

		test('should handle notification failures gracefully', async () => {
			mockNotificationService.sendPRCreated.mockRejectedValue(
				new Error('Email service down')
			);

			const context = {
				sourceBranch: 'feature/test',
				targetBranch: 'main',
				author: 'developer@example.com'
			};

			const result = await prCoordinator.createAutomatedPR(context);

			// PR should still be created successfully despite notification failure
			expect(result.success).toBe(true);
			expect(result.pr.number).toBe(123);
		});
	});

	describe('Workflow Engine Integration', () => {
		test('should execute custom workflows', async () => {
			const context = {
				sourceBranch: 'feature/workflow-test',
				targetBranch: 'main',
				workflowConfig: {
					steps: ['validate', 'test', 'deploy-staging']
				}
			};

			const result = await prCoordinator.executeWorkflow(
				'pr-validation',
				context
			);

			expect(result.success).toBe(true);
			expect(mockWorkflowEngine.executeWorkflow).toHaveBeenCalledWith(
				'pr-validation',
				expect.objectContaining({
					...context,
					workflowId: expect.any(String)
				})
			);
		});

		test('should handle workflow execution failures', async () => {
			mockWorkflowEngine.executeWorkflow.mockRejectedValue(
				new Error('Workflow failed')
			);

			const context = {
				sourceBranch: 'feature/failing-workflow',
				targetBranch: 'main'
			};

			const result = await prCoordinator.executeWorkflow(
				'failing-workflow',
				context
			);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Workflow failed');
		});
	});

	describe('Complex Integration Scenarios', () => {
		test('should handle complete PR automation with all features', async () => {
			const context = {
				sourceBranch: 'feature/complete-auth-system',
				targetBranch: 'main',
				taskDescription:
					'Implement complete authentication system with JWT, OAuth, and 2FA',
				changedFiles: [
					'src/auth/jwt.js',
					'src/auth/oauth.js',
					'src/auth/2fa.js',
					'src/middleware/auth.js',
					'tests/auth/jwt.test.js',
					'tests/auth/oauth.test.js',
					'tests/auth/2fa.test.js',
					'docs/authentication.md'
				],
				author: 'lead-developer@example.com',
				projectRoot: '/project',
				includeChangelog: true,
				isDraft: false
			};

			const result = await prCoordinator.createAutomatedPR(context);

			expect(result.success).toBe(true);
			expect(result.pr.number).toBe(123);

			// Verify all automation steps completed
			expect(result.automationSteps).toHaveLength(6);
			expect(
				result.automationSteps.every(
					(step) => step.status === 'completed' || step.status === 'passed'
				)
			).toBe(true);

			// Verify reviewers assigned based on file types
			expect(result.reviewers).toEqual(
				expect.arrayContaining(['js-team-lead', 'qa-lead'])
			);

			// Verify labels assigned
			expect(result.labels).toEqual(
				expect.arrayContaining(['enhancement', 'testing', 'size/large'])
			);

			// Verify quality gates passed
			expect(result.qualityResults.summary.passed).toBe(true);
		});

		test('should track comprehensive statistics', async () => {
			// Create multiple PRs to test statistics
			const contexts = [
				{
					sourceBranch: 'feature/stats-1',
					targetBranch: 'main',
					changedFiles: ['src/feature1.js']
				},
				{
					sourceBranch: 'feature/stats-2',
					targetBranch: 'main',
					changedFiles: ['src/feature2.js']
				},
				{
					sourceBranch: 'feature/stats-3',
					targetBranch: 'main',
					changedFiles: ['src/feature3.js']
				}
			];

			for (const context of contexts) {
				await prCoordinator.createAutomatedPR(context);
			}

			const stats = prCoordinator.getStatistics();

			expect(stats.totalPRs).toBe(3);
			expect(stats.automatedPRs).toBe(3);
			expect(stats.qualityGatePassed).toBe(3);
			expect(stats.qualityGateFailed).toBe(0);
			expect(stats.averageProcessingTime).toBeGreaterThan(0);
		});
	});

	describe('Performance and Error Handling', () => {
		test('should handle concurrent PR creation requests', async () => {
			const contexts = Array.from({ length: 5 }, (_, i) => ({
				sourceBranch: `feature/concurrent-${i}`,
				targetBranch: 'main',
				changedFiles: [`src/feature${i}.js`]
			}));

			const promises = contexts.map((context) =>
				prCoordinator.createAutomatedPR(context)
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			expect(results.every((r) => r.success)).toBe(true);
			expect(results.every((r) => r.pr.number === 123)).toBe(true); // Mock returns same PR number
		});

		test('should emit comprehensive automation events', async () => {
			const events = [];

			prCoordinator.on('prAutomationStarted', (data) =>
				events.push({ type: 'started', data })
			);
			prCoordinator.on('qualityGatesCompleted', (data) =>
				events.push({ type: 'qualityCompleted', data })
			);
			prCoordinator.on('prCreationCompleted', (data) =>
				events.push({ type: 'prCreated', data })
			);
			prCoordinator.on('prAutomationCompleted', (data) =>
				events.push({ type: 'completed', data })
			);

			const context = {
				sourceBranch: 'feature/events-test',
				targetBranch: 'main',
				changedFiles: ['src/test.js']
			};

			await prCoordinator.createAutomatedPR(context);

			expect(events.length).toBeGreaterThan(3);
			expect(events.map((e) => e.type)).toContain('started');
			expect(events.map((e) => e.type)).toContain('completed');
		});
	});
});
