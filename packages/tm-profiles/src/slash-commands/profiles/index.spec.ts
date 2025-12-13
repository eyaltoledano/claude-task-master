/**
 * @fileoverview Unit tests for profile utility functions
 *
 * Tests the profile lookup and management functions exported from index.ts:
 * - getProfile(name) - returns profile by name (case-insensitive)
 * - getAllProfiles() - returns array of all profile instances
 * - getProfileNames() - returns array of profile names
 */

import { describe, expect, it } from 'vitest';
import {
	BaseSlashCommandProfile,
	ClaudeProfile,
	CodexProfile,
	CursorProfile,
	GeminiProfile,
	OpenCodeProfile,
	RooProfile,
	getAllProfiles,
	getProfile,
	getProfileNames
} from './index.js';

describe('Profile Utility Functions', () => {
	describe('getProfile', () => {
		describe('returns correct profile for valid names', () => {
			it('returns ClaudeProfile for "claude"', () => {
				// Arrange
				const name = 'claude';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(ClaudeProfile);
				expect(profile?.name).toBe('claude');
				expect(profile?.displayName).toBe('Claude Code');
			});

			it('returns CursorProfile for "cursor"', () => {
				// Arrange
				const name = 'cursor';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(CursorProfile);
				expect(profile?.name).toBe('cursor');
				expect(profile?.displayName).toBe('Cursor');
			});

			it('returns RooProfile for "roo"', () => {
				// Arrange
				const name = 'roo';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(RooProfile);
				expect(profile?.name).toBe('roo');
				expect(profile?.displayName).toBe('Roo Code');
			});

			it('returns GeminiProfile for "gemini"', () => {
				// Arrange
				const name = 'gemini';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(GeminiProfile);
				expect(profile?.name).toBe('gemini');
				expect(profile?.displayName).toBe('Gemini');
			});

			it('returns CodexProfile for "codex"', () => {
				// Arrange
				const name = 'codex';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(CodexProfile);
				expect(profile?.name).toBe('codex');
				expect(profile?.displayName).toBe('Codex');
			});
		});

		describe('case insensitive lookup', () => {
			it('returns ClaudeProfile for "CLAUDE" (uppercase)', () => {
				// Arrange
				const name = 'CLAUDE';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(ClaudeProfile);
				expect(profile?.name).toBe('claude');
			});

			it('returns ClaudeProfile for "Claude" (title case)', () => {
				// Arrange
				const name = 'Claude';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(ClaudeProfile);
				expect(profile?.name).toBe('claude');
			});

			it('returns ClaudeProfile for "cLaUdE" (mixed case)', () => {
				// Arrange
				const name = 'cLaUdE';

				// Act
				const profile = getProfile(name);

				// Assert
				expect(profile).toBeInstanceOf(ClaudeProfile);
				expect(profile?.name).toBe('claude');
			});

			it('handles case insensitivity for other profiles', () => {
				// Act & Assert
				expect(getProfile('CURSOR')).toBeInstanceOf(CursorProfile);
				expect(getProfile('Roo')).toBeInstanceOf(RooProfile);
				expect(getProfile('GEMINI')).toBeInstanceOf(GeminiProfile);
				expect(getProfile('CODEX')).toBeInstanceOf(CodexProfile);
				expect(getProfile('OPENCODE')).toBeInstanceOf(OpenCodeProfile);
			});
		});

		describe('unknown profile handling', () => {
			it('returns undefined for unknown profile name', () => {
				// Arrange
				const unknownName = 'unknown-profile';

				// Act
				const profile = getProfile(unknownName);

				// Assert
				expect(profile).toBeUndefined();
			});

			it('returns undefined for empty string', () => {
				// Arrange
				const emptyName = '';

				// Act
				const profile = getProfile(emptyName);

				// Assert
				expect(profile).toBeUndefined();
			});

			it('returns undefined for profile with typo', () => {
				// Arrange
				const typoName = 'cusor'; // missing 'r'

				// Act
				const profile = getProfile(typoName);

				// Assert
				expect(profile).toBeUndefined();
			});
		});
	});

	describe('getAllProfiles', () => {
		it('returns an array', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			expect(Array.isArray(profiles)).toBe(true);
		});

		it('contains 6 profiles', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			expect(profiles).toHaveLength(6);
		});

		it('each profile is a BaseSlashCommandProfile instance', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			for (const profile of profiles) {
				expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			}
		});

		it('contains all expected profile types', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			const profileTypes = profiles.map((p) => p.constructor.name);
			expect(profileTypes).toContain('ClaudeProfile');
			expect(profileTypes).toContain('CursorProfile');
			expect(profileTypes).toContain('RooProfile');
			expect(profileTypes).toContain('GeminiProfile');
			expect(profileTypes).toContain('CodexProfile');
			expect(profileTypes).toContain('OpenCodeProfile');
		});

		it('returns new array reference on each call (defensive copy)', () => {
			// Act
			const profiles1 = getAllProfiles();
			const profiles2 = getAllProfiles();

			// Assert - arrays should be different references
			expect(profiles1).not.toBe(profiles2);
			// But contain the same profile instances (singleton pattern)
			expect(profiles1).toEqual(profiles2);
		});

		it('each profile has required properties', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			for (const profile of profiles) {
				expect(profile.name).toBeDefined();
				expect(typeof profile.name).toBe('string');
				expect(profile.displayName).toBeDefined();
				expect(typeof profile.displayName).toBe('string');
				expect(profile.commandsDir).toBeDefined();
				expect(typeof profile.commandsDir).toBe('string');
				expect(profile.extension).toBeDefined();
				expect(typeof profile.extension).toBe('string');
			}
		});

		it('each profile has supportsCommands === true', () => {
			// Act
			const profiles = getAllProfiles();

			// Assert
			for (const profile of profiles) {
				expect(profile.supportsCommands).toBe(true);
			}
		});
	});

	describe('getProfileNames', () => {
		it('returns an array of strings', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(Array.isArray(names)).toBe(true);
			for (const name of names) {
				expect(typeof name).toBe('string');
			}
		});

		it('contains "claude"', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toContain('claude');
		});

		it('contains "cursor"', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toContain('cursor');
		});

		it('contains "roo"', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toContain('roo');
		});

		it('contains "gemini"', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toContain('gemini');
		});

		it('contains "codex"', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toContain('codex');
		});

		it('returns all 6 profile names', () => {
			// Act
			const names = getProfileNames();

			// Assert
			expect(names).toHaveLength(6);
			expect(names).toEqual(
				expect.arrayContaining([
					'claude',
					'cursor',
					'roo',
					'gemini',
					'codex',
					'opencode'
				])
			);
		});

		it('all names are lowercase', () => {
			// Act
			const names = getProfileNames();

			// Assert
			for (const name of names) {
				expect(name).toBe(name.toLowerCase());
			}
		});

		it('names match getProfile lookup keys', () => {
			// Act
			const names = getProfileNames();

			// Assert - each name should return a valid profile
			for (const name of names) {
				const profile = getProfile(name);
				expect(profile).toBeDefined();
				expect(profile?.name).toBe(name);
			}
		});
	});

	describe('profile singleton consistency', () => {
		it('getProfile returns same instance for repeated calls', () => {
			// Act
			const profile1 = getProfile('claude');
			const profile2 = getProfile('claude');

			// Assert - should be same singleton instance
			expect(profile1).toBe(profile2);
		});

		it('getAllProfiles contains same instances as getProfile', () => {
			// Act
			const allProfiles = getAllProfiles();
			const claudeFromGet = getProfile('claude');
			const claudeFromAll = allProfiles.find((p) => p.name === 'claude');

			// Assert
			expect(claudeFromGet).toBe(claudeFromAll);
		});
	});

	describe('Profile class instantiation', () => {
		it('can instantiate ClaudeProfile', () => {
			// Act
			const profile = new ClaudeProfile();

			// Assert
			expect(profile).toBeInstanceOf(ClaudeProfile);
			expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			expect(profile.name).toBe('claude');
			expect(profile.displayName).toBe('Claude Code');
			expect(profile.commandsDir).toBe('.claude/commands');
			expect(profile.extension).toBe('.md');
			expect(profile.supportsCommands).toBe(true);
		});

		it('can instantiate CodexProfile', () => {
			// Act
			const profile = new CodexProfile();

			// Assert
			expect(profile).toBeInstanceOf(CodexProfile);
			expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			expect(profile.name).toBe('codex');
			expect(profile.displayName).toBe('Codex');
			expect(profile.commandsDir).toBe('.codex/prompts');
			expect(profile.extension).toBe('.md');
			expect(profile.supportsCommands).toBe(true);
		});

		it('can instantiate CursorProfile', () => {
			// Act
			const profile = new CursorProfile();

			// Assert
			expect(profile).toBeInstanceOf(CursorProfile);
			expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			expect(profile.name).toBe('cursor');
			expect(profile.displayName).toBe('Cursor');
			expect(profile.commandsDir).toBe('.cursor/commands');
			expect(profile.extension).toBe('.md');
			expect(profile.supportsCommands).toBe(true);
		});

		it('can instantiate RooProfile', () => {
			// Act
			const profile = new RooProfile();

			// Assert
			expect(profile).toBeInstanceOf(RooProfile);
			expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			expect(profile.name).toBe('roo');
			expect(profile.displayName).toBe('Roo Code');
			expect(profile.commandsDir).toBe('.roo/commands');
			expect(profile.extension).toBe('.md');
			expect(profile.supportsCommands).toBe(true);
		});

		it('can instantiate GeminiProfile', () => {
			// Act
			const profile = new GeminiProfile();

			// Assert
			expect(profile).toBeInstanceOf(GeminiProfile);
			expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			expect(profile.name).toBe('gemini');
			expect(profile.displayName).toBe('Gemini');
			expect(profile.commandsDir).toBe('.gemini/commands');
			expect(profile.extension).toBe('.toml');
			expect(profile.supportsCommands).toBe(true);
		});

		it('all instantiated profiles extend BaseSlashCommandProfile', () => {
			// Act
			const profiles = [
				new ClaudeProfile(),
				new CodexProfile(),
				new CursorProfile(),
				new RooProfile(),
				new GeminiProfile(),
				new OpenCodeProfile()
			];

			// Assert
			for (const profile of profiles) {
				expect(profile).toBeInstanceOf(BaseSlashCommandProfile);
			}
		});
	});
});
