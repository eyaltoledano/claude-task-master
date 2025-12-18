import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	detectInstalledIDEs,
	detectProfile,
	getPreSelectedProfiles
} from './detector.js';
import { IDE_MARKERS } from './profiles-map.js';

// Use real fs operations with temp directories for accurate testing
describe('IDE Detection', () => {
	let tempDir: string;

	beforeEach(() => {
		// Create a real temp directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-detection-test-'));
	});

	afterEach(() => {
		// Clean up temp directory
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe('detectInstalledIDEs', () => {
		it('should detect a single IDE directory', () => {
			// Arrange - create .cursor directory
			fs.mkdirSync(path.join(tempDir, '.cursor'));

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				profileName: 'cursor',
				markerPath: '.cursor',
				displayName: 'Cursor',
				exists: true
			});
		});

		it('should detect multiple IDE directories', () => {
			// Arrange - create multiple IDE directories
			fs.mkdirSync(path.join(tempDir, '.cursor'));
			fs.mkdirSync(path.join(tempDir, '.claude'));
			fs.mkdirSync(path.join(tempDir, '.windsurf'));

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert
			expect(results).toHaveLength(3);
			const profileNames = results.map((r) => r.profileName);
			expect(profileNames).toContain('cursor');
			expect(profileNames).toContain('claude');
			expect(profileNames).toContain('windsurf');
		});

		it('should return empty array when no IDEs are detected', () => {
			// Act - tempDir has no IDE directories
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert
			expect(results).toHaveLength(0);
		});

		it('should detect directory markers for all directory-based profiles', () => {
			// Arrange - create all directory-based markers
			const directoryMarkers = [
				'.cursor',
				'.claude',
				'.windsurf',
				'.roo',
				'.cline',
				'.vscode',
				'.kiro',
				'.zed',
				'.kilo',
				'.trae',
				'.gemini',
				'.opencode',
				'.codex'
			];

			for (const marker of directoryMarkers) {
				fs.mkdirSync(path.join(tempDir, marker));
			}

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert
			expect(results.length).toBe(directoryMarkers.length);
		});

		it('should detect file-based markers (GEMINI.md)', () => {
			// Arrange - create GEMINI.md file (but no .gemini directory)
			fs.writeFileSync(path.join(tempDir, 'GEMINI.md'), '# Gemini config');

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert
			expect(results).toHaveLength(1);
			expect(results[0]).toEqual({
				profileName: 'gemini',
				markerPath: 'GEMINI.md',
				displayName: 'Gemini',
				exists: true
			});
		});

		it('should prefer directory marker over file marker for Gemini', () => {
			// Arrange - create both .gemini directory and GEMINI.md file
			fs.mkdirSync(path.join(tempDir, '.gemini'));
			fs.writeFileSync(path.join(tempDir, 'GEMINI.md'), '# Gemini config');

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert - should only detect once, with directory marker
			const geminiResults = results.filter((r) => r.profileName === 'gemini');
			expect(geminiResults).toHaveLength(1);
			expect(geminiResults[0].markerPath).toBe('.gemini');
		});

		it('should not detect files as directories', () => {
			// Arrange - create a file named .cursor instead of directory
			fs.writeFileSync(path.join(tempDir, '.cursor'), 'not a directory');

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert - should not detect because it's a file, not a directory
			expect(results.filter((r) => r.profileName === 'cursor')).toHaveLength(0);
		});

		it('should not detect directories as files', () => {
			// Arrange - create a directory named GEMINI.md instead of file
			fs.mkdirSync(path.join(tempDir, 'GEMINI.md'));

			// Act
			const results = detectInstalledIDEs({ projectRoot: tempDir });

			// Assert - should not detect GEMINI.md as it's a directory, not a file
			const geminiResults = results.filter((r) => r.profileName === 'gemini');
			expect(geminiResults).toHaveLength(0);
		});
	});

	describe('getPreSelectedProfiles', () => {
		it('should return profile names only', () => {
			// Arrange
			fs.mkdirSync(path.join(tempDir, '.cursor'));
			fs.mkdirSync(path.join(tempDir, '.claude'));

			// Act
			const profiles = getPreSelectedProfiles({ projectRoot: tempDir });

			// Assert
			expect(profiles).toEqual(expect.arrayContaining(['cursor', 'claude']));
			expect(profiles).toHaveLength(2);
		});

		it('should return empty array when no IDEs detected', () => {
			// Act
			const profiles = getPreSelectedProfiles({ projectRoot: tempDir });

			// Assert
			expect(profiles).toEqual([]);
		});
	});

	describe('detectProfile', () => {
		it('should return detection result for existing profile', () => {
			// Arrange
			fs.mkdirSync(path.join(tempDir, '.cursor'));

			// Act
			const result = detectProfile('cursor', tempDir);

			// Assert
			expect(result).toEqual({
				profileName: 'cursor',
				markerPath: '.cursor',
				displayName: 'Cursor',
				exists: true
			});
		});

		it('should return null for non-existing profile', () => {
			// Act - no .cursor directory exists
			const result = detectProfile('cursor', tempDir);

			// Assert
			expect(result).toBeNull();
		});

		it('should return null for non-detectable profile (amp)', () => {
			// Act
			const result = detectProfile('amp', tempDir);

			// Assert
			expect(result).toBeNull();
		});
	});
});

describe('IDE_MARKERS', () => {
	it('should have 13 detectable profiles', () => {
		// amp is not detectable
		expect(IDE_MARKERS).toHaveLength(13);
	});

	it('should have valid marker definitions for all profiles', () => {
		for (const marker of IDE_MARKERS) {
			expect(marker.profileName).toBeTruthy();
			expect(marker.displayName).toBeTruthy();
			expect(marker.markers).toBeInstanceOf(Array);
			expect(marker.markers.length).toBeGreaterThan(0);

			for (const m of marker.markers) {
				expect(m.path).toBeTruthy();
				expect(['directory', 'file']).toContain(m.type);
			}
		}
	});

	it('should include cursor, claude, and windsurf profiles', () => {
		const profileNames = IDE_MARKERS.map((m) => m.profileName);
		expect(profileNames).toContain('cursor');
		expect(profileNames).toContain('claude');
		expect(profileNames).toContain('windsurf');
	});

	it('should not include amp (no known marker)', () => {
		const profileNames = IDE_MARKERS.map((m) => m.profileName);
		expect(profileNames).not.toContain('amp');
	});
});
