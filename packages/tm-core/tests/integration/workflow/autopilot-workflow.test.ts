/**
 * @fileoverview Integration tests for autopilot workflow state machine
 *
 * Tests the full workflow lifecycle through WorkflowService:
 * - Start workflow and verify state file creation
 * - TDD phase transitions (RED → GREEN → COMMIT)
 * - State persistence and resume
 * - Auto-complete subtask when RED phase has 0 failures
 * - Workflow finalization and abort
 *
 * These tests create temporary project directories and verify the workflow
 * state machine operates correctly with actual file I/O.
 *
 * NOTE: Workflow state is stored in ~/.taskmaster/{project-id}/sessions/
 * based on the project path. Tests clean up their state files in afterEach.
 *
 * @integration
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to reduce noise in tests
vi.mock('../../../src/common/logger/index.js', () => ({
	getLogger: () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn().mockReturnThis()
	})
}));

import { WorkflowStateManager } from '../../../src/modules/workflow/managers/workflow-state-manager.js';
import { WorkflowService } from '../../../src/modules/workflow/services/workflow.service.js';
import type { WorkflowState } from '../../../src/modules/workflow/types.js';

// Store original HOME to restore after tests
const originalHome = process.env.HOME;

describe('Autopilot Workflow Integration', () => {
	let testProjectDir: string;
	let testHomeDir: string;
	let stateManager: WorkflowStateManager;
	let workflowService: WorkflowService;

	/**
	 * Read the workflow state file directly from disk
	 */
	const readWorkflowState = (): WorkflowState | null => {
		const statePath = stateManager.getStatePath();
		try {
			const content = fs.readFileSync(statePath, 'utf-8');
			return JSON.parse(content);
		} catch {
			return null;
		}
	};

	/**
	 * Check if workflow state file exists
	 */
	const workflowStateExists = (): boolean => {
		return fs.existsSync(stateManager.getStatePath());
	};

	/**
	 * Get the expected state file path
	 */
	const getExpectedStatePath = (): string => {
		return stateManager.getStatePath();
	};

	beforeEach(() => {
		// Create temp directories for isolation
		testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-workflow-home-'));
		testProjectDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'tm-workflow-project-')
		);

		// Override HOME so os.homedir() returns our temp directory
		// This prevents tests from polluting the real ~/.taskmaster/
		process.env.HOME = testHomeDir;

		// Create state manager AFTER setting HOME (uses os.homedir() internally)
		stateManager = new WorkflowStateManager(testProjectDir);

		// Initialize git in the project directory (required for workflow)
		execSync('git init', { cwd: testProjectDir, stdio: 'pipe' });
		execSync('git config user.email "test@test.com"', {
			cwd: testProjectDir,
			stdio: 'pipe'
		});
		execSync('git config user.name "Test User"', {
			cwd: testProjectDir,
			stdio: 'pipe'
		});
		// Disable GPG/SSH signing to avoid 1Password and other signing tool interference
		execSync('git config commit.gpgsign false', {
			cwd: testProjectDir,
			stdio: 'pipe'
		});

		// Create an initial commit (git needs at least one commit)
		fs.writeFileSync(
			path.join(testProjectDir, 'README.md'),
			'# Test Project\n'
		);
		execSync('git add .', { cwd: testProjectDir, stdio: 'pipe' });
		execSync('git commit -m "Initial commit"', {
			cwd: testProjectDir,
			stdio: 'pipe'
		});

		// Create workflow service
		workflowService = new WorkflowService(testProjectDir);
	});

	afterEach(() => {
		// Restore original HOME
		process.env.HOME = originalHome;

		// Clean up temp directories
		if (testProjectDir && fs.existsSync(testProjectDir)) {
			fs.rmSync(testProjectDir, { recursive: true, force: true });
		}
		if (testHomeDir && fs.existsSync(testHomeDir)) {
			fs.rmSync(testHomeDir, { recursive: true, force: true });
		}
	});

	describe('Workflow State File Location', () => {
		it('should store workflow state in isolated temp home directory', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Test Task',
				subtasks: [
					{ id: '1.1', title: 'Subtask 1', status: 'pending' },
					{ id: '1.2', title: 'Subtask 2', status: 'pending' }
				]
			});

			const statePath = getExpectedStatePath();

			// State file should be in temp home directory (not real ~/.taskmaster/)
			expect(statePath).toContain(testHomeDir);
			expect(statePath).toContain('.taskmaster');
			expect(statePath).toContain('sessions');
			expect(statePath).toContain('workflow-state.json');

			// State file should exist
			expect(workflowStateExists()).toBe(true);
		});

		it('should create project-specific directory based on project path', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Test Task',
				subtasks: [{ id: '1.1', title: 'Subtask 1', status: 'pending' }]
			});

			const statePath = getExpectedStatePath();

			// Should contain sanitized project path as identifier
			// The path should be like: ~/.taskmaster/-tmp-...-tm-workflow-project-.../sessions/workflow-state.json
			expect(statePath).toMatch(
				/\.taskmaster\/-[^/]+\/sessions\/workflow-state\.json$/
			);
		});
	});

	describe('Start Workflow', () => {
		it('should initialize workflow and create state file', async () => {
			const status = await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Implement Feature',
				subtasks: [
					{ id: '1.1', title: 'Write Tests', status: 'pending' },
					{ id: '1.2', title: 'Implement Code', status: 'pending' }
				]
			});

			expect(status.taskId).toBe('1');
			expect(status.phase).toBe('SUBTASK_LOOP');
			expect(status.tddPhase).toBe('RED');
			expect(status.currentSubtask?.id).toBe('1.1');
			expect(status.progress.total).toBe(2);
			expect(status.progress.completed).toBe(0);

			// Verify state file
			const state = readWorkflowState();
			expect(state).not.toBeNull();
			expect(state?.phase).toBe('SUBTASK_LOOP');
			expect(state?.context.taskId).toBe('1');
			expect(state?.context.currentTDDPhase).toBe('RED');
		});

		it('should create git branch with proper naming', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Add User Authentication',
				subtasks: [{ id: '1.1', title: 'Setup auth', status: 'pending' }]
			});

			const currentBranch = execSync('git branch --show-current', {
				cwd: testProjectDir,
				encoding: 'utf-8'
			}).trim();

			expect(currentBranch).toBe('tm/task-1-add-user-authentication');
		});

		it('should include tag in branch name when provided', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Feature X',
				subtasks: [{ id: '1.1', title: 'Do thing', status: 'pending' }],
				tag: 'sprint-1'
			});

			const currentBranch = execSync('git branch --show-current', {
				cwd: testProjectDir,
				encoding: 'utf-8'
			}).trim();

			expect(currentBranch).toBe('tm/sprint-1/task-1-feature-x');
		});

		it('should skip already completed subtasks', async () => {
			const status = await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Resume Task',
				subtasks: [
					{ id: '1.1', title: 'Already Done', status: 'done' },
					{ id: '1.2', title: 'Next Up', status: 'pending' }
				]
			});

			// Should start at subtask 1.2 since 1.1 is done
			expect(status.currentSubtask?.id).toBe('1.2');
			expect(status.progress.completed).toBe(1);
			expect(status.progress.current).toBe(2);
		});

		it('should reject when no subtasks to work on', async () => {
			await expect(
				workflowService.startWorkflow({
					taskId: '1',
					taskTitle: 'All Done',
					subtasks: [
						{ id: '1.1', title: 'Done 1', status: 'done' },
						{ id: '1.2', title: 'Done 2', status: 'done' }
					]
				})
			).rejects.toThrow('All subtasks for task 1 are already completed');
		});

		it('should reject when workflow already exists without force', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'First Workflow',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			// Create new service instance (simulating new command invocation)
			const newService = new WorkflowService(testProjectDir);

			await expect(
				newService.startWorkflow({
					taskId: '2',
					taskTitle: 'Second Workflow',
					subtasks: [{ id: '2.1', title: 'Task', status: 'pending' }]
				})
			).rejects.toThrow('Workflow already exists');
		});

		it('should allow force restart when workflow exists', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'First Workflow',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			// Create new service instance and force restart
			const newService = new WorkflowService(testProjectDir);

			const status = await newService.startWorkflow({
				taskId: '2',
				taskTitle: 'Second Workflow',
				subtasks: [{ id: '2.1', title: 'New Task', status: 'pending' }],
				force: true
			});

			expect(status.taskId).toBe('2');
			expect(status.currentSubtask?.id).toBe('2.1');
		});
	});

	describe('TDD Phase Transitions', () => {
		beforeEach(async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'TDD Test',
				subtasks: [
					{ id: '1.1', title: 'First Subtask', status: 'pending' },
					{ id: '1.2', title: 'Second Subtask', status: 'pending' }
				]
			});
		});

		it('should transition from RED to GREEN phase', async () => {
			// Initial state should be RED
			let status = workflowService.getStatus();
			expect(status.tddPhase).toBe('RED');

			// Complete RED phase with failing tests
			status = await workflowService.completePhase({
				total: 5,
				passed: 2,
				failed: 3,
				skipped: 0,
				phase: 'RED'
			});

			expect(status.tddPhase).toBe('GREEN');

			// Verify state file updated
			const state = readWorkflowState();
			expect(state?.context.currentTDDPhase).toBe('GREEN');
		});

		it('should transition from GREEN to COMMIT phase', async () => {
			// Complete RED phase
			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});

			// Complete GREEN phase with all tests passing
			const status = await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});

			expect(status.tddPhase).toBe('COMMIT');
		});

		it('should reject GREEN phase with failing tests', async () => {
			// Complete RED phase
			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});

			// Try to complete GREEN with failures
			await expect(
				workflowService.completePhase({
					total: 5,
					passed: 3,
					failed: 2,
					skipped: 0,
					phase: 'GREEN'
				})
			).rejects.toThrow('GREEN phase must have zero failures');
		});

		it('should advance to next subtask after COMMIT', async () => {
			// Complete full TDD cycle for first subtask
			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});

			await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});

			// Complete COMMIT phase
			const status = await workflowService.commit();

			// Should be on second subtask in RED phase
			expect(status.currentSubtask?.id).toBe('1.2');
			expect(status.tddPhase).toBe('RED');
			expect(status.progress.completed).toBe(1);
			expect(status.progress.current).toBe(2);
		});

		it('should store test results in state', async () => {
			const testResults = {
				total: 10,
				passed: 3,
				failed: 7,
				skipped: 0,
				phase: 'RED' as const
			};

			await workflowService.completePhase(testResults);

			const state = readWorkflowState();
			expect(state?.context.lastTestResults).toEqual(testResults);
		});
	});

	describe('Auto-Complete Subtask (RED with 0 failures)', () => {
		it('should auto-complete subtask when RED phase has no failures', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Auto-Complete Test',
				subtasks: [
					{ id: '1.1', title: 'Already Implemented', status: 'pending' },
					{ id: '1.2', title: 'Needs Work', status: 'pending' }
				]
			});

			// Complete RED phase with all tests passing (feature already implemented)
			const status = await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'RED'
			});

			// Should have auto-advanced to next subtask
			expect(status.currentSubtask?.id).toBe('1.2');
			expect(status.tddPhase).toBe('RED');
			expect(status.progress.completed).toBe(1);
		});
	});

	describe('Resume Workflow', () => {
		it('should resume workflow from saved state', async () => {
			// Start workflow and progress through RED phase
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Resume Test',
				subtasks: [
					{ id: '1.1', title: 'First', status: 'pending' },
					{ id: '1.2', title: 'Second', status: 'pending' }
				]
			});

			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});

			// Verify we're in GREEN phase
			expect(workflowService.getStatus().tddPhase).toBe('GREEN');

			// Create new service instance (simulating new session)
			const newService = new WorkflowService(testProjectDir);

			// Resume workflow
			const status = await newService.resumeWorkflow();

			expect(status.taskId).toBe('1');
			expect(status.phase).toBe('SUBTASK_LOOP');
			expect(status.tddPhase).toBe('GREEN'); // Should resume in GREEN phase
			expect(status.currentSubtask?.id).toBe('1.1');
		});

		it('should preserve progress when resuming', async () => {
			// Start workflow and complete first subtask
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Progress Test',
				subtasks: [
					{ id: '1.1', title: 'First', status: 'pending' },
					{ id: '1.2', title: 'Second', status: 'pending' }
				]
			});

			// Complete first subtask
			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});
			await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});
			await workflowService.commit();

			// Resume in new session
			const newService = new WorkflowService(testProjectDir);
			const status = await newService.resumeWorkflow();

			expect(status.progress.completed).toBe(1);
			expect(status.progress.current).toBe(2);
			expect(status.currentSubtask?.id).toBe('1.2');
		});

		it('should error when no workflow exists to resume', async () => {
			await expect(workflowService.resumeWorkflow()).rejects.toThrow(
				'Workflow state file not found'
			);
		});
	});

	describe('Finalize Workflow', () => {
		it('should finalize when all subtasks are complete', async () => {
			// Start workflow with single subtask
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Finalize Test',
				subtasks: [{ id: '1.1', title: 'Only Task', status: 'pending' }]
			});

			// Complete the subtask
			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});
			await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});

			// Make a commit in git to clean working tree
			fs.writeFileSync(
				path.join(testProjectDir, 'feature.ts'),
				'export const x = 1;\n'
			);
			execSync('git add .', { cwd: testProjectDir, stdio: 'pipe' });
			execSync('git commit -m "Implement feature"', {
				cwd: testProjectDir,
				stdio: 'pipe'
			});

			// Complete commit phase
			await workflowService.commit();

			// Should now be in FINALIZE phase
			let status = workflowService.getStatus();
			expect(status.phase).toBe('FINALIZE');

			// Finalize workflow
			status = await workflowService.finalizeWorkflow();

			expect(status.phase).toBe('COMPLETE');
			expect(status.progress.percentage).toBe(100);
		});

		it('should reject finalize with uncommitted changes', async () => {
			// Start and complete all subtasks
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Dirty Tree Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			await workflowService.completePhase({
				total: 1,
				passed: 0,
				failed: 1,
				skipped: 0,
				phase: 'RED'
			});
			await workflowService.completePhase({
				total: 1,
				passed: 1,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});
			await workflowService.commit();

			// Create uncommitted changes
			fs.writeFileSync(
				path.join(testProjectDir, 'uncommitted.ts'),
				'const x = 1;\n'
			);

			// Should fail to finalize
			await expect(workflowService.finalizeWorkflow()).rejects.toThrow(
				'working tree has uncommitted changes'
			);
		});
	});

	describe('Abort Workflow', () => {
		it('should abort workflow and delete state file', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Abort Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			expect(workflowStateExists()).toBe(true);

			await workflowService.abortWorkflow();

			expect(workflowStateExists()).toBe(false);
		});

		it('should not error when aborting non-existent workflow', async () => {
			// Should not throw
			await expect(workflowService.abortWorkflow()).resolves.not.toThrow();
		});
	});

	describe('Next Action Recommendations', () => {
		it('should recommend correct action for RED phase', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Next Action Test',
				subtasks: [{ id: '1.1', title: 'Write auth tests', status: 'pending' }]
			});

			const nextAction = workflowService.getNextAction();

			expect(nextAction.action).toBe('generate_test');
			expect(nextAction.tddPhase).toBe('RED');
			expect(nextAction.subtask?.id).toBe('1.1');
			expect(nextAction.nextSteps).toContain('Write failing tests');
		});

		it('should recommend correct action for GREEN phase', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Next Action Test',
				subtasks: [{ id: '1.1', title: 'Implement feature', status: 'pending' }]
			});

			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});

			const nextAction = workflowService.getNextAction();

			expect(nextAction.action).toBe('implement_code');
			expect(nextAction.tddPhase).toBe('GREEN');
			expect(nextAction.nextSteps).toContain('Implement code');
		});

		it('should recommend correct action for COMMIT phase', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Next Action Test',
				subtasks: [{ id: '1.1', title: 'Commit changes', status: 'pending' }]
			});

			await workflowService.completePhase({
				total: 5,
				passed: 0,
				failed: 5,
				skipped: 0,
				phase: 'RED'
			});
			await workflowService.completePhase({
				total: 5,
				passed: 5,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});

			const nextAction = workflowService.getNextAction();

			expect(nextAction.action).toBe('commit_changes');
			expect(nextAction.tddPhase).toBe('COMMIT');
			expect(nextAction.nextSteps).toContain('commit');
		});

		it('should recommend finalize for FINALIZE phase', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Finalize Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			// Make git commit to have clean tree
			fs.writeFileSync(
				path.join(testProjectDir, 'feature.ts'),
				'export const x = 1;\n'
			);
			execSync('git add .', { cwd: testProjectDir, stdio: 'pipe' });
			execSync('git commit -m "Feature"', {
				cwd: testProjectDir,
				stdio: 'pipe'
			});

			// Complete the workflow to FINALIZE phase
			await workflowService.completePhase({
				total: 1,
				passed: 0,
				failed: 1,
				skipped: 0,
				phase: 'RED'
			});
			await workflowService.completePhase({
				total: 1,
				passed: 1,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});
			await workflowService.commit();

			const nextAction = workflowService.getNextAction();

			expect(nextAction.action).toBe('finalize_workflow');
			expect(nextAction.phase).toBe('FINALIZE');
		});
	});

	describe('State File Evolution', () => {
		it('should track full workflow state evolution', async () => {
			// Start workflow
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Evolution Test',
				subtasks: [
					{ id: '1.1', title: 'First', status: 'pending' },
					{ id: '1.2', title: 'Second', status: 'pending' }
				]
			});

			// Verify initial state
			let state = readWorkflowState();
			expect(state?.phase).toBe('SUBTASK_LOOP');
			expect(state?.context.currentSubtaskIndex).toBe(0);
			expect(state?.context.currentTDDPhase).toBe('RED');

			// Complete RED phase
			await workflowService.completePhase({
				total: 3,
				passed: 0,
				failed: 3,
				skipped: 0,
				phase: 'RED'
			});

			state = readWorkflowState();
			expect(state?.context.currentTDDPhase).toBe('GREEN');
			expect(state?.context.lastTestResults?.failed).toBe(3);

			// Complete GREEN phase
			await workflowService.completePhase({
				total: 3,
				passed: 3,
				failed: 0,
				skipped: 0,
				phase: 'GREEN'
			});

			state = readWorkflowState();
			expect(state?.context.currentTDDPhase).toBe('COMMIT');

			// Complete commit and advance to next subtask
			await workflowService.commit();

			state = readWorkflowState();
			expect(state?.context.currentSubtaskIndex).toBe(1);
			expect(state?.context.currentTDDPhase).toBe('RED');
			expect(state?.context.subtasks[0].status).toBe('completed');
		});
	});

	describe('hasWorkflow', () => {
		it('should return false when no workflow exists', async () => {
			const exists = await workflowService.hasWorkflow();
			expect(exists).toBe(false);
		});

		it('should return true when workflow exists', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Exists Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			const exists = await workflowService.hasWorkflow();
			expect(exists).toBe(true);
		});

		it('should return false after workflow is aborted', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Abort Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }]
			});

			await workflowService.abortWorkflow();

			const exists = await workflowService.hasWorkflow();
			expect(exists).toBe(false);
		});
	});

	describe('Team/API Storage', () => {
		it('should use orgSlug for branch naming when provided (API storage mode)', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Team Feature',
				subtasks: [{ id: 'HAM-2', title: 'Implement', status: 'pending' }],
				orgSlug: 'acme-corp'
			});

			const currentBranch = execSync('git branch --show-current', {
				cwd: testProjectDir,
				encoding: 'utf-8'
			}).trim();

			expect(currentBranch).toBe('tm/acme-corp/task-1-team-feature');
		});

		it('should prioritize orgSlug over tag for branch naming', async () => {
			await workflowService.startWorkflow({
				taskId: '1',
				taskTitle: 'Priority Test',
				subtasks: [{ id: '1.1', title: 'Task', status: 'pending' }],
				tag: 'local-tag',
				orgSlug: 'team-slug'
			});

			const currentBranch = execSync('git branch --show-current', {
				cwd: testProjectDir,
				encoding: 'utf-8'
			}).trim();

			// orgSlug should take precedence over tag
			expect(currentBranch).toBe('tm/team-slug/task-1-priority-test');
			expect(currentBranch).not.toContain('local-tag');
		});
	});
});
