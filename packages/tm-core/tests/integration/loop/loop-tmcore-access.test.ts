/**
 * @fileoverview Integration tests for LoopDomain access via TmCore
 *
 * Verifies that LoopDomain is properly accessible through TmCore.loop
 * and methods work correctly.
 *
 * @integration
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to reduce noise in tests
vi.mock('../../../src/common/logger/index.js', () => {
	const mockLogger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn().mockReturnThis()
	};
	return {
		createLogger: () => mockLogger,
		getLogger: () => mockLogger
	};
});

import { createTmCore, TmCore, LoopDomain } from '../../../src/index.js';

describe('LoopDomain Access via TmCore', () => {
	let testProjectDir: string;
	let tmCore: TmCore | null = null;

	beforeEach(() => {
		// Create temp project directory for isolation
		testProjectDir = fs.mkdtempSync(
			path.join(os.tmpdir(), 'tm-loop-access-test-')
		);

		// Create minimal taskmaster config structure
		const taskmasterDir = path.join(testProjectDir, '.taskmaster');
		const tasksDir = path.join(taskmasterDir, 'tasks');
		fs.mkdirSync(tasksDir, { recursive: true });

		// Create empty tasks.json for TasksDomain initialization
		fs.writeFileSync(
			path.join(tasksDir, 'tasks.json'),
			JSON.stringify({
				tasks: [],
				tags: { default: { tasks: [] } },
				activeTag: 'default'
			}),
			'utf-8'
		);

		// Create config.json
		fs.writeFileSync(
			path.join(taskmasterDir, 'config.json'),
			JSON.stringify({
				models: {
					main: { id: 'test-model', provider: 'test' },
					research: { id: 'test-model', provider: 'test' },
					fallback: { id: 'test-model', provider: 'test' }
				}
			}),
			'utf-8'
		);
	});

	afterEach(async () => {
		// Clean up TmCore
		if (tmCore) {
			await tmCore.close();
			tmCore = null;
		}

		// Clean up temp directory
		if (testProjectDir) {
			fs.rmSync(testProjectDir, { recursive: true, force: true });
		}
	});

	describe('TmCore.loop Accessor', () => {
		it('should have loop property accessible after createTmCore()', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			expect(tmCore.loop).toBeDefined();
		});

		it('should return LoopDomain instance', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			expect(tmCore.loop).toBeInstanceOf(LoopDomain);
		});

		it('should have expected LoopDomain methods', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			expect(typeof tmCore.loop.isPreset).toBe('function');
			expect(typeof tmCore.loop.resolvePrompt).toBe('function');
			expect(typeof tmCore.loop.getAvailablePresets).toBe('function');
			expect(typeof tmCore.loop.getIsRunning).toBe('function');
			expect(typeof tmCore.loop.stop).toBe('function');
		});
	});

	describe('Preset Resolution via TmCore', () => {
		it('should resolve preset content through TmCore.loop', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			const content = await tmCore.loop.resolvePrompt('default');

			expect(content).toBeTruthy();
			expect(content.length).toBeGreaterThan(100);
			expect(content).toContain('<loop-complete>');
		});

		it('should identify valid presets', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			expect(tmCore.loop.isPreset('default')).toBe(true);
			expect(tmCore.loop.isPreset('test-coverage')).toBe(true);
			expect(tmCore.loop.isPreset('/some/file/path.md')).toBe(false);
		});

		it('should list all available presets', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			const presets = tmCore.loop.getAvailablePresets();

			expect(presets).toContain('default');
			expect(presets).toContain('test-coverage');
			expect(presets).toContain('linting');
			expect(presets).toContain('duplication');
			expect(presets).toContain('entropy');
			expect(presets).toHaveLength(5);
		});
	});

	describe('Loop Lifecycle via TmCore', () => {
		it('should report not running initially', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			expect(tmCore.loop.getIsRunning()).toBe(false);
		});

		it('should handle stop() when not running', async () => {
			tmCore = await createTmCore({ projectPath: testProjectDir });

			// stop() is now synchronous and should not throw
			expect(() => tmCore!.loop.stop()).not.toThrow();
			expect(tmCore.loop.getIsRunning()).toBe(false);
		});
	});
});
