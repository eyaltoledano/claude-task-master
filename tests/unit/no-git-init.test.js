import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Silence banner and logs
process.env.TASKMASTER_LOG_LEVEL = 'error';

// child_process will be mocked (see below)

// Mock child_process and capture execSync mock
jest.mock('child_process', () => ({ execSync: jest.fn() }));

// Retrieve the mocked execSync for assertions
const { execSync } = jest.requireMock('child_process');

// Import after mocks so the real code sees the mocked deps
import { initializeProject } from '../../scripts/init.js';

describe('initializeProject --no-git flag', () => {
	let tempDir;
	const originalCwd = process.cwd();

	beforeEach(() => {
		jest.clearAllMocks();
		// create isolated tmp dir
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-nogit-'));
		process.chdir(tempDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('skips git init when noGit option is true', async () => {
		await initializeProject({
			yes: true,
			skipInstall: true,
			noGit: true,
			dryRun: true
		});

		// git init should never be invoked
		expect(execSync).not.toHaveBeenCalled();

		// A .git directory should not have been created
		expect(fs.existsSync(path.join(tempDir, '.git'))).toBe(false);
	});
});
