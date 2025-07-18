import fs from 'fs';
import path from 'path';
import { windsurfProfile } from '../../../src/profiles/windsurf.js';

describe('Windsurf Profile Initialization Functionality', () => {
	let windsurfProfileContent;

	beforeAll(() => {
		const windsurfJsPath = path.join(
			process.cwd(),
			'src',
			'profiles',
			'windsurf.js'
		);
		windsurfProfileContent = fs.readFileSync(windsurfJsPath, 'utf8');
	});

	test('windsurf.js uses ProfileBuilder pattern with correct configuration', () => {
		// Check for ProfileBuilder pattern in the source file
		expect(windsurfProfileContent).toContain("ProfileBuilder");
		expect(windsurfProfileContent).toContain(".minimal('windsurf')");
		expect(windsurfProfileContent).toContain(".display('Windsurf')");

		// Check the final computed properties on the profile instance
		expect(windsurfProfile.profileName).toBe('windsurf');
		expect(windsurfProfile.displayName).toBe('Windsurf');
		expect(windsurfProfile.profileDir).toBe('.windsurfrules');
		expect(windsurfProfile.rulesDir).toBe('.windsurfrules');
		expect(windsurfProfile.includeDefaultRules).toBe(true);

		// Verify Profile instance structure
		expect(windsurfProfile.conversionConfig).toHaveProperty('profileTerms');
		expect(windsurfProfile.conversionConfig).toHaveProperty('docUrls');
		expect(windsurfProfile.conversionConfig).toHaveProperty('toolNames');
		expect(windsurfProfile.globalReplacements).toBeInstanceOf(Array);
		expect(windsurfProfile.globalReplacements.length).toBeGreaterThan(0);
	});

	test('windsurf profile has correct MCP configuration', () => {
		expect(windsurfProfile.mcpConfig).toEqual({ configName: 'windsurf_mcp.json' });
		expect(windsurfProfile.mcpConfigName).toBe('windsurf_mcp.json');
		expect(windsurfProfile.mcpConfigPath).toBe('.windsurfrules/windsurf_mcp.json');
	});

	test('windsurf profile provides legacy format conversion', () => {
		// Test that toLegacyFormat() works correctly
		const legacyFormat = windsurfProfile.toLegacyFormat();
		
		expect(legacyFormat.profileName).toBe('windsurf');
		expect(legacyFormat.displayName).toBe('Windsurf');
		expect(legacyFormat.conversionConfig).toHaveProperty('profileTerms');
		expect(legacyFormat.globalReplacements).toBeInstanceOf(Array);
	});

	test('windsurf profile is immutable', () => {
		// Test that the profile object is frozen/immutable
		expect(() => {
			windsurfProfile.profileName = 'modified';
		}).toThrow();
		
		expect(() => {
			windsurfProfile.newProperty = 'test';
		}).toThrow();
	});

	test('windsurf profile includes conversion configuration', () => {
		const { conversionConfig } = windsurfProfile;
		
		expect(conversionConfig.profileTerms).toBeInstanceOf(Array);
		expect(conversionConfig.profileTerms.length).toBeGreaterThan(0);
		
		expect(conversionConfig.docUrls).toBeInstanceOf(Array);
		expect(conversionConfig.docUrls.length).toBeGreaterThan(0);
		
		expect(conversionConfig.toolNames).toBeInstanceOf(Object);
		expect(Object.keys(conversionConfig.toolNames).length).toBeGreaterThan(0);
	});
});
