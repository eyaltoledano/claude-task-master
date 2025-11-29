import { jest } from '@jest/globals';

// Mock console methods to avoid chalk issues
const mockConsole = {
	log: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	clear: jest.fn()
};
const originalConsole = global.console;
global.console = mockConsole;

// Mock the utils logger
const mockLog = jest.fn();
await jest.unstable_mockModule('../../../scripts/modules/utils.js', () => ({
	default: undefined,
	log: mockLog,
	isSilentMode: () => false
}));

// Mock @tm/profiles module
const mockGetProfile = jest.fn();
const mockAllCommands = [
	{
		type: 'static',
		metadata: { name: 'help', description: 'Show help' },
		content: 'Help content'
	},
	{
		type: 'dynamic',
		metadata: {
			name: 'show-task',
			description: 'Show task',
			argumentHint: '[task-id]'
		},
		content: 'Show task $ARGUMENTS'
	}
];

await jest.unstable_mockModule('@tm/profiles', () => ({
	getProfile: mockGetProfile,
	allCommands: mockAllCommands
}));

// Import createProfile after mocking
const { createProfile } = await import('../../../src/profiles/base-profile.js');

describe('Base Profile - Declarative Slash Commands', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterAll(() => {
		global.console = originalConsole;
	});

	describe('slashCommands config when profile supports commands', () => {
		it('should include slashCommands config when profile supports slash commands', () => {
			// Arrange - Mock a profile that supports commands
			const mockSlashProfile = {
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			};
			mockGetProfile.mockReturnValue(mockSlashProfile);

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com'
			});

			// Assert - Profile should have slashCommands config
			expect(profile.slashCommands).toBeDefined();
			expect(profile.slashCommands.profile).toBe(mockSlashProfile);
			expect(profile.slashCommands.commands).toBe(mockAllCommands);
		});

		it('should include profile methods in slashCommands config', () => {
			// Arrange
			const mockAddSlashCommands = jest.fn();
			const mockRemoveSlashCommands = jest.fn();
			mockGetProfile.mockReturnValue({
				supportsCommands: true,
				addSlashCommands: mockAddSlashCommands,
				removeSlashCommands: mockRemoveSlashCommands
			});

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com'
			});

			// Assert - Methods should be accessible
			expect(profile.slashCommands.profile.addSlashCommands).toBe(
				mockAddSlashCommands
			);
			expect(profile.slashCommands.profile.removeSlashCommands).toBe(
				mockRemoveSlashCommands
			);
		});
	});

	describe('No slashCommands config when profile does not support commands', () => {
		it('should not include slashCommands when profile does not support slash commands', () => {
			// Arrange - Mock a profile that does NOT support commands
			mockGetProfile.mockReturnValue({
				supportsCommands: false,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			});

			// Act
			const profile = createProfile({
				name: 'amp',
				displayName: 'Amp',
				url: 'amp.rs',
				docsUrl: 'docs.amp.rs'
			});

			// Assert - Profile should NOT have slashCommands config
			expect(profile.slashCommands).toBeNull();
		});

		it('should not include slashCommands when getProfile returns null', () => {
			// Arrange
			mockGetProfile.mockReturnValue(null);

			// Act
			const profile = createProfile({
				name: 'unknown',
				displayName: 'Unknown Editor',
				url: 'example.com',
				docsUrl: 'docs.example.com'
			});

			// Assert
			expect(profile.slashCommands).toBeNull();
		});

		it('should not include slashCommands when getProfile returns undefined', () => {
			// Arrange
			mockGetProfile.mockReturnValue(undefined);

			// Act
			const profile = createProfile({
				name: 'another-unknown',
				displayName: 'Another Unknown',
				url: 'example.org',
				docsUrl: 'docs.example.org'
			});

			// Assert
			expect(profile.slashCommands).toBeNull();
		});
	});

	describe('User hooks remain independent of slashCommands', () => {
		it('should keep user onAdd hook separate from slashCommands', () => {
			// Arrange
			mockGetProfile.mockReturnValue({
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			});

			const userOnAdd = jest.fn();

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com',
				onAdd: userOnAdd
			});

			// Assert - Both should exist independently
			expect(profile.slashCommands).toBeDefined();
			expect(profile.onAddRulesProfile).toBe(userOnAdd);
		});

		it('should keep user onRemove hook separate from slashCommands', () => {
			// Arrange
			mockGetProfile.mockReturnValue({
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			});

			const userOnRemove = jest.fn();

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com',
				onRemove: userOnRemove
			});

			// Assert - Both should exist independently
			expect(profile.slashCommands).toBeDefined();
			expect(profile.onRemoveRulesProfile).toBe(userOnRemove);
		});

		it('should preserve user hooks when profile does not support commands', () => {
			// Arrange
			mockGetProfile.mockReturnValue({
				supportsCommands: false
			});

			const userOnAdd = jest.fn();
			const userOnRemove = jest.fn();

			// Act
			const profile = createProfile({
				name: 'amp',
				displayName: 'Amp',
				url: 'amp.rs',
				docsUrl: 'docs.amp.rs',
				onAdd: userOnAdd,
				onRemove: userOnRemove
			});

			// Assert
			expect(profile.slashCommands).toBeNull();
			expect(profile.onAddRulesProfile).toBe(userOnAdd);
			expect(profile.onRemoveRulesProfile).toBe(userOnRemove);
		});
	});

	describe('Error handling for getProfile', () => {
		it('should handle getProfile throwing an error gracefully', () => {
			// Arrange
			mockGetProfile.mockImplementation(() => {
				throw new Error('Module not found');
			});

			// Act - Should not throw
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com'
			});

			// Assert
			expect(profile.slashCommands).toBeNull();
			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				'[Cursor] Slash command profile lookup failed: Module not found'
			);
		});

		it('should preserve user hooks when getProfile throws', () => {
			// Arrange
			mockGetProfile.mockImplementation(() => {
				throw new Error('@tm/profiles not installed');
			});

			const userOnAdd = jest.fn();
			const userOnRemove = jest.fn();

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com',
				onAdd: userOnAdd,
				onRemove: userOnRemove
			});

			// Assert
			expect(profile.slashCommands).toBeNull();
			expect(profile.onAddRulesProfile).toBe(userOnAdd);
			expect(profile.onRemoveRulesProfile).toBe(userOnRemove);
			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				'[Cursor] Slash command profile lookup failed: @tm/profiles not installed'
			);
		});
	});

	describe('Profile metadata preserved', () => {
		it('should preserve all profile metadata alongside slashCommands', () => {
			// Arrange
			mockGetProfile.mockReturnValue({
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			});

			// Act
			const profile = createProfile({
				name: 'cursor',
				displayName: 'Cursor IDE',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com',
				profileDir: '.cursor',
				rulesDir: '.cursor/rules',
				mcpConfig: true
			});

			// Assert - All metadata should be present
			expect(profile.profileName).toBe('cursor');
			expect(profile.displayName).toBe('Cursor IDE');
			expect(profile.profileDir).toBe('.cursor');
			expect(profile.rulesDir).toBe('.cursor/rules');
			expect(profile.mcpConfig).toBe(true);
			expect(profile.slashCommands).toBeDefined();
		});

		it('should use displayName in error logs', () => {
			// Arrange
			mockGetProfile.mockImplementation(() => {
				throw new Error('Test error');
			});

			// Act
			createProfile({
				name: 'cursor',
				displayName: 'Cursor IDE Pro',
				url: 'cursor.com',
				docsUrl: 'docs.cursor.com'
			});

			// Assert
			expect(mockLog).toHaveBeenCalledWith(
				'debug',
				'[Cursor IDE Pro] Slash command profile lookup failed: Test error'
			);
		});
	});

	describe('Integration with different profile types', () => {
		it('should work with Roo profile configuration', () => {
			// Arrange
			const rooSlashProfile = {
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			};
			mockGetProfile.mockReturnValue(rooSlashProfile);

			// Act
			const profile = createProfile({
				name: 'roo',
				displayName: 'Roo Code',
				url: 'roo.codes',
				docsUrl: 'docs.roo.codes',
				profileDir: '.roo',
				rulesDir: '.roo/rules'
			});

			// Assert
			expect(profile.slashCommands).toBeDefined();
			expect(profile.slashCommands.profile).toBe(rooSlashProfile);
			expect(profile.rulesDir).toBe('.roo/rules');
		});

		it('should work with OpenCode profile configuration', () => {
			// Arrange
			const opencodeSlashProfile = {
				supportsCommands: true,
				addSlashCommands: jest.fn(),
				removeSlashCommands: jest.fn()
			};
			mockGetProfile.mockReturnValue(opencodeSlashProfile);

			// Act
			const profile = createProfile({
				name: 'opencode',
				displayName: 'OpenCode',
				url: 'opencode.app',
				docsUrl: 'docs.opencode.app',
				profileDir: '.opencode',
				rulesDir: '.opencode/prompts'
			});

			// Assert
			expect(profile.slashCommands).toBeDefined();
			expect(profile.slashCommands.profile).toBe(opencodeSlashProfile);
			expect(profile.rulesDir).toBe('.opencode/prompts');
		});
	});
});
