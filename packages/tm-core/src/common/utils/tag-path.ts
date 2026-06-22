/**
 * @fileoverview Tag-aware filesystem path safety utilities.
 *
 * Tag names are user/agent/config-controllable (CLI `--tag`, MCP `tag` argument,
 * `.taskmaster/state.json` `currentTag`, and the `TASKMASTER_TAG` env var). When a
 * tag is interpolated into a filename, it MUST be slugified first so that path
 * separators and `..` segments cannot escape the intended directory.
 *
 * This mirrors the behavior of the legacy `slugifyTagForFilePath` in
 * `scripts/modules/utils.js` so that file paths produced by the TypeScript
 * (`tm-core`) code stay in parity with the legacy JS code that writes those same
 * files (e.g. the complexity report and per-task markdown files).
 */

/** Maximum slug length, to avoid overly long filenames. */
const MAX_TAG_SLUG_LENGTH = 50;

/**
 * Slugify a tag name into a filesystem-safe fragment.
 *
 * Replaces every character outside `[a-zA-Z0-9_-]` with a hyphen (so `/`, `\`,
 * `.` and NUL cannot survive), trims and collapses hyphens, lowercases, and caps
 * the length. As a result a value such as `../../etc/passwd` becomes a harmless
 * `etc-passwd` instead of traversing out of the target directory.
 *
 * Legitimately created tags already match `^[a-zA-Z0-9_-]+$` (enforced by
 * `validateTagName` at creation), so for valid tags this only ever lowercases —
 * it never rejects or mangles a real tag.
 *
 * @param tagName - The raw tag name (may be untrusted).
 * @returns A filesystem-safe slug; `'unknown-tag'` for empty/non-string input.
 *
 * @example
 * ```ts
 * slugifyTagForFilePath('feature-v2');        // 'feature-v2'
 * slugifyTagForFilePath('../../etc/passwd');  // 'etc-passwd' (no traversal)
 * ```
 */
export function slugifyTagForFilePath(
	tagName: string | null | undefined
): string {
	if (!tagName || typeof tagName !== 'string') {
		return 'unknown-tag';
	}

	const slug = tagName
		.replace(/[^a-zA-Z0-9_-]/g, '-') // Replace invalid chars with hyphens
		.replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
		.replace(/-+/g, '-') // Collapse multiple hyphens
		.toLowerCase() // Convert to lowercase
		.substring(0, MAX_TAG_SLUG_LENGTH); // Cap length

	// An all-invalid-char tag (e.g. `../../../`) collapses to an empty string,
	// which would yield a malformed suffix like `task-complexity-report_.json`.
	// Fall back to the same sentinel used for empty/non-string input.
	return slug || 'unknown-tag';
}
