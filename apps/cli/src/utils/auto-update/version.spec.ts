import { describe, expect, it } from 'vitest';

import { compareVersions } from './version.js';

describe('compareVersions', () => {
	it('compares equal versions', () => {
		expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('0.43.0', '0.43.0')).toBe(0);
	});

	it('compares different patch versions', () => {
		expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
		expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
	});

	it('compares different minor versions', () => {
		expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
		expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
	});

	it('compares different major versions', () => {
		expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
		expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
	});

	it('handles missing patch segment', () => {
		expect(compareVersions('1.0', '1.0.0')).toBe(0);
	});

	it('handles extra segments', () => {
		expect(compareVersions('1.0.0.0', '1.0.0')).toBe(0);
		expect(compareVersions('1.0.0', '1.0.0.1')).toBe(-1);
	});

	describe('prerelease handling', () => {
		it('treats prerelease as less than release with same core version', () => {
			expect(compareVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
			expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
		});

		it('compares RC versions with numeric identifiers correctly', () => {
			expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1);
			expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.1')).toBe(1);
			expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0);
		});

		it('handles double-digit RC numbers correctly (rc.9 < rc.10)', () => {
			expect(compareVersions('1.0.0-rc.9', '1.0.0-rc.10')).toBe(-1);
			expect(compareVersions('1.0.0-rc.10', '1.0.0-rc.9')).toBe(1);
			expect(compareVersions('1.0.0-rc.10', '1.0.0-rc.10')).toBe(0);
		});

		it('compares different prerelease tags', () => {
			expect(compareVersions('1.0.0-alpha.1', '1.0.0-beta.1')).toBe(-1);
			expect(compareVersions('1.0.0-beta.1', '1.0.0-alpha.1')).toBe(1);
		});

		it('handles prerelease with different core versions', () => {
			expect(compareVersions('1.0.0-rc.5', '2.0.0-rc.1')).toBe(-1);
			expect(compareVersions('2.0.0-rc.1', '1.0.0-rc.5')).toBe(1);
		});

		it('handles prerelease with fewer identifiers', () => {
			// Per semver: fewer fields = lower precedence
			expect(compareVersions('1.0.0-rc', '1.0.0-rc.1')).toBe(-1);
			expect(compareVersions('1.0.0-rc.1', '1.0.0-rc')).toBe(1);
		});
	});
});
