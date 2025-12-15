/**
 * @fileoverview Integration tests for task metadata extraction across storage modes
 *
 * These tests verify that rich AI-generated implementation metadata is correctly
 * extracted and passed through the storage layer for both file and API storage modes.
 *
 * For API storage: Tests the flow from database rows -> TaskMapper -> Task type
 * For file storage: Tests that metadata is preserved in JSON serialization/deserialization
 */

import { describe, expect, it } from 'vitest';
import { TaskMapper } from '../../../src/common/mappers/TaskMapper.js';
import type { Json, Tables } from '../../../src/common/types/database.types.js';
import type {
	ExistingInfrastructure,
	RelevantFile,
	Task
} from '../../../src/common/types/index.js';

type TaskRow = Tables<'tasks'>;

/**
 * Creates a realistic database task row with AI-generated metadata
 */
function createDatabaseTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
	return {
		id: '550e8400-e29b-41d4-a716-446655440000',
		display_id: 'HAM-1',
		title: 'Implement Authentication System',
		description: 'Add JWT-based authentication to the API',
		status: 'in_progress',
		priority: 'high',
		brief_id: 'brief-550e8400',
		parent_task_id: null,
		position: 1,
		subtask_position: 0,
		created_at: '2024-01-15T10:00:00Z',
		updated_at: '2024-01-15T14:30:00Z',
		metadata: {
			details:
				'Implement secure JWT authentication with refresh tokens and role-based access control',
			testStrategy:
				'Unit tests for auth functions, integration tests for login flow, E2E tests for protected routes',
			relevantFiles: [
				{
					path: 'src/auth/auth.service.ts',
					description: 'Main authentication service handling login/logout',
					action: 'modify'
				},
				{
					path: 'src/auth/jwt.strategy.ts',
					description: 'Passport JWT strategy for token validation',
					action: 'create'
				},
				{
					path: 'src/auth/guards/auth.guard.ts',
					description: 'NestJS guard for protected routes',
					action: 'create'
				}
			],
			codebasePatterns: [
				'Use dependency injection for all services',
				'Follow repository pattern for data access',
				'Use DTOs for request/response validation'
			],
			existingInfrastructure: [
				{
					name: 'UserRepository',
					location: 'src/users/user.repository.ts',
					usage: 'Use for user lookups during authentication'
				},
				{
					name: 'ConfigService',
					location: 'src/config/config.service.ts',
					usage: 'Access JWT secret and token expiry settings'
				}
			],
			scopeBoundaries: {
				included:
					'JWT token generation, validation, refresh token flow, auth guards',
				excluded:
					'OAuth/social login (separate task), password reset (separate task)'
			},
			implementationApproach: `1. Create JWT strategy extending PassportStrategy
2. Implement AuthService with login/validateUser methods
3. Create AuthGuard for route protection
4. Add refresh token endpoint
5. Update user entity with hashed password storage`,
			technicalConstraints: [
				'Must use RS256 algorithm for JWT signing',
				'Access tokens must expire in 15 minutes',
				'Refresh tokens must expire in 7 days',
				'Passwords must be hashed with bcrypt (cost factor 12)'
			],
			acceptanceCriteria: [
				'Users can register with email and password',
				'Users can login and receive JWT tokens',
				'Protected routes reject requests without valid tokens',
				'Refresh tokens can be used to get new access tokens',
				'All auth-related errors return appropriate HTTP status codes'
			],
			skills: ['TypeScript', 'NestJS', 'JWT', 'Passport.js', 'bcrypt'],
			category: 'development'
		} as Json,
		complexity: 7,
		estimated_hours: 16,
		actual_hours: 0,
		assignee_id: null,
		document_id: null,
		account_id: 'account-123',
		created_by: 'user-123',
		updated_by: 'user-123',
		completed_subtasks: 0,
		total_subtasks: 3,
		due_date: '2024-01-20T17:00:00Z',
		...overrides
	};
}

/**
 * Creates a database subtask row with implementation metadata
 */
function createDatabaseSubtaskRow(
	parentId: string,
	subtaskNum: number
): TaskRow {
	const subtaskMetadata: Record<number, object> = {
		1: {
			details: 'Create the JWT strategy class that validates tokens',
			testStrategy: 'Unit tests for token validation logic',
			relevantFiles: [
				{
					path: 'src/auth/jwt.strategy.ts',
					description: 'JWT strategy implementation',
					action: 'create'
				}
			],
			implementationApproach:
				'Extend PassportStrategy with jwt-passport, implement validate method',
			acceptanceCriteria: [
				'Strategy validates JWT tokens',
				'Invalid tokens are rejected'
			],
			skills: ['TypeScript', 'Passport.js'],
			category: 'development'
		},
		2: {
			details: 'Create guards for protecting routes',
			testStrategy: 'Integration tests with mock requests',
			relevantFiles: [
				{
					path: 'src/auth/guards/auth.guard.ts',
					description: 'Main auth guard',
					action: 'create'
				}
			],
			technicalConstraints: ['Must work with NestJS execution context'],
			acceptanceCriteria: ['Protected routes require valid JWT'],
			category: 'development'
		},
		3: {
			details: 'Implement refresh token flow',
			testStrategy: 'E2E tests for token refresh',
			scopeBoundaries: {
				included: 'Refresh token generation and validation',
				excluded: 'Token revocation (future enhancement)'
			},
			acceptanceCriteria: [
				'Refresh tokens can get new access tokens',
				'Expired refresh tokens are rejected'
			],
			category: 'development'
		}
	};

	return {
		id: `subtask-${subtaskNum}-uuid`,
		display_id: `HAM-1.${subtaskNum}`,
		title: `Subtask ${subtaskNum}`,
		description: `Description for subtask ${subtaskNum}`,
		status: 'todo',
		priority: 'medium',
		brief_id: 'brief-550e8400',
		parent_task_id: parentId,
		position: 1,
		subtask_position: subtaskNum,
		created_at: '2024-01-15T10:00:00Z',
		updated_at: '2024-01-15T10:00:00Z',
		metadata: subtaskMetadata[subtaskNum] as Json,
		complexity: null,
		estimated_hours: 4,
		actual_hours: 0,
		assignee_id: null,
		document_id: null,
		account_id: 'account-123',
		created_by: 'user-123',
		updated_by: 'user-123',
		completed_subtasks: 0,
		total_subtasks: 0,
		due_date: null
	};
}

describe('Task Metadata Extraction - Integration Tests', () => {
	describe('API Storage Mode - TaskMapper Integration', () => {
		it('should extract complete implementation metadata from database task', () => {
			const dbTask = createDatabaseTaskRow();
			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			// Verify core fields
			expect(task.id).toBe('HAM-1');
			expect(task.title).toBe('Implement Authentication System');
			expect(task.status).toBe('in-progress');
			expect(task.priority).toBe('high');

			// Verify details and testStrategy
			expect(task.details).toContain('JWT authentication');
			expect(task.testStrategy).toContain('Unit tests');

			// Verify implementation metadata
			expect(task.relevantFiles).toBeDefined();
			expect(task.relevantFiles).toHaveLength(3);
			expect(task.relevantFiles![0]).toEqual({
				path: 'src/auth/auth.service.ts',
				description: 'Main authentication service handling login/logout',
				action: 'modify'
			});

			expect(task.codebasePatterns).toEqual([
				'Use dependency injection for all services',
				'Follow repository pattern for data access',
				'Use DTOs for request/response validation'
			]);

			expect(task.existingInfrastructure).toHaveLength(2);
			expect(task.existingInfrastructure![0].name).toBe('UserRepository');

			expect(task.scopeBoundaries).toEqual({
				included:
					'JWT token generation, validation, refresh token flow, auth guards',
				excluded:
					'OAuth/social login (separate task), password reset (separate task)'
			});

			expect(task.implementationApproach).toContain('Create JWT strategy');
			expect(task.technicalConstraints).toContain(
				'Must use RS256 algorithm for JWT signing'
			);
			expect(task.acceptanceCriteria).toContain(
				'Users can register with email and password'
			);
			expect(task.skills).toEqual([
				'TypeScript',
				'NestJS',
				'JWT',
				'Passport.js',
				'bcrypt'
			]);
			expect(task.category).toBe('development');
		});

		it('should extract metadata from subtasks', () => {
			const parentTask = createDatabaseTaskRow();
			const subtasks = [
				createDatabaseSubtaskRow(parentTask.id, 1),
				createDatabaseSubtaskRow(parentTask.id, 2),
				createDatabaseSubtaskRow(parentTask.id, 3)
			];

			const task = TaskMapper.mapDatabaseTaskToTask(
				parentTask,
				subtasks,
				new Map()
			);

			expect(task.subtasks).toHaveLength(3);

			// Verify first subtask has metadata
			const subtask1 = task.subtasks[0];
			expect(subtask1.id).toBe('HAM-1.1');
			expect(subtask1.relevantFiles).toHaveLength(1);
			expect(subtask1.skills).toEqual(['TypeScript', 'Passport.js']);
			expect(subtask1.category).toBe('development');
			expect(subtask1.acceptanceCriteria).toContain(
				'Strategy validates JWT tokens'
			);

			// Verify second subtask has different metadata
			const subtask2 = task.subtasks[1];
			expect(subtask2.technicalConstraints).toContain(
				'Must work with NestJS execution context'
			);

			// Verify third subtask has scope boundaries
			const subtask3 = task.subtasks[2];
			expect(subtask3.scopeBoundaries).toBeDefined();
			expect(subtask3.scopeBoundaries!.included).toContain('Refresh token');
		});

		it('should handle tasks without metadata gracefully', () => {
			const dbTask = createDatabaseTaskRow({
				metadata: {} as Json
			});

			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			expect(task.id).toBe('HAM-1');
			expect(task.details).toBe('');
			expect(task.testStrategy).toBe('');
			expect(task.relevantFiles).toBeUndefined();
			expect(task.codebasePatterns).toBeUndefined();
			expect(task.category).toBeUndefined();
		});

		it('should handle malformed metadata without crashing', () => {
			const dbTask = createDatabaseTaskRow({
				metadata: {
					details: 123, // Invalid: should be string
					relevantFiles: 'not-an-array', // Invalid: should be array
					category: 'invalid-category', // Invalid: not a valid enum value
					skills: { wrong: 'type' } // Invalid: should be array
				} as unknown as Json
			});

			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			// Should not crash and should use defaults
			expect(task.id).toBe('HAM-1');
			expect(task.details).toBe(''); // Falls back to empty string
			expect(task.relevantFiles).toBeUndefined();
			expect(task.category).toBeUndefined();
			expect(task.skills).toBeUndefined();
		});

		it('should map multiple tasks with their subtasks correctly', () => {
			const parentTask1 = createDatabaseTaskRow({
				id: 'parent-1-uuid',
				display_id: 'HAM-1'
			});
			const parentTask2 = createDatabaseTaskRow({
				id: 'parent-2-uuid',
				display_id: 'HAM-2',
				title: 'Second Task'
			});
			const subtask1_1 = createDatabaseSubtaskRow('parent-1-uuid', 1);
			const subtask2_1: TaskRow = {
				...createDatabaseSubtaskRow('parent-2-uuid', 1),
				display_id: 'HAM-2.1'
			};

			const allTasks = [parentTask1, parentTask2, subtask1_1, subtask2_1];
			const tasks = TaskMapper.mapDatabaseTasksToTasks(allTasks, new Map());

			expect(tasks).toHaveLength(2);
			expect(tasks[0].id).toBe('HAM-1');
			expect(tasks[0].subtasks).toHaveLength(1);
			expect(tasks[0].subtasks[0].id).toBe('HAM-1.1');

			expect(tasks[1].id).toBe('HAM-2');
			expect(tasks[1].subtasks).toHaveLength(1);
			expect(tasks[1].subtasks[0].id).toBe('HAM-2.1');
		});
	});

	describe('File Storage Mode - JSON Serialization', () => {
		it('should preserve all metadata fields through JSON serialization', () => {
			// Create a task with full metadata (simulating what would be stored in tasks.json)
			const taskWithMetadata: Task = {
				id: '1',
				title: 'Test Task',
				description: 'Test description',
				status: 'pending',
				priority: 'high',
				dependencies: [],
				details: 'Detailed requirements',
				testStrategy: 'Unit and integration tests',
				subtasks: [],
				relevantFiles: [
					{ path: 'src/test.ts', description: 'Test file', action: 'modify' }
				],
				codebasePatterns: ['Pattern 1', 'Pattern 2'],
				existingInfrastructure: [
					{ name: 'Service', location: 'src/service.ts', usage: 'Use for X' }
				],
				scopeBoundaries: { included: 'A', excluded: 'B' },
				implementationApproach: 'Step by step',
				technicalConstraints: ['Constraint 1'],
				acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
				skills: ['TypeScript'],
				category: 'development'
			};

			// Serialize and deserialize (simulating file storage)
			const serialized = JSON.stringify(taskWithMetadata);
			const deserialized: Task = JSON.parse(serialized);

			// All fields should be preserved
			expect(deserialized.relevantFiles).toEqual(
				taskWithMetadata.relevantFiles
			);
			expect(deserialized.codebasePatterns).toEqual(
				taskWithMetadata.codebasePatterns
			);
			expect(deserialized.existingInfrastructure).toEqual(
				taskWithMetadata.existingInfrastructure
			);
			expect(deserialized.scopeBoundaries).toEqual(
				taskWithMetadata.scopeBoundaries
			);
			expect(deserialized.implementationApproach).toBe(
				taskWithMetadata.implementationApproach
			);
			expect(deserialized.technicalConstraints).toEqual(
				taskWithMetadata.technicalConstraints
			);
			expect(deserialized.acceptanceCriteria).toEqual(
				taskWithMetadata.acceptanceCriteria
			);
			expect(deserialized.skills).toEqual(taskWithMetadata.skills);
			expect(deserialized.category).toBe(taskWithMetadata.category);
		});

		it('should handle tasks without optional metadata in JSON', () => {
			const minimalTask: Task = {
				id: '1',
				title: 'Minimal Task',
				description: 'Description',
				status: 'pending',
				priority: 'medium',
				dependencies: [],
				details: '',
				testStrategy: '',
				subtasks: []
			};

			const serialized = JSON.stringify(minimalTask);
			const deserialized: Task = JSON.parse(serialized);

			expect(deserialized.id).toBe('1');
			expect(deserialized.relevantFiles).toBeUndefined();
			expect(deserialized.category).toBeUndefined();
		});
	});

	describe('Metadata Type Validation', () => {
		it('should correctly type relevantFiles entries', () => {
			const dbTask = createDatabaseTaskRow();
			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			// TypeScript type checking - if these compile, types are correct
			const files: RelevantFile[] | undefined = task.relevantFiles;
			expect(files).toBeDefined();

			if (files) {
				const firstFile: RelevantFile = files[0];
				expect(firstFile.path).toBe('src/auth/auth.service.ts');
				expect(firstFile.action).toBe('modify');
				expect(['create', 'modify', 'reference']).toContain(firstFile.action);
			}
		});

		it('should correctly type existingInfrastructure entries', () => {
			const dbTask = createDatabaseTaskRow();
			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			const infra: ExistingInfrastructure[] | undefined =
				task.existingInfrastructure;
			expect(infra).toBeDefined();

			if (infra) {
				const firstInfra: ExistingInfrastructure = infra[0];
				expect(firstInfra.name).toBe('UserRepository');
				expect(firstInfra.location).toBe('src/users/user.repository.ts');
				expect(firstInfra.usage).toContain('user lookups');
			}
		});

		it('should correctly type category field', () => {
			const dbTask = createDatabaseTaskRow();
			const task = TaskMapper.mapDatabaseTaskToTask(dbTask, [], new Map());

			// Verify category is a valid enum value
			const validCategories = [
				'research',
				'design',
				'development',
				'testing',
				'documentation',
				'review'
			];
			expect(task.category).toBeDefined();
			expect(validCategories).toContain(task.category);
		});
	});
});
