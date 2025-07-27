import fs from 'fs';
import path from 'path';
import { traeProfile } from '../../../src/profiles/trae.js';

describe('Trae Profile Initialization Functionality', () => {
	let traeProfileContent;

	beforeAll(() => {
		const traeJsPath = path.join(process.cwd(), 'src', 'profiles', 'trae.js');
		traeProfileContent = fs.readFileSync(traeJsPath, 'utf8');
	});

	test('trae.js uses ProfileBuilder pattern with correct configuration', () => {
		// Check for ProfileBuilder pattern in the source file
		expect(traeProfileContent).toContain('ProfileBuilder');
		expect(traeProfileContent).toContain(".minimal('trae')");
		expect(traeProfileContent).toContain(".display('Trae')");

		// Check the final computed properties on the profile instance
		expect(traeProfile.profileName).toBe('trae');
		expect(traeProfile.displayName).toBe('Trae');
		expect(traeProfile.profileDir).toBe('.trae');
		expect(traeProfile.rulesDir).toBe('.trae/rules');
		expect(traeProfile.includeDefaultRules).toBe(true);

		// Verify Profile instance structure
		expect(traeProfile.conversionConfig).toHaveProperty('profileTerms');
		expect(traeProfile.conversionConfig).toHaveProperty('docUrls');
		expect(traeProfile.conversionConfig).toHaveProperty('toolNames');
		expect(traeProfile.globalReplacements).toBeInstanceOf(Array);
		expect(traeProfile.globalReplacements.length).toBeGreaterThan(0);
	});

	test('trae profile has correct MCP configuration', () => {
		expect(traeProfile.mcpConfig).toBe(false);
		expect(traeProfile.mcpConfigName).toBeNull();
		expect(traeProfile.mcpConfigPath).toBeNull();
	});

	test('trae profile is immutable', () => {
		// Test that the profile object is frozen/immutable
		expect(() => {
			traeProfile.profileName = 'modified';
		}).toThrow();

		expect(() => {
			traeProfile.newProperty = 'test';
		}).toThrow();
	});

	test('trae profile includes conversion configuration', () => {
		const { conversionConfig } = traeProfile;

		expect(conversionConfig.profileTerms).toBeInstanceOf(Array);
		expect(conversionConfig.profileTerms.length).toBeGreaterThan(0);

		expect(conversionConfig.docUrls).toBeInstanceOf(Array);
		expect(conversionConfig.docUrls.length).toBeGreaterThan(0);

		expect(conversionConfig.toolNames).toBeInstanceOf(Object);
		expect(Object.keys(conversionConfig.toolNames).length).toBeGreaterThan(0);
	});
});
