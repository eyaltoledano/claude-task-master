/**
 * @deprecated This file is deprecated. Import from '@tm/core' instead.
 *
 * Backward compatibility re-export for fuzzyTaskSearch.
 * This file will be removed in a future version.
 *
 * @example
 * // Old (deprecated):
 * import { FuzzyTaskSearch } from '../utils/fuzzyTaskSearch.js';
 *
 * // New (recommended):
 * import { FuzzyTaskSearch } from '@tm/core';
 */

export {
	FuzzyTaskSearch,
	createFuzzyTaskSearch,
	findRelevantTaskIds
} from '@tm/core';
