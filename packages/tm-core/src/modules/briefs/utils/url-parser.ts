/**
 * @fileoverview URL Parser
 * Utility for parsing URLs to extract organization and brief identifiers
 */

import {
	ERROR_CODES,
	TaskMasterError
} from '../../../common/errors/task-master-error.js';

export interface ParsedBriefUrl {
	orgSlug: string | null;
	briefId: string | null;
}

/**
 * Utility class for parsing brief URLs
 * Handles URL formats like: http://localhost:3000/home/{orgSlug}/briefs/{briefId}
 */
export class BriefUrlParser {
	/**
	 * Parse a URL and extract org slug and brief ID
	 *
	 * @param input - Raw input string (URL, path, or ID)
	 * @returns Parsed components
	 */
	static parse(input: string): ParsedBriefUrl {
		const raw = input?.trim() ?? '';
		if (!raw) {
			return { orgSlug: null, briefId: null };
		}

		// Try parsing as URL
		const url = this.parseAsUrl(raw);
		const pathToCheck = url ? url.pathname : raw.includes('/') ? raw : null;

		if (!pathToCheck) {
			// Not a URL/path, treat as direct ID
			return { orgSlug: null, briefId: raw };
		}

		// Extract components from path
		return this.parsePathComponents(pathToCheck, url);
	}

	/**
	 * Extract organization slug from URL or path
	 *
	 * @param input - Raw input string
	 * @returns Organization slug or null
	 */
	static extractOrgSlug(input: string): string | null {
		return this.parse(input).orgSlug;
	}

	/**
	 * Extract brief identifier from URL or path
	 *
	 * @param input - Raw input string
	 * @returns Brief identifier or null
	 */
	static extractBriefId(input: string): string | null {
		const parsed = this.parse(input);
		return parsed.briefId || input.trim();
	}

	/**
	 * Try to parse input as URL
	 * Handles both absolute and scheme-less URLs
	 */
	private static parseAsUrl(input: string): URL | null {
		try {
			return new URL(input);
		} catch {}
		try {
			return new URL(`https://${input}`);
		} catch {}
		return null;
	}

	/**
	 * Parse path components to extract org slug and brief ID
	 * Handles patterns like: /home/{orgSlug}/briefs/{briefId}
	 */
	private static parsePathComponents(
		path: string,
		url: URL | null
	): ParsedBriefUrl {
		const parts = path.split('/').filter(Boolean);
		const briefsIdx = parts.lastIndexOf('briefs');

		let orgSlug: string | null = null;
		let briefId: string | null = null;

		// Extract org slug (segment before 'briefs')
		if (briefsIdx > 0) {
			orgSlug = parts[briefsIdx - 1] || null;
		}

		// Extract brief ID
		// Priority: query param > path segment after 'briefs' > last segment (if not 'briefs')
		if (url) {
			const qId = url.searchParams.get('id') || url.searchParams.get('briefId');
			if (qId) {
				briefId = qId;
			}
		}

		if (!briefId && briefsIdx >= 0 && parts.length > briefsIdx + 1) {
			briefId = parts[briefsIdx + 1];
		}

		// Only use last segment as fallback if path doesn't end with 'briefs'
		// This prevents treating '/home/org/briefs' as briefId='briefs'
		if (
			!briefId &&
			parts.length > 0 &&
			!(briefsIdx >= 0 && briefsIdx === parts.length - 1)
		) {
			briefId = parts[parts.length - 1];
		}

		return { orgSlug, briefId };
	}

	/**
	 * Validate that required components are present
	 *
	 * @param parsed - Parsed URL components
	 * @param requireOrg - Whether org slug is required
	 * @param requireBrief - Whether brief ID is required
	 * @throws TaskMasterError if required components are missing
	 */
	static validate(
		parsed: ParsedBriefUrl,
		options: { requireOrg?: boolean; requireBrief?: boolean } = {}
	): void {
		if (options.requireOrg && !parsed.orgSlug) {
			throw new TaskMasterError(
				'Organization slug could not be extracted from input',
				ERROR_CODES.VALIDATION_ERROR
			);
		}

		if (options.requireBrief && !parsed.briefId) {
			throw new TaskMasterError(
				'Brief identifier could not be extracted from input',
				ERROR_CODES.VALIDATION_ERROR
			);
		}
	}
}
