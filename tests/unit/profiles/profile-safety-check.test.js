import {
	getInstalledProfiles,
	wouldRemovalLeaveNoProfiles
} from '../../../src/utils/profiles.js';
import { rulesDirect } from '../../../mcp-server/src/core/direct-functions/rules.js';
import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// Mock logger
const mockLog = {
	info: jest.fn(),
	error: jest.fn(),
	debug: jest.fn()
};

describe('Rules Safety Check', () => {
	let mockExistsSync;
	let mockRmSync;
	let mockReaddirSync;

	beforeEach(() => {
		jest.clearAllMocks();

		// Set up spies on fs methods
		mockExistsSync = jest.spyOn(fs, 'existsSync');
		mockRmSync = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
		mockReaddirSync = jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
	});

	afterEach(() => {
		// Restore all mocked functions
		jest.restoreAllMocks();
	});

	describe('getInstalledProfiles', () => {
		it('should detect installed profiles correctly', () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to simulate installed profiles
			mockExistsSync.mockImplementation((filePath) => {
				if (filePath.includes('.cursor') || filePath.includes('.roo')) {
					return true;
				}
				return false;
			});

			const installed = getInstalledProfiles(projectRoot);
			expect(installed).toContain('cursor');
			expect(installed).toContain('roo');
			expect(installed).not.toContain('windsurf');
			expect(installed).not.toContain('cline');
		});

		it('should return empty array when no profiles are installed', () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to return false for all paths
			mockExistsSync.mockReturnValue(false);

			const installed = getInstalledProfiles(projectRoot);
			expect(installed).toEqual([]);
		});
	});

	describe('wouldRemovalLeaveNoProfiles', () => {
		it('should return true when removing all installed profiles', () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to simulate cursor and roo installed
			mockExistsSync.mockImplementation((filePath) => {
				return filePath.includes('.cursor') || filePath.includes('.roo');
			});

			const result = wouldRemovalLeaveNoProfiles(projectRoot, [
				'cursor',
				'roo'
			]);
			expect(result).toBe(true);
		});

		it('should return false when removing only some profiles', () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to simulate cursor and roo installed
			mockExistsSync.mockImplementation((filePath) => {
				return filePath.includes('.cursor') || filePath.includes('.roo');
			});

			const result = wouldRemovalLeaveNoProfiles(projectRoot, ['roo']);
			expect(result).toBe(false);
		});

		it('should return false when no profiles are currently installed', () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to return false for all paths
			mockExistsSync.mockReturnValue(false);

			const result = wouldRemovalLeaveNoProfiles(projectRoot, ['cursor']);
			expect(result).toBe(false);
		});
	});

	describe('MCP Safety Check Integration', () => {
		it('should block removal of all profiles without force', async () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to simulate installed profiles
			mockExistsSync.mockImplementation((filePath) => {
				return filePath.includes('.cursor') || filePath.includes('.roo');
			});

			const result = await rulesDirect(
				{
					action: 'remove',
					profiles: ['cursor', 'roo'],
					projectRoot,
					force: false
				},
				mockLog
			);

			expect(result.success).toBe(false);
			expect(result.error.code).toBe('CRITICAL_REMOVAL_BLOCKED');
			expect(result.error.message).toContain('CRITICAL');
		});

		it('should allow removal of all profiles with force', async () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync and other file operations for successful removal
			mockExistsSync.mockReturnValue(true);

			const result = await rulesDirect(
				{
					action: 'remove',
					profiles: ['cursor', 'roo'],
					projectRoot,
					force: true
				},
				mockLog
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
		});

		it('should allow partial removal without force', async () => {
			const projectRoot = '/test/project';

			// Mock fs.existsSync to simulate multiple profiles installed
			mockExistsSync.mockImplementation((filePath) => {
				return (
					filePath.includes('.cursor') ||
					filePath.includes('.roo') ||
					filePath.includes('.windsurf')
				);
			});

			const result = await rulesDirect(
				{
					action: 'remove',
					profiles: ['roo'], // Only removing one profile
					projectRoot,
					force: false
				},
				mockLog
			);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
		});
	});
});
