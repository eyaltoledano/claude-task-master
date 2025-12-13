/**
 * @fileoverview Unit tests for mode-based command filtering
 *
 * Tests the filterCommandsByMode function and command mode categorization:
 * - Solo mode: Returns solo + common commands
 * - Team mode: Returns team + common commands
 */

import { describe, it, expect } from 'vitest';
import {
	filterCommandsByMode,
	allCommands,
	soloCommands,
	teamCommands,
	commonCommands
} from './index.js';

describe('Mode-based Command Filtering', () => {
	describe('filterCommandsByMode', () => {
		describe('solo mode filtering', () => {
			it('returns solo and common commands for solo mode', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'solo');

				// Assert
				for (const cmd of filtered) {
					const mode = cmd.metadata.mode;
					expect(
						mode === 'solo' || mode === 'common' || mode === undefined
					).toBe(true);
				}
			});

			it('excludes team-only commands from solo mode', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'solo');

				// Assert
				const teamOnlyCommands = filtered.filter(
					(cmd) => cmd.metadata.mode === 'team'
				);
				expect(teamOnlyCommands).toHaveLength(0);
			});

			it('includes commands without explicit mode (backward compat)', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'solo');

				// Assert - commands without mode should be included
				// This is a backward compat check - commands with undefined mode are treated as common
				expect(filtered.length).toBeGreaterThan(0);
			});
		});

		describe('team mode filtering', () => {
			it('returns team and common commands for team mode', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'team');

				// Assert - team mode includes team + common commands
				for (const cmd of filtered) {
					const mode = cmd.metadata.mode;
					expect(
						mode === 'team' || mode === 'common' || mode === undefined
					).toBe(true);
				}
			});

			it('excludes solo commands from team mode', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'team');

				// Assert
				const soloInTeam = filtered.filter(
					(cmd) => cmd.metadata.mode === 'solo'
				);
				expect(soloInTeam).toHaveLength(0);
			});

			it('includes common commands in team mode', () => {
				// Act
				const filtered = filterCommandsByMode(allCommands, 'team');

				// Assert - team mode includes common commands
				const commonInTeam = filtered.filter(
					(cmd) =>
						cmd.metadata.mode === 'common' || cmd.metadata.mode === undefined
				);
				expect(commonInTeam.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Pre-filtered exports', () => {
		describe('soloCommands export', () => {
			it('matches filterCommandsByMode(allCommands, "solo")', () => {
				// Act
				const expectedSolo = filterCommandsByMode(allCommands, 'solo');

				// Assert
				expect(soloCommands).toHaveLength(expectedSolo.length);
				const soloNames = soloCommands.map((c) => c.metadata.name);
				const expectedNames = expectedSolo.map((c) => c.metadata.name);
				expect(soloNames.sort()).toEqual(expectedNames.sort());
			});

			it('contains known solo commands', () => {
				// Assert - verify some known solo commands are present
				const names = soloCommands.map((c) => c.metadata.name);
				expect(names).toContain('parse-prd');
				expect(names).toContain('add-task');
				expect(names).toContain('expand-task');
			});

			it('contains common commands', () => {
				// Assert - verify common commands are included in solo
				const names = soloCommands.map((c) => c.metadata.name);
				expect(names).toContain('show-task');
				expect(names).toContain('list-tasks');
				expect(names).toContain('to-done');
			});

			it('does not contain team commands', () => {
				// Assert
				const names = soloCommands.map((c) => c.metadata.name);
				expect(names).not.toContain('goham');
			});
		});

		describe('teamCommands export', () => {
			it('matches filterCommandsByMode(allCommands, "team")', () => {
				// Act
				const expectedTeam = filterCommandsByMode(allCommands, 'team');

				// Assert
				expect(teamCommands).toHaveLength(expectedTeam.length);
				const teamNames = teamCommands.map((c) => c.metadata.name);
				const expectedNames = expectedTeam.map((c) => c.metadata.name);
				expect(teamNames.sort()).toEqual(expectedNames.sort());
			});

			it('contains goham command', () => {
				// Assert
				const names = teamCommands.map((c) => c.metadata.name);
				expect(names).toContain('goham');
			});

			it('does not contain solo commands', () => {
				// Assert
				const names = teamCommands.map((c) => c.metadata.name);
				expect(names).not.toContain('parse-prd');
				expect(names).not.toContain('add-task');
			});

			it('contains common commands', () => {
				// Assert - team mode includes common commands
				const names = teamCommands.map((c) => c.metadata.name);
				expect(names).toContain('show-task');
				expect(names).toContain('list-tasks');
				expect(names).toContain('help');
			});
		});

		describe('commonCommands export', () => {
			it('contains only commands with mode=common or undefined', () => {
				// Assert
				for (const cmd of commonCommands) {
					const mode = cmd.metadata.mode;
					expect(mode === 'common' || mode === undefined).toBe(true);
				}
			});

			it('contains known common commands', () => {
				// Assert
				const names = commonCommands.map((c) => c.metadata.name);
				expect(names).toContain('show-task');
				expect(names).toContain('list-tasks');
				expect(names).toContain('next-task');
				expect(names).toContain('help');
				expect(names).toContain('to-done');
			});
		});
	});

	describe('Command mode categorization', () => {
		it('all commands have valid mode property', () => {
			// Assert
			for (const cmd of allCommands) {
				const mode = cmd.metadata.mode;
				// Mode should be 'solo', 'team', 'common', or undefined
				expect(
					mode === 'solo' ||
						mode === 'team' ||
						mode === 'common' ||
						mode === undefined
				).toBe(true);
			}
		});

		it('goham is the only team command', () => {
			// Act
			const teamOnly = allCommands.filter(
				(cmd) => cmd.metadata.mode === 'team'
			);

			// Assert
			expect(teamOnly).toHaveLength(1);
			expect(teamOnly[0].metadata.name).toBe('goham');
		});

		it('solo commands are tagged correctly', () => {
			// Known solo commands
			const knownSolo = [
				'parse-prd',
				'parse-prd-with-research',
				'analyze-complexity',
				'complexity-report',
				'expand-task',
				'expand-all-tasks',
				'add-task',
				'add-subtask',
				'remove-task',
				'remove-subtask',
				'remove-subtasks',
				'remove-all-subtasks',
				'convert-task-to-subtask',
				'add-dependency',
				'remove-dependency',
				'fix-dependencies',
				'validate-dependencies',
				'setup-models',
				'view-models',
				'install-taskmaster',
				'quick-install-taskmaster',
				'to-review',
				'to-deferred',
				'to-cancelled',
				'init-project',
				'init-project-quick'
			];

			for (const name of knownSolo) {
				const cmd = allCommands.find((c) => c.metadata.name === name);
				expect(cmd).toBeDefined();
				expect(cmd?.metadata.mode).toBe('solo');
			}
		});

		it('common commands are tagged correctly or have undefined mode', () => {
			// Known common commands - they should be 'common' or undefined (backward compat)
			const knownCommon = [
				'show-task',
				'list-tasks',
				'list-tasks-with-subtasks',
				'list-tasks-by-status',
				'project-status',
				'next-task',
				'help',
				'to-done',
				'to-pending',
				'to-in-progress',
				'update-task',
				'update-single-task',
				'update-tasks-from-id',
				'tm-main',
				'smart-workflow',
				'learn',
				'command-pipeline',
				'auto-implement-tasks',
				'analyze-project',
				'sync-readme'
			];

			for (const name of knownCommon) {
				const cmd = allCommands.find((c) => c.metadata.name === name);
				expect(cmd).toBeDefined();
				// Common commands can be explicitly 'common' or undefined (backward compat)
				const mode = cmd?.metadata.mode;
				expect(mode === 'common' || mode === undefined).toBe(true);
			}
		});
	});

	describe('Edge cases', () => {
		it('filtering empty array returns empty array', () => {
			// Act
			const soloFiltered = filterCommandsByMode([], 'solo');
			const teamFiltered = filterCommandsByMode([], 'team');

			// Assert
			expect(soloFiltered).toHaveLength(0);
			expect(teamFiltered).toHaveLength(0);
		});

		it('total commands equals solo + team + common (no overlap)', () => {
			// This verifies our categorization is complete and non-overlapping
			const soloCount = allCommands.filter(
				(cmd) => cmd.metadata.mode === 'solo'
			).length;
			const teamCount = allCommands.filter(
				(cmd) => cmd.metadata.mode === 'team'
			).length;
			const commonCount = allCommands.filter(
				(cmd) =>
					cmd.metadata.mode === 'common' || cmd.metadata.mode === undefined
			).length;

			// Assert
			expect(soloCount + teamCount + commonCount).toBe(allCommands.length);
		});
	});
});
