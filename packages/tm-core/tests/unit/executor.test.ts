/**
 * Tests for executor functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	ExecutorFactory,
	ClaudeExecutor,
	type ExecutorOptions
} from '../../src/executors/index.js';

describe('ExecutorFactory', () => {
	const mockProjectRoot = '/test/project';

	it('should create a Claude executor', () => {
		const options: ExecutorOptions = {
			type: 'claude',
			projectRoot: mockProjectRoot
		};

		const executor = ExecutorFactory.create(options);
		expect(executor).toBeInstanceOf(ClaudeExecutor);
	});

	it('should throw error for unimplemented executor types', () => {
		const options: ExecutorOptions = {
			type: 'shell',
			projectRoot: mockProjectRoot
		};

		expect(() => ExecutorFactory.create(options)).toThrow(
			'Shell executor not yet implemented'
		);
	});

	it('should get available executor types', () => {
		const types = ExecutorFactory.getAvailableTypes();
		expect(types).toContain('claude');
		expect(types).toContain('shell');
		expect(types).toContain('custom');
	});
});

describe('ClaudeExecutor', () => {
	const mockProjectRoot = '/test/project';
	let executor: ClaudeExecutor;

	beforeEach(() => {
		executor = new ClaudeExecutor(mockProjectRoot);
	});

	it('should return claude as executor type', () => {
		expect(executor.getType()).toBe('claude');
	});

	it('should format task prompt correctly', () => {
		const mockTask = {
			id: '1',
			title: 'Test Task',
			description: 'Test description',
			status: 'pending' as const,
			priority: 'high' as const,
			dependencies: [],
			details: 'Implementation details',
			testStrategy: 'Unit tests',
			subtasks: []
		};

		// Access protected method through any type assertion for testing
		const formattedPrompt = (executor as any).formatTaskPrompt(mockTask);

		expect(formattedPrompt).toContain('Task ID: 1');
		expect(formattedPrompt).toContain('Title: Test Task');
		expect(formattedPrompt).toContain('Description:\nTest description');
		expect(formattedPrompt).toContain(
			'Implementation Details:\nImplementation details'
		);
		expect(formattedPrompt).toContain('Test Strategy:\nUnit tests');
		expect(formattedPrompt).toContain('Status: pending');
		expect(formattedPrompt).toContain('Priority: high');
	});
});
