/**
 * Tests for ClusterPRIntegration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	ClusterPRIntegration,
	type ClusterCompletionEvent,
	type ClusterPRIntegrationOptions
} from './cluster-pr-integration.js';
import type { WorkflowContext, WorkflowEventData } from '../types.js';

describe('ClusterPRIntegration', () => {
	let integration: ClusterPRIntegration;
	let options: ClusterPRIntegrationOptions;

	beforeEach(() => {
		options = {
			projectRoot: '/test/project',
			baseBranch: 'main',
			dryRun: true, // Always dry-run in tests
			autoMerge: false,
			labels: ['automated'],
			draft: false
		};

		integration = new ClusterPRIntegration(options);
	});

	describe('handleClusterCompletion', () => {
		it('should handle cluster completion and create PR', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [
					{
						id: 'sub-1',
						title: 'Implement feature',
						status: 'completed',
						attempts: 1
					}
				],
				currentSubtaskIndex: 0,
				branchName: 'feature/test',
				tag: 'sprint-1',
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-1',
				workflowContext,
				branchName: 'feature/test',
				commits: ['abc123', 'def456'],
				metadata: {
					taskTitle: 'Test Feature'
				}
			};

			const result = await integration.handleClusterCompletion(event);

			expect(result.success).toBe(true);
			expect(result.clusterId).toBe('cluster-1');
			expect(result.prResult).toBeDefined();
			expect(result.prResult?.dryRun).toBe(true);
		});

		it('should handle errors gracefully', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: '',
				workflowContext,
				branchName: '' // Invalid: empty branch name
			};

			const result = await integration.handleClusterCompletion(event);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.clusterId).toBe('');
		});

		it('should include workflow context in PR', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-456',
				subtasks: [
					{
						id: 'sub-1',
						title: 'Add tests',
						status: 'completed',
						attempts: 1
					},
					{
						id: 'sub-2',
						title: 'Update docs',
						status: 'completed',
						attempts: 1
					}
				],
				currentSubtaskIndex: 1,
				branchName: 'feature/docs',
				errors: [],
				metadata: {},
				lastTestResults: {
					total: 10,
					passed: 10,
					failed: 0,
					skipped: 0,
					phase: 'GREEN'
				}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-2',
				workflowContext,
				branchName: 'feature/docs',
				commits: ['commit1', 'commit2', 'commit3']
			};

			const result = await integration.handleClusterCompletion(event);

			expect(result.success).toBe(true);
			expect(result.prResult).toBeDefined();
		});
	});

	describe('handleWorkflowEvent', () => {
		it('should handle FINALIZE phase exit event', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-789',
				subtasks: [],
				currentSubtaskIndex: 0,
				branchName: 'feature/finalize',
				errors: [],
				metadata: {}
			};

			const event: WorkflowEventData = {
				type: 'phase:exited',
				phase: 'FINALIZE',
				timestamp: new Date(),
				data: {}
			};

			const result = await integration.handleWorkflowEvent(
				event,
				workflowContext
			);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
		});

		it('should ignore non-finalize events', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-789',
				subtasks: [],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const event: WorkflowEventData = {
				type: 'phase:exited',
				phase: 'SUBTASK_LOOP',
				timestamp: new Date(),
				data: {}
			};

			const result = await integration.handleWorkflowEvent(
				event,
				workflowContext
			);

			expect(result).toBeNull();
		});

		it('should ignore phase:entered events', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-789',
				subtasks: [],
				currentSubtaskIndex: 0,
				errors: [],
				metadata: {}
			};

			const event: WorkflowEventData = {
				type: 'phase:entered',
				phase: 'FINALIZE',
				timestamp: new Date(),
				data: {}
			};

			const result = await integration.handleWorkflowEvent(
				event,
				workflowContext
			);

			expect(result).toBeNull();
		});
	});

	describe('PR mappings', () => {
		it('should retrieve all PR mappings', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [],
				currentSubtaskIndex: 0,
				branchName: 'feature/test',
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-1',
				workflowContext,
				branchName: 'feature/test',
				commits: []
			};

			await integration.handleClusterCompletion(event);

			const mappings = integration.getAllPRMappings();
			expect(mappings).toBeDefined();
			expect(Array.isArray(mappings)).toBe(true);
		});

		it('should not store PR mapping for dry-run completions', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-123',
				subtasks: [],
				currentSubtaskIndex: 0,
				branchName: 'feature/test',
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-specific',
				workflowContext,
				branchName: 'feature/test',
				commits: []
			};

			await integration.handleClusterCompletion(event);

			// Dry runs intentionally skip mapping storage to avoid
			// placeholder values misleading traceability consumers
			const mapping = integration.getPRMapping('cluster-specific');
			expect(mapping).toBeUndefined();
		});
	});

	describe('options management', () => {
		it('should update dry-run mode at runtime', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-dry',
				subtasks: [
					{
						id: 'sub-1',
						title: 'Test subtask',
						status: 'completed',
						attempts: 1
					}
				],
				currentSubtaskIndex: 0,
				branchName: 'feature/dry-run-toggle',
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-dry-toggle',
				workflowContext,
				branchName: 'feature/dry-run-toggle',
				commits: ['abc123']
			};

			// Initially dry-run is true, so PR creation should succeed with dryRun flag
			const dryResult = await integration.handleClusterCompletion(event);
			expect(dryResult.success).toBe(true);
			expect(dryResult.prResult?.dryRun).toBe(true);

			// After toggling dry-run off, gh CLI is unavailable in tests so it should fail
			integration.setDryRun(false);
			const liveResult = await integration.handleClusterCompletion({
				...event,
				clusterId: 'cluster-dry-toggle-2'
			});
			expect(liveResult.success).toBe(false);
			expect(liveResult.prResult?.dryRun).toBe(false);

			// Toggle back to dry-run, should succeed again
			integration.setDryRun(true);
			const dryAgainResult = await integration.handleClusterCompletion({
				...event,
				clusterId: 'cluster-dry-toggle-3'
			});
			expect(dryAgainResult.success).toBe(true);
			expect(dryAgainResult.prResult?.dryRun).toBe(true);
		});

		it('should update options at runtime', async () => {
			// Verify dryRun option change is observable through behavior
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-opts',
				subtasks: [],
				currentSubtaskIndex: 0,
				branchName: 'feature/opts',
				errors: [],
				metadata: {}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-opts',
				workflowContext,
				branchName: 'feature/opts',
				commits: []
			};

			// Update dryRun to false via updateOptions - should fail since gh CLI is unavailable
			integration.updateOptions({ dryRun: false });
			const liveResult = await integration.handleClusterCompletion(event);
			expect(liveResult.success).toBe(false);

			// Restore dry-run and verify it works again
			integration.updateOptions({ dryRun: true });
			const dryResult = await integration.handleClusterCompletion({
				...event,
				clusterId: 'cluster-opts-2'
			});
			expect(dryResult.success).toBe(true);
			expect(dryResult.prResult?.dryRun).toBe(true);

			// Bracket notation: autoMerge and labels only affect non-dry-run gh CLI
			// calls, so their effect cannot be observed without mocking the GitHub API.
			integration.updateOptions({
				autoMerge: true,
				labels: ['hotfix', 'urgent']
			});
			expect(integration['options'].autoMerge).toBe(true);
			expect(integration['options'].labels).toEqual(['hotfix', 'urgent']);
		});
	});

	describe('metadata handling', () => {
		it('should merge cluster and workflow metadata', async () => {
			const workflowContext: WorkflowContext = {
				taskId: 'TAS-999',
				subtasks: [],
				currentSubtaskIndex: 0,
				branchName: 'feature/meta',
				errors: [],
				metadata: {
					workflowField: 'workflow-value'
				}
			};

			const event: ClusterCompletionEvent = {
				clusterId: 'cluster-meta',
				workflowContext,
				branchName: 'feature/meta',
				commits: [],
				metadata: {
					clusterField: 'cluster-value',
					taskTitle: 'Test Task'
				}
			};

			const result = await integration.handleClusterCompletion(event);

			expect(result.success).toBe(true);
		});
	});
});
