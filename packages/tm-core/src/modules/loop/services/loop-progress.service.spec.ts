/**
 * @fileoverview Unit tests for LoopProgressService
 */

import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { LoopProgressService, ProgressEntry } from './loop-progress.service.js';

describe('LoopProgressService', () => {
	describe('constructor', () => {
		it('should accept a project root path', () => {
			const service = new LoopProgressService('/my/project');
			expect(service).toBeInstanceOf(LoopProgressService);
		});
	});

	describe('getDefaultProgressPath', () => {
		it('should return correct path for absolute project root', () => {
			const service = new LoopProgressService('/my/project');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('/my/project', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for relative project root', () => {
			const service = new LoopProgressService('./my-project');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('./my-project', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for project root with spaces', () => {
			const service = new LoopProgressService('/my project/with spaces');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join('/my project/with spaces', '.taskmaster', 'loop-progress.txt')
			);
		});

		it('should return correct path for nested project root', () => {
			const service = new LoopProgressService('/home/user/projects/app');
			const result = service.getDefaultProgressPath();
			expect(result).toBe(
				path.join(
					'/home/user/projects/app',
					'.taskmaster',
					'loop-progress.txt'
				)
			);
		});
	});

	describe('ProgressEntry type', () => {
		it('should allow entry with taskId', () => {
			const entry: ProgressEntry = {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 1,
				taskId: '4.1',
				note: 'Started working on task'
			};
			expect(entry.taskId).toBe('4.1');
		});

		it('should allow entry without taskId', () => {
			const entry: ProgressEntry = {
				timestamp: '2026-01-08T10:00:00Z',
				iteration: 2,
				note: 'Initialization complete'
			};
			expect(entry.taskId).toBeUndefined();
		});
	});
});
