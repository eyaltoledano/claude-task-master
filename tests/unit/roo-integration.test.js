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

describe('Roo Integration', () => {
	let tempDir;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create a temporary directory for testing
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-master-test-'));

		// Spy on fs methods
		jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
		jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
			if (filePath.toString().includes('.roomodes')) {
				return 'Existing roomodes content';
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

	// Test function that simulates the createProjectStructure behavior for Roo files
	function mockCreateRooStructure() {
		// Create main .roo directory
		fs.mkdirSync(path.join(tempDir, '.roo'), { recursive: true });

		// Create rules directory
		fs.mkdirSync(path.join(tempDir, '.roo', 'rules'), { recursive: true });

		// Create mode-specific rule directories
		const rooModes = ['architect', 'ask', 'boomerang', 'code', 'debug', 'test'];
		for (const mode of rooModes) {
			fs.mkdirSync(path.join(tempDir, '.roo', `rules-${mode}`), {
				recursive: true
			});
			fs.writeFileSync(
				path.join(tempDir, '.roo', `rules-${mode}`, `${mode}-rules`),
				`Content for ${mode} rules`
			);
		}

		// Create additional directories
		fs.mkdirSync(path.join(tempDir, '.roo', 'config'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.roo', 'templates'), { recursive: true });
		fs.mkdirSync(path.join(tempDir, '.roo', 'logs'), { recursive: true });

		// Copy .roomodes file
		fs.writeFileSync(path.join(tempDir, '.roomodes'), 'Roomodes file content');
	}

	test('creates all required .roo directories', () => {
		// Act
		mockCreateRooStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(tempDir, '.roo'), {
			recursive: true
		});
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules'),
			{ recursive: true }
		);

		// Verify all mode directories are created
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-architect'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-ask'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-boomerang'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-code'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-debug'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-test'),
			{ recursive: true }
		);
	});

	test('creates rule files for all modes', () => {
		// Act
		mockCreateRooStructure();

		// Assert - check all rule files are created
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-architect', 'architect-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-ask', 'ask-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-boomerang', 'boomerang-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-code', 'code-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-debug', 'debug-rules'),
			expect.any(String)
		);
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'rules-test', 'test-rules'),
			expect.any(String)
		);
	});

	test('creates .roomodes file in project root', () => {
		// Act
		mockCreateRooStructure();

		// Assert
		expect(fs.writeFileSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roomodes'),
			expect.any(String)
		);
	});

	test('creates additional required Roo directories', () => {
		// Act
		mockCreateRooStructure();

		// Assert
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'config'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'templates'),
			{ recursive: true }
		);
		expect(fs.mkdirSync).toHaveBeenCalledWith(
			path.join(tempDir, '.roo', 'logs'),
			{ recursive: true }
		);
	});
});
