import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import * as profilesModule from '../../../src/profiles/index.js';

/**
 * Integration tests for hamster rules distribution across all profiles.
 *
 * These tests verify that hamster.mdc is correctly distributed
 * to all profiles that include default rules when running `rules add`.
 */
describe('Hamster Rules Distribution', () => {
	const CLI_PATH = path.join(process.cwd(), 'dist', 'task-master.js');

	// Profiles that have includeDefaultRules: false and won't get hamster files via defaultFileMap
	const PROFILES_WITHOUT_DEFAULT_RULES = [
		'claude',
		'gemini',
		'codex',
		'amp',
		'opencode',
		'zed'
	];

	// Profiles that should receive hamster rules
	const PROFILES_WITH_DEFAULT_RULES = RULE_PROFILES.filter(
		(p) => !PROFILES_WITHOUT_DEFAULT_RULES.includes(p)
	);

	// Get expected hamster file path by reading from the actual profile object
	const getExpectedHamsterPath = (profileName, tempDir) => {
		const profile = profilesModule[`${profileName}Profile`];
		if (!profile || !profile.fileMap) return null;

		const rulesDir = profile.rulesDir;
		const hamsterTarget = profile.fileMap['rules/hamster.mdc'];

		if (!hamsterTarget) return null;

		return path.join(tempDir, rulesDir, hamsterTarget);
	};

	describe('Source files exist', () => {
		test('hamster.mdc exists in assets/rules', () => {
			const hamsterPath = path.join(
				process.cwd(),
				'assets',
				'rules',
				'hamster.mdc'
			);
			expect(fs.existsSync(hamsterPath)).toBe(true);
		});

		test('hamster.mdc has correct frontmatter', () => {
			const hamsterPath = path.join(
				process.cwd(),
				'assets',
				'rules',
				'hamster.mdc'
			);
			const content = fs.readFileSync(hamsterPath, 'utf8');
			expect(content).toContain('---');
			expect(content).toContain('description:');
			expect(content).toContain('globs:');
			expect(content).toContain('alwaysApply:');
			expect(content).toContain('Hamster Integration Workflow');
		});
	});

	describe('Rules add command distributes hamster file', () => {
		// Test each profile that should receive hamster rules
		PROFILES_WITH_DEFAULT_RULES.forEach((profile) => {
			test(`${profile} profile receives hamster rules via 'rules add'`, () => {
				// Create a unique temp directory for this test
				const tempDir = fs.mkdtempSync(
					path.join(os.tmpdir(), `tm-hamster-test-${profile}-`)
				);

				try {
					// Run the rules add command
					execSync(`node ${CLI_PATH} rules add ${profile}`, {
						cwd: tempDir,
						stdio: 'pipe',
						env: { ...process.env, TASKMASTER_LOG_LEVEL: 'error' }
					});

					// Get expected path for this profile
					const expectedPath = getExpectedHamsterPath(profile, tempDir);

					// Strictly enforce that all profiles with default rules must have hamster mapping
					expect(expectedPath).not.toBeNull();

					// Verify hamster.* file exists
					expect(fs.existsSync(expectedPath)).toBe(true);

					// Verify hamster file contains expected content
					const hamsterContent = fs.readFileSync(expectedPath, 'utf8');
					expect(hamsterContent).toContain('Hamster Integration Workflow');
					expect(hamsterContent).toContain('tm list');
					expect(hamsterContent).toContain('tm set-status');
				} finally {
					// Cleanup temp directory
					fs.rmSync(tempDir, { recursive: true, force: true });
				}
			});
		});
	});

	describe('Profiles without default rules', () => {
		// These profiles use different mechanisms (CLAUDE.md, AGENTS.md, etc.)
		// and don't include the defaultFileMap rules
		PROFILES_WITHOUT_DEFAULT_RULES.forEach((profile) => {
			test(`${profile} profile does not use defaultFileMap (has custom mechanism)`, async () => {
				// Dynamically import the profile to check its configuration
				const profileModule = await import(
					`../../../src/profiles/${profile}.js`
				);
				const profileExport = profileModule[`${profile}Profile`];

				// These profiles should have includeDefaultRules: false
				// which means they won't automatically get hamster files via defaultFileMap
				expect(profileExport.includeDefaultRules).toBe(false);
			});
		});
	});
});
