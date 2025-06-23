// Test for supportsRulesSubdirectories feature
import { getRulesProfile } from '../../../src/utils/rule-transformer.js';

describe('Rules Subdirectory Support Feature', () => {
	it('should support taskmaster subdirectories only for Cursor profile', () => {
		// Test Cursor profile - should use subdirectories
		const cursorProfile = getRulesProfile('cursor');
		expect(cursorProfile.supportsRulesSubdirectories).toBe(true);

		// Verify that Cursor uses taskmaster subdirectories in its file mapping
		expect(cursorProfile.fileMap['rules/dev_workflow.mdc']).toBe(
			'taskmaster/dev_workflow.mdc'
		);
		expect(cursorProfile.fileMap['rules/taskmaster.mdc']).toBe(
			'taskmaster/taskmaster.mdc'
		);
	});

	it('should not use taskmaster subdirectories for other profiles', () => {
		// Test profiles that should NOT use subdirectories (new default)
		const profiles = ['roo', 'vscode', 'cline', 'windsurf', 'trae'];

		profiles.forEach((profileName) => {
			const profile = getRulesProfile(profileName);
			expect(profile.supportsRulesSubdirectories).toBe(false);

			// Verify that these profiles do NOT use taskmaster subdirectories in their file mapping
			const expectedExt = profile.targetExtension || '.md';
			expect(profile.fileMap['rules/dev_workflow.mdc']).toBe(
				`dev_workflow${expectedExt}`
			);
			expect(profile.fileMap['rules/taskmaster.mdc']).toBe(
				`taskmaster${expectedExt}`
			);
		});
	});

	it('should have supportsRulesSubdirectories property accessible on all profiles', () => {
		const allProfiles = [
			'cursor',
			'roo',
			'vscode',
			'cline',
			'windsurf',
			'trae'
		];

		allProfiles.forEach((profileName) => {
			const profile = getRulesProfile(profileName);
			expect(profile).toBeDefined();
			expect(typeof profile.supportsRulesSubdirectories).toBe('boolean');
		});
	});

	it('should default to false for supportsRulesSubdirectories when not specified', () => {
		// Most profiles should now default to NOT supporting subdirectories
		const profiles = ['roo', 'windsurf', 'trae', 'vscode', 'cline'];

		profiles.forEach((profileName) => {
			const profile = getRulesProfile(profileName);
			expect(profile.supportsRulesSubdirectories).toBe(false);
		});
	});
});
