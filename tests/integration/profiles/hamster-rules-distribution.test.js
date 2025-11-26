import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { RULE_PROFILES } from '../../../src/constants/profiles.js';
import * as profilesModule from '../../../src/profiles/index.js';

/**
 * Integration tests for hamster rules distribution across all profiles.
 *
 * These tests verify that hamster.mdc and goham.md are correctly distributed
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

	// Get expected hamster file paths by reading from the actual profile object
	const getExpectedHamsterPaths = (profileName, tempDir) => {
		const profile = profilesModule[`${profileName}Profile`];
		if (!profile || !profile.fileMap) return null;

		const rulesDir = profile.rulesDir;
		const hamsterTarget = profile.fileMap['rules/hamster.mdc'];
		const gohamTarget = profile.fileMap['rules/goham.md'];

		if (!hamsterTarget || !gohamTarget) return null;

		return {
			hamster: path.join(tempDir, rulesDir, hamsterTarget),
			goham: path.join(tempDir, rulesDir, gohamTarget)
		};
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

		test('goham.md exists in assets/rules', () => {
			const gohamPath = path.join(process.cwd(), 'assets', 'rules', 'goham.md');
			expect(fs.existsSync(gohamPath)).toBe(true);
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

	describe('Rules add command distributes hamster files', () => {
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

					// Get expected paths for this profile
					const expectedPaths = getExpectedHamsterPaths(profile, tempDir);

					if (expectedPaths) {
						// Verify hamster.* file exists
						expect(fs.existsSync(expectedPaths.hamster)).toBe(true);

						// Verify goham.* file exists
						expect(fs.existsSync(expectedPaths.goham)).toBe(true);

						// Verify hamster file contains expected content
						const hamsterContent = fs.readFileSync(
							expectedPaths.hamster,
							'utf8'
						);
						expect(hamsterContent).toContain('Hamster Integration Workflow');
						expect(hamsterContent).toContain('tm list');
						expect(hamsterContent).toContain('tm set-status');

						// Verify goham file contains expected content
						const gohamContent = fs.readFileSync(expectedPaths.goham, 'utf8');
						expect(gohamContent).toContain('Start Working with Hamster Brief');
						expect(gohamContent).toContain('tm context');
					}
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
