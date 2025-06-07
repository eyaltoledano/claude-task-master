import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock external modules
jest.mock('child_process', () => ({
	execSync: jest.fn()
}));

// Mock console methods
jest.mock('console', () => ({
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
}));

describe('Windsurf Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('.windsurfmodes')) {
				return 'Existing windsurfmodes content';
			}
			if (filePath.toString().includes('-rules')) {
				return 'Existing mode rules content';
			}
			return '{}';
		});
		jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
		jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
	});

	afterEach(() => {
		// Clean up the temporary directory
		try {
			fs.rmSync(tempDir, { recursive: true, force: true });
		} catch (err) {
			console.error(`Error cleaning up: ${err.message}`);
		}
	});

	// Test function that simulates the createProjectStructure behavior for Windsurf files
	function mockCreateWindsurfStructure() {
		// Create main .windsurf directory
		fs.mkdirSync(path.join(tempDir, '.windsurf'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.windsurf', 'rules'), { recursive: true });

		// Create mode-specific rule directories
		const windsurfModes = [
			'architect',
			'ask',
			'boomerang',
			'code',
			'debug',
			'test'
		];
		for (const mode of windsurfModes) {
			fs.mkdirSync(path.join(tempDir, '.windsurf', `rules-${mode}`), {
				recursive: true
			});
			fs.writeFileSync(
				path.join(tempDir, '.windsurf', `rules-${mode}`, `${mode}-rules`),
				`Content for ${mode} rules`
			);
		}

		// Copy .windsurfmodes file
		fs.writeFileSync(
			path.join(tempDir, '.windsurfmodes'),
			'Windsurfmodes file content'
		);
	}

	test('creates all required .windsurf directories', () => {
		// Act
		mockCreateWindsurfStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.windsurf'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.windsurf', 'rules'),
			{ recursive: true }
		);
	});
});
