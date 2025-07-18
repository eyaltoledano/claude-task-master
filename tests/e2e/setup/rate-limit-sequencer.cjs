/**
 * Custom Jest test sequencer to manage parallel execution
 * and avoid hitting AI rate limits
 */

const Sequencer = require('@jest/test-sequencer').default;

class RateLimitSequencer extends Sequencer {
	/**
	 * Sort tests to optimize execution and avoid rate limits
	 */
	sort(tests) {
		// Categorize tests by their AI usage
		const aiHeavyTests = [];
		const aiLightTests = [];
		const nonAiTests = [];

		tests.forEach((test) => {
			const testPath = test.path.toLowerCase();
			
			// Tests that make heavy use of AI APIs
			if (
				testPath.includes('update-task') ||
				testPath.includes('expand-task') ||
				testPath.includes('research') ||
				testPath.includes('parse-prd') ||
				testPath.includes('generate') ||
				testPath.includes('analyze-complexity')
			) {
				aiHeavyTests.push(test);
			}
			// Tests that make light use of AI APIs
			else if (
				testPath.includes('add-task') ||
				testPath.includes('update-subtask')
			) {
				aiLightTests.push(test);
			}
			// Tests that don't use AI APIs
			else {
				nonAiTests.push(test);
			}
		});

		// Sort each category by duration (fastest first)
		const sortByDuration = (a, b) => {
			const aTime = a.duration || 0;
			const bTime = b.duration || 0;
			return aTime - bTime;
		};

		aiHeavyTests.sort(sortByDuration);
		aiLightTests.sort(sortByDuration);
		nonAiTests.sort(sortByDuration);

		// Return tests in order: non-AI first, then light AI, then heavy AI
		// This allows non-AI tests to run quickly while AI tests are distributed
		return [...nonAiTests, ...aiLightTests, ...aiHeavyTests];
	}

	/**
	 * Shard tests across workers to balance AI load
	 */
	shard(tests, { shardIndex, shardCount }) {
		const shardSize = Math.ceil(tests.length / shardCount);
		const start = shardSize * shardIndex;
		const end = shardSize * (shardIndex + 1);

		return tests.slice(start, end);
	}
}

module.exports = RateLimitSequencer;