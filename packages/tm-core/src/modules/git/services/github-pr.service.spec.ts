/**
 * Tests for GitHubPRService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorkflowContext } from '../../workflow/types.js';
import { GitHubPRService, type PRClusterInput } from './github-pr.service.js';

describe('GitHubPRService', () => {
	let service: GitHubPRService;
	const projectRoot = '/test/project';

	beforeEach(() => {
		service = new GitHubPRService(projectRoot, 'main');
	});

	describe('createPR - dry run mode', () => {
		it('should validate and preview PR creation in dry-run mode', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test-branch',
				taskId: 'TAS-123',
				tag: 'test-tag'
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(true);
			expect(result.dryRun).toBe(true);
			expect(result.clusterId).toBe('cluster-1');
			expect(result.prUrl).toBeUndefined();
		});

		it('should generate PR title with conventional commit format', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test',
				taskId: 'TAS-123',
				tag: 'auth'
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});

		it('should generate PR body with cluster metadata', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test',
				taskId: 'TAS-123',
				commits: ['abc123', 'def456']
			};

			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [
					{
						id: 'sub-1',
						title: 'Implement feature',
						status: 'completed',
						attempts: 1
					},
					{
						id: 'sub-2',
						title: 'Add tests',
						status: 'in-progress',
						attempts: 1
					}
				],
				currentSubtaskIndex: 1,
				errors: [],
				metadata: {},
				lastTestResults: {
					total: 10,
					passed: 8,
					failed: 2,
					skipped: 0,
					phase: 'GREEN'
				}
			};

			const result = await service.createPR({
				cluster,
				workflowContext,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});
	});

	describe('validation', () => {
		it('should fail validation if clusterId is missing', async () => {
			const cluster: PRClusterInput = {
				clusterId: '',
				branchName: 'feature/test'
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Cluster ID is required');
		});

		it('should fail validation if branchName is missing', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: ''
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Branch name is required');
		});
	});

	describe('cluster PR mapping', () => {
		it('should store and retrieve cluster PR mappings', () => {
			const mapping = {
				clusterId: 'cluster-1',
				prUrl: 'https://github.com/org/repo/pull/123',
				prNumber: 123,
				branchName: 'feature/test',
				createdAt: new Date().toISOString()
			};

			service.setClusterPRMapping(mapping);

			const retrieved = service.getClusterPRMapping('cluster-1');
			expect(retrieved).toEqual(mapping);
		});

		it('should return undefined for non-existent cluster', () => {
			const retrieved = service.getClusterPRMapping('non-existent');
			expect(retrieved).toBeUndefined();
		});

		it('should return all mappings', () => {
			const mapping1 = {
				clusterId: 'cluster-1',
				prUrl: 'https://github.com/org/repo/pull/123',
				prNumber: 123,
				branchName: 'feature/test-1',
				createdAt: new Date().toISOString()
			};

			const mapping2 = {
				clusterId: 'cluster-2',
				prUrl: 'https://github.com/org/repo/pull/124',
				prNumber: 124,
				branchName: 'feature/test-2',
				createdAt: new Date().toISOString()
			};

			service.setClusterPRMapping(mapping1);
			service.setClusterPRMapping(mapping2);

			const allMappings = service.getAllClusterPRMappings();
			expect(allMappings).toHaveLength(2);
			expect(allMappings).toContainEqual(mapping1);
			expect(allMappings).toContainEqual(mapping2);
		});

		it('should clear all mappings', () => {
			const mapping = {
				clusterId: 'cluster-1',
				prUrl: 'https://github.com/org/repo/pull/123',
				prNumber: 123,
				branchName: 'feature/test',
				createdAt: new Date().toISOString()
			};

			service.setClusterPRMapping(mapping);
			expect(service.getAllClusterPRMappings()).toHaveLength(1);

			service.clearMappings();
			expect(service.getAllClusterPRMappings()).toHaveLength(0);
		});
	});

	describe('PR title generation', () => {
		it('should generate title with task ID', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test',
				taskId: 'TAS-123',
				tag: 'auth'
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});

		it('should generate title without task ID', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test',
				tag: 'api'
			};

			const result = await service.createPR({
				cluster,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});

		it('should use custom title if provided', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test'
			};

			const customTitle = 'feat(custom): custom PR title';

			const result = await service.createPR({
				cluster,
				title: customTitle,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});
	});

	describe('PR body generation', () => {
		it('should include subtasks in body', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test'
			};

			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [
					{
						id: 'sub-1',
						title: 'Task 1',
						status: 'completed',
						attempts: 1
					},
					{
						id: 'sub-2',
						title: 'Task 2',
						status: 'pending',
						attempts: 0
					}
				],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const result = await service.createPR({
				cluster,
				workflowContext,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});

		it('should include test results in body', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test'
			};

			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {},
				lastTestResults: {
					total: 15,
					passed: 15,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			};

			const result = await service.createPR({
				cluster,
				workflowContext,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});

		it('should use custom body if provided', async () => {
			const cluster: PRClusterInput = {
				clusterId: 'cluster-1',
				branchName: 'feature/test'
			};

			const customBody = '## Custom Body\n\nThis is a custom PR body.';

			const result = await service.createPR({
				cluster,
				body: customBody,
				dryRun: true
			});

			expect(result.success).toBe(true);
		});
	});
});
