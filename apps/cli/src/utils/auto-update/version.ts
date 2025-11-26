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
 * Compare semantic versions with proper pre-release handling
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 = v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
	const toParts = (v: string) => {
		const [core, pre = ''] = v.split('-', 2);
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
	return a.pre < b.pre ? -1 : 1; // basic prerelease tie-break
}
