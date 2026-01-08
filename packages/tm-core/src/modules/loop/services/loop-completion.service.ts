/**
 * @fileoverview Loop Completion Service
 * Parses Claude output for completion markers (<loop-complete>, <loop-blocked>)
 */

import type { LoopCompletionMarker } from '../types.js';

/**
 * Result of checking output for completion markers
 */
export interface CompletionCheckResult {
	/** Whether the loop has completed (all tasks done) */
	isComplete: boolean;
	/** Whether the loop is blocked and cannot continue */
	isBlocked: boolean;
	/** The parsed completion marker, if found */
	marker?: LoopCompletionMarker;
	/** The raw matched string from the output */
	rawMatch?: string;
}

/**
 * Service for detecting loop completion markers in Claude output
 */
export class LoopCompletionService {
	private readonly completePattern = /<loop-complete>([^<]*)<\/loop-complete>/i;
	private readonly blockedPattern = /<loop-blocked>([^<]*)<\/loop-blocked>/i;

	/**
	 * Parse Claude output for completion markers
	 * @param output - The output string to parse
	 * @returns Result indicating completion status and any detected marker
	 */
	parseOutput(output: string): CompletionCheckResult {
		// Handle null/undefined/empty input
		if (!output) {
			return { isComplete: false, isBlocked: false };
		}

		// Check for complete marker first (takes precedence)
		const completeMatch = output.match(this.completePattern);
		if (completeMatch) {
			return {
				isComplete: true,
				isBlocked: false,
				marker: { type: 'complete', reason: completeMatch[1].trim() },
				rawMatch: completeMatch[0]
			};
		}

		// Check for blocked marker
		const blockedMatch = output.match(this.blockedPattern);
		if (blockedMatch) {
			return {
				isComplete: false,
				isBlocked: true,
				marker: { type: 'blocked', reason: blockedMatch[1].trim() },
				rawMatch: blockedMatch[0]
			};
		}

		// No marker found
		return { isComplete: false, isBlocked: false };
	}

	/**
	 * Extract the reason string from a completion marker
	 * @param marker - The completion marker to extract from
	 * @returns The reason string
	 */
	extractCompletionReason(marker: LoopCompletionMarker): string {
		return marker.reason;
	}
}
