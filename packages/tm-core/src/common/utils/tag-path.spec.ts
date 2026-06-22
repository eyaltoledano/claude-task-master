import { describe, expect, it } from 'vitest';
import { slugifyTagForFilePath } from './tag-path.js';

describe('slugifyTagForFilePath', () => {
	describe('legitimate tags are preserved (no mangling)', () => {
		it('keeps a simple valid tag unchanged', () => {
			expect(slugifyTagForFilePath('feature-v2')).toBe('feature-v2');
		});

		it('keeps underscores and digits', () => {
			expect(slugifyTagForFilePath('release_2026_01')).toBe('release_2026_01');
		});

		it('lowercases (parity with legacy slugify)', () => {
			expect(slugifyTagForFilePath('MyFeature')).toBe('myfeature');
		});
	});

	describe('path traversal is neutralized (negative oracle)', () => {
		// These are the inputs an attacker would use to escape the target dir.
		const traversals = [
			'../../x',
			'../../../../../etc/passwd',
			'..\\..\\x',
			'..%2f..%2fx',
			'foo/../bar',
			'a/b/c',
			'tag\0null'
		];

		it.each(traversals)(
			'produces no path separators or dot segments for %j',
			(input) => {
				const slug = slugifyTagForFilePath(input);
				expect(slug).not.toContain('/');
				expect(slug).not.toContain('\\');
				expect(slug).not.toContain('..');
				expect(slug).not.toContain('\0');
				// must be a single safe filename fragment
				expect(slug).toMatch(/^[a-z0-9_-]*$/);
			}
		);

		it('cannot escape when embedded in a filename', () => {
			const slug = slugifyTagForFilePath('../../../../../escape/secret');
			const fileName = `task-complexity-report_${slug}.json`;
			expect(fileName).not.toContain('/');
			expect(fileName).not.toContain('..');
		});
	});

	describe('hyphen handling and length', () => {
		it('collapses and trims hyphens introduced by invalid chars', () => {
			expect(slugifyTagForFilePath('../../etc/passwd')).toBe('etc-passwd');
		});

		it('caps the length at 50 characters', () => {
			const long = 'a'.repeat(120);
			expect(slugifyTagForFilePath(long).length).toBe(50);
		});
	});

	describe('empty / invalid input', () => {
		it('returns a fallback for empty string', () => {
			expect(slugifyTagForFilePath('')).toBe('unknown-tag');
		});

		it('returns a fallback for null/undefined', () => {
			expect(slugifyTagForFilePath(null)).toBe('unknown-tag');
			expect(slugifyTagForFilePath(undefined)).toBe('unknown-tag');
		});

		it('returns the fallback when every character is invalid (slug collapses to empty)', () => {
			// Without the fallback this would yield a malformed `..._.json` suffix.
			expect(slugifyTagForFilePath('../../../')).toBe('unknown-tag');
			expect(slugifyTagForFilePath('////')).toBe('unknown-tag');
		});
	});
});
