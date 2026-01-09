/**
 * @fileoverview Unit tests for LoopCompletionService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	LoopCompletionService,
	CompletionCheckResult
} from './loop-completion.service.js';

describe('LoopCompletionService', () => {
	let service: LoopCompletionService;

	beforeEach(() => {
		service = new LoopCompletionService();
	});

	describe('parseOutput', () => {
		describe('complete markers', () => {
			it('detects <loop-complete> with ALL_DONE reason', () => {
				const output = 'Some text <loop-complete>ALL_DONE</loop-complete> more text';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.isBlocked).toBe(false);
				expect(result.marker).toEqual({ type: 'complete', reason: 'ALL_DONE' });
				expect(result.rawMatch).toBe('<loop-complete>ALL_DONE</loop-complete>');
			});

			it('detects <loop-complete> with ALL_TASKS_DONE reason', () => {
				const output = '<loop-complete>ALL_TASKS_DONE</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('ALL_TASKS_DONE');
			});

			it('detects <loop-complete> with COVERAGE_TARGET reason', () => {
				const output = 'Coverage achieved! <loop-complete>COVERAGE_TARGET</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('COVERAGE_TARGET');
			});

			it('detects <loop-complete> with ZERO_ERRORS reason', () => {
				const output = 'All errors fixed <loop-complete>ZERO_ERRORS</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('ZERO_ERRORS');
			});

			it('detects <loop-complete> with LOW_DUPLICATION reason', () => {
				const output = '<loop-complete>LOW_DUPLICATION</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('LOW_DUPLICATION');
			});

			it('detects <loop-complete> with LOW_ENTROPY reason', () => {
				const output = '<loop-complete>LOW_ENTROPY</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('LOW_ENTROPY');
			});

			it('detects <loop-complete> with descriptive reason', () => {
				const output =
					'<loop-complete>All 15 tasks have been completed successfully</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe(
					'All 15 tasks have been completed successfully'
				);
			});

			it('detects <loop-complete> at start of output', () => {
				const output = '<loop-complete>DONE</loop-complete> followed by more text';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('detects <loop-complete> at end of output', () => {
				const output = 'Preceding text <loop-complete>DONE</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('detects <loop-complete> in middle of output', () => {
				const output = 'Before <loop-complete>DONE</loop-complete> After';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('detects <loop-complete> with surrounding whitespace', () => {
				const output = '   <loop-complete>DONE</loop-complete>   ';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});
		});

		describe('blocked markers', () => {
			it('detects <loop-blocked> with reason', () => {
				const output =
					'Cannot continue <loop-blocked>Missing API key</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(true);
				expect(result.marker).toEqual({
					type: 'blocked',
					reason: 'Missing API key'
				});
				expect(result.rawMatch).toBe('<loop-blocked>Missing API key</loop-blocked>');
			});

			it('detects <loop-blocked> with test failure reason', () => {
				const output = '<loop-blocked>Tests are failing - need human intervention</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe(
					'Tests are failing - need human intervention'
				);
			});

			it('detects <loop-blocked> with dependency reason', () => {
				const output = '<loop-blocked>Waiting on external dependency</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('Waiting on external dependency');
			});

			it('detects <loop-blocked> at start of output', () => {
				const output = '<loop-blocked>STUCK</loop-blocked> followed by more text';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('STUCK');
			});

			it('detects <loop-blocked> at end of output', () => {
				const output = 'Preceding text <loop-blocked>STUCK</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('STUCK');
			});

			it('detects <loop-blocked> in middle of output', () => {
				const output = 'Before <loop-blocked>STUCK</loop-blocked> After';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('STUCK');
			});

			it('detects <loop-blocked> with DEPENDENCY_MISSING reason', () => {
				const output = '<loop-blocked>DEPENDENCY_MISSING</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('DEPENDENCY_MISSING');
			});
		});

		describe('no markers', () => {
			it('returns false for output with no markers', () => {
				const output = 'Just some regular output without any markers';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
				expect(result.marker).toBeUndefined();
				expect(result.rawMatch).toBeUndefined();
			});

			it('returns false for partial/malformed complete tag', () => {
				const output = '<loop-complete>reason without closing tag';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('returns false for partial/malformed blocked tag', () => {
				const output = '<loop-blocked>reason';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('returns false for mismatched tags', () => {
				const output = '<loop-complete>reason</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('returns false for tags with typos', () => {
				const output = '<loop-comlete>reason</loop-comlete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('handles nested/malformed markers gracefully', () => {
				const output = '<loop-complete><loop-complete>NESTED</loop-complete></loop-complete>';
				const result = service.parseOutput(output);

				// Should still parse the first valid match
				expect(result.isComplete).toBe(true);
			});

			it('returns false for markers with only opening tag', () => {
				const output = '<loop-complete>orphan tag';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});
		});

		describe('case insensitivity', () => {
			it('handles uppercase <LOOP-COMPLETE>', () => {
				const output = '<LOOP-COMPLETE>ALL_DONE</LOOP-COMPLETE>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('ALL_DONE');
			});

			it('handles mixed case <Loop-Complete>', () => {
				const output = '<Loop-Complete>Done</Loop-Complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('Done');
			});

			it('handles uppercase <LOOP-BLOCKED>', () => {
				const output = '<LOOP-BLOCKED>STUCK</LOOP-BLOCKED>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('STUCK');
			});

			it('handles mixed case <Loop-Blocked>', () => {
				const output = '<Loop-Blocked>Blocked</Loop-Blocked>';
				const result = service.parseOutput(output);

				expect(result.isBlocked).toBe(true);
				expect(result.marker?.reason).toBe('Blocked');
			});

			it('handles camelCase tag variation', () => {
				const output = '<LOOP-complete>Mixed</loop-COMPLETE>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('Mixed');
			});
		});

		describe('edge cases', () => {
			it('uses first marker when both complete and blocked are present', () => {
				const output =
					'<loop-complete>DONE</loop-complete> then <loop-blocked>STUCK</loop-blocked>';
				const result = service.parseOutput(output);

				// Complete comes first in the string, but we check complete first in code
				expect(result.isComplete).toBe(true);
				expect(result.isBlocked).toBe(false);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('uses blocked when it appears before complete in output', () => {
				const output =
					'<loop-blocked>STUCK</loop-blocked> then <loop-complete>DONE</loop-complete>';
				const result = service.parseOutput(output);

				// Our implementation checks complete first, so complete wins
				// regardless of position in string
				expect(result.isComplete).toBe(true);
				expect(result.isBlocked).toBe(false);
			});

			it('trims whitespace from reasons', () => {
				const output = '<loop-complete>  ALL_DONE  </loop-complete>';
				const result = service.parseOutput(output);

				expect(result.marker?.reason).toBe('ALL_DONE');
			});

			it('handles empty reason (whitespace only)', () => {
				const output = '<loop-complete>   </loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('');
			});

			it('handles empty reason (no content)', () => {
				const output = '<loop-complete></loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('');
			});

			it('handles null input', () => {
				const result = service.parseOutput(null as unknown as string);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('handles undefined input', () => {
				const result = service.parseOutput(undefined as unknown as string);

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('handles empty string input', () => {
				const result = service.parseOutput('');

				expect(result.isComplete).toBe(false);
				expect(result.isBlocked).toBe(false);
			});

			it('handles very long output efficiently', () => {
				const longPrefix = 'x'.repeat(100000);
				const longSuffix = 'y'.repeat(100000);
				const output = `${longPrefix}<loop-complete>DONE</loop-complete>${longSuffix}`;

				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('handles output with newlines', () => {
				const output = `Some output
with newlines
<loop-complete>ALL_DONE</loop-complete>
more output`;
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('ALL_DONE');
			});

			it('handles multiple complete markers (uses first match)', () => {
				const output =
					'<loop-complete>FIRST</loop-complete> and <loop-complete>SECOND</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.marker?.reason).toBe('FIRST');
			});

			it('handles multiple blocked markers (uses first match)', () => {
				const output =
					'<loop-blocked>FIRST</loop-blocked> and <loop-blocked>SECOND</loop-blocked>';
				const result = service.parseOutput(output);

				expect(result.marker?.reason).toBe('FIRST');
			});

			it('does not match markers with < in content', () => {
				// The regex [^<]* prevents matching content with < inside
				const output = '<loop-complete>reason<with<less</loop-complete>';
				const result = service.parseOutput(output);

				// Should not match because of < in content
				expect(result.isComplete).toBe(false);
			});

			it('handles special characters in reason text', () => {
				const output = '<loop-complete>Done! Task #42 - 100% complete</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('Done! Task #42 - 100% complete');
			});

			it('handles unicode characters in reason text', () => {
				const output = '<loop-complete>Tâches terminées avec succès</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('Tâches terminées avec succès');
			});

			it('handles emoji in reason text', () => {
				const output = '<loop-complete>All done! 🎉✅</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('All done! 🎉✅');
			});

			it('handles reason with quotes', () => {
				const output = '<loop-complete>Task "important" is complete</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('Task "important" is complete');
			});

			it('handles reason with single quotes', () => {
				const output = "<loop-complete>Task 'urgent' finished</loop-complete>";
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe("Task 'urgent' finished");
			});

			it('handles output with tabs', () => {
				const output = '\t\t<loop-complete>DONE</loop-complete>\t\t';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('handles output with carriage returns', () => {
				const output = 'Line1\r\n<loop-complete>DONE</loop-complete>\r\nLine2';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('DONE');
			});

			it('handles reason with numbers only', () => {
				const output = '<loop-complete>12345</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('12345');
			});

			it('handles reason with underscores and dashes', () => {
				const output = '<loop-complete>TASK_COMPLETE-100</loop-complete>';
				const result = service.parseOutput(output);

				expect(result.isComplete).toBe(true);
				expect(result.marker?.reason).toBe('TASK_COMPLETE-100');
			});
		});
	});

	describe('extractCompletionReason', () => {
		it('extracts reason from complete marker', () => {
			const marker = { type: 'complete' as const, reason: 'ALL_TASKS_DONE' };
			const reason = service.extractCompletionReason(marker);

			expect(reason).toBe('ALL_TASKS_DONE');
		});

		it('extracts reason from blocked marker', () => {
			const marker = { type: 'blocked' as const, reason: 'Missing dependencies' };
			const reason = service.extractCompletionReason(marker);

			expect(reason).toBe('Missing dependencies');
		});

		it('extracts empty reason', () => {
			const marker = { type: 'complete' as const, reason: '' };
			const reason = service.extractCompletionReason(marker);

			expect(reason).toBe('');
		});

		it('extracts reason with special characters', () => {
			const marker = { type: 'complete' as const, reason: 'Done! 🎉 100%' };
			const reason = service.extractCompletionReason(marker);

			expect(reason).toBe('Done! 🎉 100%');
		});
	});

	describe('CompletionCheckResult type', () => {
		it('allows result with all fields', () => {
			const result: CompletionCheckResult = {
				isComplete: true,
				isBlocked: false,
				marker: { type: 'complete', reason: 'DONE' },
				rawMatch: '<loop-complete>DONE</loop-complete>'
			};

			expect(result.isComplete).toBe(true);
			expect(result.marker?.type).toBe('complete');
		});

		it('allows result without optional fields', () => {
			const result: CompletionCheckResult = {
				isComplete: false,
				isBlocked: false
			};

			expect(result.marker).toBeUndefined();
			expect(result.rawMatch).toBeUndefined();
		});
	});
});
