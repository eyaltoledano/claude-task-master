/**
 * Test Mode Integration Tests for Web Server
 *
 * These tests verify that test mode properly isolates test data from production data
 * by using .taskmaster-test/ directory structure instead of .taskmaster/
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	getTaskMasterDirectory,
	getTasksFilePath,
	getConfigFilePath,
	getWebServerStateFilePath
} from '../../web/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Web Server Directory Usage (No Test Mode)', () => {
	const testProjectRoot = path.join(__dirname, 'test-project');

	beforeEach(() => {
		// Create test project directory
		if (!fs.existsSync(testProjectRoot)) {
			fs.mkdirSync(testProjectRoot, { recursive: true });
		}
	});

	afterEach(() => {
		// Clean up .taskmaster directory only
		const productionDir = path.join(testProjectRoot, '.taskmaster');
		if (fs.existsSync(productionDir)) {
			fs.rmSync(productionDir, { recursive: true, force: true });
		}
		if (fs.existsSync(testProjectRoot)) {
			fs.rmSync(testProjectRoot, { recursive: true, force: true });
		}
	});

	describe('Directory and Path Functions', () => {
		test('should use .taskmaster directory for all operations', () => {
			const dir = getTaskMasterDirectory(testProjectRoot);
			expect(dir).toBe(path.join(testProjectRoot, '.taskmaster'));
		});

		test('should use .taskmaster/tasks/tasks.json for tasks file path', () => {
			const tasksPath = getTasksFilePath(testProjectRoot);
			expect(tasksPath).toBe(
				path.join(testProjectRoot, '.taskmaster', 'tasks', 'tasks.json')
			);
		});

		test('should use .taskmaster/config.json for config file path', () => {
			const configPath = getConfigFilePath(testProjectRoot);
			expect(configPath).toBe(
				path.join(testProjectRoot, '.taskmaster', 'config.json')
			);
		});

		test('should use .taskmaster/web-server-state.json for web server state file path', () => {
			const statePath = getWebServerStateFilePath(testProjectRoot);
			expect(statePath).toBe(
				path.join(testProjectRoot, '.taskmaster', 'web-server-state.json')
			);
		});
	});

	describe('File isolation verification', () => {
		test('should not interfere between test runs (clean up .taskmaster)', () => {
			// Create files in .taskmaster
			const dir = getTaskMasterDirectory(testProjectRoot);
			const tasksPath = getTasksFilePath(testProjectRoot);

			fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
			fs.writeFileSync(
				tasksPath,
				JSON.stringify({
					currentTag: 'master',
					tags: {
						master: {
							tasks: [{ id: 1, title: 'Test Task', status: 'pending' }]
						}
					}
				}),
				'utf8'
			);

			// Ensure file exists
			expect(fs.existsSync(tasksPath)).toBe(true);

			// Clean up happens in afterEach
		});
	});
});
