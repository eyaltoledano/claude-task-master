/**
 * @fileoverview Version comparison and retrieval utilities
 */

import process from 'process';

/**
 * Get current version from build-time injected environment variable
 */
export function getCurrentVersion(): string {
	// Version is injected at build time via TM_PUBLIC_VERSION
	const version = process.env.TM_PUBLIC_VERSION;
	if (version && version !== 'unknown') {
		return version;
	}

	// Fallback for development or if injection failed
	console.warn('Could not read version from TM_PUBLIC_VERSION, using fallback');
	return '0.0.0';
}

/**
 * Compare pre-release identifiers per semver spec.
 * Splits on '.' and compares each segment: numeric segments compare
 * as integers (so rc.9 < rc.10), string segments compare lexicographically.
 */
function comparePrereleaseIdentifiers(a: string, b: string): number {
	const aParts = a.split('.');
	const bParts = b.split('.');
	const len = Math.max(aParts.length, bParts.length);
	const isAllDigits = (v: string): boolean => /^\d+$/.test(v);

	for (let i = 0; i < len; i++) {
		// Fewer fields = lower precedence (per semver spec)
		if (i >= aParts.length) return -1;
		if (i >= bParts.length) return 1;

		const aIsNum = isAllDigits(aParts[i]);
		const bIsNum = isAllDigits(bParts[i]);

		// Numeric identifiers always have lower precedence than string identifiers
		if (aIsNum && !bIsNum) return -1;
		if (!aIsNum && bIsNum) return 1;

		if (aIsNum && bIsNum) {
			const aNum = Number(aParts[i]);
			const bNum = Number(bParts[i]);
			if (aNum !== bNum) return aNum < bNum ? -1 : 1;
		} else {
			if (aParts[i] !== bParts[i]) {
				return aParts[i] < bParts[i] ? -1 : 1;
			}
		}
	}

	return 0;
}

/**
 * Compare semantic versions with proper pre-release handling
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const toParts = (v: string) => {
		// Strip build metadata (semver ignores it for precedence)
		const withoutBuild = v.split('+')[0];
		// Split on first '-' only — prerelease may contain inner hyphens
		const dashIdx = withoutBuild.indexOf('-');
		const core = dashIdx === -1 ? withoutBuild : withoutBuild.slice(0, dashIdx);
		const pre = dashIdx === -1 ? '' : withoutBuild.slice(dashIdx + 1);
		const nums = core.split('.').map((n) => Number.parseInt(n, 10) || 0);
		return { nums, pre };
	};

	const a = toParts(v1);
	const b = toParts(v2);
	const len = Math.max(a.nums.length, b.nums.length);

	// Compare numeric parts
	for (let i = 0; i < len; i++) {
		const d = (a.nums[i] || 0) - (b.nums[i] || 0);
		if (d !== 0) return d < 0 ? -1 : 1;
	}

	// Handle pre-release comparison
	if (a.pre && !b.pre) return -1; // prerelease < release
	if (!a.pre && b.pre) return 1; // release > prerelease
	if (a.pre === b.pre) return 0; // same or both empty
	return comparePrereleaseIdentifiers(a.pre, b.pre);
}
