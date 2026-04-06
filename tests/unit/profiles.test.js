import { RULE_PROFILES } from '../../src/constants/profiles.js';
import { getRulesProfile } from '../../src/utils/rule-transformer.js';

describe('Antigravity profile', () => {
	it('is registered and resolves correctly', () => {
		expect(RULE_PROFILES).toContain('antigravity');
		const profile = getRulesProfile('antigravity');
		expect(profile).toBeDefined();
		expect(profile.displayName).toBe('Antigravity');
		expect(profile.mcpConfig).toBe(false);
	});
});
