/**
 * @fileoverview Tests for WorkflowStateManager path sanitization
 */

import { describe, it, expect } from 'vitest';
import { WorkflowStateManager } from './workflow-state-manager.js';
import os from 'node:os';
import path from 'node:path';

describe('WorkflowStateManager', () => {
	describe('getProjectIdentifier', () => {
		it('should sanitize paths like Claude Code', () => {
			const projectRoot =
				'/Volumes/Workspace/workspace/contrib/task-master/demos/nextjs-todo-tdd';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			const homeDir = os.homedir();

			// Expected structure: ~/.taskmaster/{project-id}/sessions/
			const expectedPath = path.join(
				homeDir,
				'.taskmaster',
				'-Volumes-Workspace-workspace-contrib-task-master-demos-nextjs-todo-tdd',
				'sessions'
			);

			expect(sessionDir).toBe(expectedPath);
		});

		it('should preserve case in paths', () => {
			const projectRoot = '/Users/Alice/Projects/MyApp';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			// Extract project ID from: ~/.taskmaster/{project-id}/sessions/
			const projectId = sessionDir.split(path.sep).slice(-2, -1)[0];

			// Case should be preserved
			expect(projectId).toContain('Users');
			expect(projectId).toContain('Alice');
			expect(projectId).toContain('Projects');
			expect(projectId).toContain('MyApp');
		});

		it('should handle paths with special characters', () => {
			const projectRoot = '/tmp/my-project_v2.0/test';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			// Extract project ID from: ~/.taskmaster/{project-id}/sessions/
			const projectId = sessionDir.split(path.sep).slice(-2, -1)[0];

			// Special chars should be replaced with dashes
			expect(projectId).toBe('-tmp-my-project-v2-0-test');
		});

		it('should create unique identifiers for different paths', () => {
			const project1 = '/Users/alice/task-master';
			const project2 = '/Users/bob/task-master';

			const manager1 = new WorkflowStateManager(project1);
			const manager2 = new WorkflowStateManager(project2);

			// Extract project IDs from: ~/.taskmaster/{project-id}/sessions/
			const id1 = manager1.getSessionDir().split(path.sep).slice(-2, -1)[0];
			const id2 = manager2.getSessionDir().split(path.sep).slice(-2, -1)[0];

			// Same basename but different full paths should be unique
			expect(id1).not.toBe(id2);
			expect(id1).toContain('alice');
			expect(id2).toContain('bob');
		});

		it('should collapse multiple dashes', () => {
			const projectRoot = '/path//with///multiple////slashes';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			// Extract project ID from: ~/.taskmaster/{project-id}/sessions/
			const projectId = sessionDir.split(path.sep).slice(-2, -1)[0];

			// Multiple dashes should be collapsed to single dash
			expect(projectId).not.toContain('--');
			expect(projectId).toBe('-path-with-multiple-slashes');
		});

		it('should not have trailing dashes', () => {
			const projectRoot = '/path/to/project';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			// Extract project ID from: ~/.taskmaster/{project-id}/sessions/
			const projectId = sessionDir.split(path.sep).slice(-2, -1)[0];

			// Should not end with dash
			expect(projectId).not.toMatch(/-$/);
		});

		it('should start with a dash like Claude Code', () => {
			const projectRoot = '/any/path';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			// Extract project ID from: ~/.taskmaster/{project-id}/sessions/
			const projectId = sessionDir.split(path.sep).slice(-2, -1)[0];

			// Should start with dash like Claude Code's pattern
			expect(projectId).toMatch(/^-/);
		});
	});

	describe('session paths', () => {
		it('should place sessions in global ~/.taskmaster/{project-id}/sessions/', () => {
			const projectRoot = '/some/project';
			const manager = new WorkflowStateManager(projectRoot);

			const sessionDir = manager.getSessionDir();
			const homeDir = os.homedir();

			// Should be: ~/.taskmaster/{project-id}/sessions/
			expect(sessionDir).toContain(path.join(homeDir, '.taskmaster'));
			expect(sessionDir).toMatch(/\.taskmaster\/.*\/sessions$/);
		});

		it('should include workflow-state.json in session dir', () => {
			const projectRoot = '/some/project';
			const manager = new WorkflowStateManager(projectRoot);

			const statePath = manager.getStatePath();
			const sessionDir = manager.getSessionDir();

			expect(statePath).toBe(path.join(sessionDir, 'workflow-state.json'));
		});

		it('should include backups dir in session dir', () => {
			const projectRoot = '/some/project';
			const manager = new WorkflowStateManager(projectRoot);

			const backupDir = manager.getBackupDir();
			const sessionDir = manager.getSessionDir();

			expect(backupDir).toBe(path.join(sessionDir, 'backups'));
		});
	});
});
