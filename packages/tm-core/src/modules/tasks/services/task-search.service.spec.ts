/**
 * @fileoverview Unit tests for TaskSearchService
 */

import { describe, expect, it } from 'vitest';
import { createSubtask, createTask } from '../../../testing/task-fixtures.js';
import { TaskSearchService } from './task-search.service.js';

describe('TaskSearchService', () => {
	const service = new TaskSearchService();

	describe('search', () => {
		it('should match a task by title', () => {
			const tasks = [
				createTask({
					id: 1,
					title: 'Implement JWT authentication',
					description: 'Secure the API'
				}),
				createTask({
					id: 2,
					title: 'Fix pagination bug',
					description: 'Off-by-one in page count'
				})
			];

			const matches = service.search(tasks, 'JWT');

			expect(matches).toHaveLength(1);
			expect(matches[0].task.id).toBe('1');
			expect(matches[0].matchedFields).toEqual(['title']);
		});

		it('should match case-insensitively', () => {
			const tasks = [
				createTask({ id: 1, title: 'Implement JWT authentication' })
			];

			expect(service.search(tasks, 'jwt')).toHaveLength(1);
			expect(service.search(tasks, 'AUTHENTICATION')).toHaveLength(1);
		});

		it('should match across description, details and testStrategy', () => {
			const tasks = [
				createTask({
					id: 1,
					title: 'Media pipeline',
					description: 'Handles image resizing',
					details: 'Use sharp for image sizes',
					testStrategy: 'Snapshot test resized images'
				})
			];

			const matches = service.search(tasks, 'image');

			expect(matches).toHaveLength(1);
			expect(matches[0].matchedFields).toEqual([
				'description',
				'details',
				'testStrategy'
			]);
		});

		it('should include a task when only a subtask matches', () => {
			const tasks = [
				createTask({
					id: 3,
					title: 'Build tooling',
					description: 'Improve build setup',
					subtasks: [
						createSubtask({
							id: 1,
							parentId: '3',
							title: 'Configure webpack aliases'
						}),
						createSubtask({
							id: 2,
							parentId: '3',
							title: 'Unrelated subtask'
						})
					]
				})
			];

			const matches = service.search(tasks, 'webpack');

			expect(matches).toHaveLength(1);
			expect(matches[0].matchedFields).toEqual([]);
			expect(matches[0].subtaskMatches).toHaveLength(1);
			expect(matches[0].subtaskMatches[0].subtask.id).toBe(1);
			expect(matches[0].subtaskMatches[0].matchedFields).toEqual([
				'title',
				'description'
			]);
		});

		it('should report both task and subtask matches on the same task', () => {
			const tasks = [
				createTask({
					id: 4,
					title: 'Migrate to webpack 5',
					description: 'Bundler migration',
					subtasks: [
						createSubtask({
							id: 1,
							parentId: '4',
							title: 'Update config',
							description: 'Adjust config file',
							details: 'Update webpack config'
						})
					]
				})
			];

			const matches = service.search(tasks, 'webpack');

			expect(matches).toHaveLength(1);
			expect(matches[0].matchedFields).toEqual(['title']);
			expect(matches[0].subtaskMatches).toHaveLength(1);
			expect(matches[0].subtaskMatches[0].matchedFields).toEqual(['details']);
		});

		it('should restrict matching to the requested fields', () => {
			const tasks = [
				createTask({
					id: 1,
					title: 'Payment flow',
					description: 'Checkout handling',
					details: 'Uses the payment gateway SDK'
				})
			];

			const titleOnly = service.search(tasks, 'gateway', {
				fields: ['title']
			});
			const detailsOnly = service.search(tasks, 'gateway', {
				fields: ['details']
			});

			expect(titleOnly).toHaveLength(0);
			expect(detailsOnly).toHaveLength(1);
			expect(detailsOnly[0].matchedFields).toEqual(['details']);
		});

		it('should return no matches for an empty or whitespace query', () => {
			const tasks = [createTask({ id: 1, title: 'Some task' })];

			expect(service.search(tasks, '')).toEqual([]);
			expect(service.search(tasks, '   ')).toEqual([]);
		});

		it('should return no matches when nothing matches', () => {
			const tasks = [
				createTask({ id: 1, title: 'First task' }),
				createTask({ id: 2, title: 'Second task' })
			];

			expect(service.search(tasks, 'zzz-no-match')).toEqual([]);
		});

		it('should handle tasks without subtasks safely', () => {
			const task = createTask({ id: 1, title: 'Standalone task' });
			// Simulate data where subtasks is missing entirely
			(task as any).subtasks = undefined;

			const matches = service.search([task], 'standalone');

			expect(matches).toHaveLength(1);
			expect(matches[0].subtaskMatches).toEqual([]);
		});
	});
});
