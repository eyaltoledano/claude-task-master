/**
 * IDE marker definitions for auto-detection.
 * Maps profile names to their filesystem markers.
 */

/**
 * Represents an IDE marker configuration
 */
export interface IDEMarker {
	/** Profile name matching RULE_PROFILES */
	profileName: string;
	/** Markers to check (first match wins) */
	markers: Array<{ path: string; type: 'directory' | 'file' }>;
	/** Human-readable display name */
	displayName: string;
}

/**
 * IDE marker definitions - directory or file-based detection.
 * Order matches typical usage frequency for slightly faster detection.
 */
export const IDE_MARKERS: IDEMarker[] = [
	// Most common IDE profiles
	{
		profileName: 'cursor',
		markers: [{ path: '.cursor', type: 'directory' }],
		displayName: 'Cursor'
	},
	{
		profileName: 'claude',
		markers: [{ path: '.claude', type: 'directory' }],
		displayName: 'Claude Code'
	},
	{
		profileName: 'windsurf',
		markers: [{ path: '.windsurf', type: 'directory' }],
		displayName: 'Windsurf'
	},
	{
		profileName: 'vscode',
		markers: [{ path: '.vscode', type: 'directory' }],
		displayName: 'VS Code'
	},
	{
		profileName: 'roo',
		markers: [{ path: '.roo', type: 'directory' }],
		displayName: 'Roo Code'
	},
	{
		profileName: 'cline',
		markers: [{ path: '.cline', type: 'directory' }],
		displayName: 'Cline'
	},
	{
		profileName: 'kiro',
		markers: [{ path: '.kiro', type: 'directory' }],
		displayName: 'Kiro'
	},
	{
		profileName: 'zed',
		markers: [{ path: '.zed', type: 'directory' }],
		displayName: 'Zed'
	},
	{
		profileName: 'kilo',
		markers: [{ path: '.kilo', type: 'directory' }],
		displayName: 'Kilo Code'
	},
	{
		profileName: 'trae',
		markers: [{ path: '.trae', type: 'directory' }],
		displayName: 'Trae'
	},
	// Integration guides with detectable markers
	{
		profileName: 'gemini',
		markers: [
			{ path: '.gemini', type: 'directory' },
			{ path: 'GEMINI.md', type: 'file' }
		],
		displayName: 'Gemini'
	},
	{
		profileName: 'opencode',
		markers: [{ path: '.opencode', type: 'directory' }],
		displayName: 'OpenCode'
	},
	{
		profileName: 'codex',
		markers: [{ path: '.codex', type: 'directory' }],
		displayName: 'Codex'
	}
	// Note: 'amp' has no known project-local marker
];

/**
 * Get IDE marker config for a specific profile
 */
export function getIDEMarker(profileName: string): IDEMarker | undefined {
	return IDE_MARKERS.find((m) => m.profileName === profileName);
}

/**
 * Check if a profile has detectable markers
 */
export function isDetectableProfile(profileName: string): boolean {
	return IDE_MARKERS.some((m) => m.profileName === profileName);
}
