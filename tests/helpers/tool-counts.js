/**
 * tool-counts.js
 * Shared helper for validating tool counts across tests and validation scripts
 */

import {
	getToolCounts,
	getToolCategories
} from '../../mcp-server/src/tools/tool-registry.js';

/**
 * Expected tool counts - update these when tools are added/removed
 * These serve as the canonical source of truth for expected counts
 */
export const EXPECTED_TOOL_COUNTS = {
	core: 7,
	standard: 15,
	total: 44
};

/**
 * Expected core tools list for validation
 */
export const EXPECTED_CORE_TOOLS = [
	'get_tasks',
	'next_task',
	'get_task',
	'set_task_status',
	'update_subtask',
	'parse_prd',
	'expand_task'
];

/**
 * Validate that actual tool counts match expected counts
 * @returns {Object} Validation result with isValid flag and details
 */
export function validateToolCounts() {
	const actual = getToolCounts();
	const expected = EXPECTED_TOOL_COUNTS;

	const isValid =
		actual.core === expected.core &&
		actual.standard === expected.standard &&
		actual.total === expected.total;

	return {
		isValid,
		actual,
		expected,
		differences: {
			core: actual.core - expected.core,
			standard: actual.standard - expected.standard,
			total: actual.total - expected.total
		}
	};
}

/**
 * Validate that tool categories have correct structure and content
 * @returns {Object} Validation result
 */
export function validateToolStructure() {
	const categories = getToolCategories();
	const counts = getToolCounts();

	// Check that core tools are subset of standard tools
	const coreInStandard = categories.core.every((tool) =>
		categories.standard.includes(tool)
	);

	// Check that standard tools are subset of all tools
	const standardInAll = categories.standard.every((tool) =>
		categories.all.includes(tool)
	);

	// Check that expected core tools match actual
	const expectedCoreMatch =
		EXPECTED_CORE_TOOLS.every((tool) => categories.core.includes(tool)) &&
		categories.core.every((tool) => EXPECTED_CORE_TOOLS.includes(tool));

	// Check array lengths match counts
	const lengthsMatch =
		categories.core.length === counts.core &&
		categories.standard.length === counts.standard &&
		categories.all.length === counts.total;

	return {
		isValid:
			coreInStandard && standardInAll && expectedCoreMatch && lengthsMatch,
		details: {
			coreInStandard,
			standardInAll,
			expectedCoreMatch,
			lengthsMatch
		},
		categories,
		counts
	};
}

/**
 * Get a detailed report of all tool information
 * @returns {Object} Comprehensive tool information
 */
export function getToolReport() {
	const counts = getToolCounts();
	const categories = getToolCategories();
	const validation = validateToolCounts();
	const structure = validateToolStructure();

	return {
		counts,
		categories,
		validation,
		structure,
		summary: {
			totalValid: validation.isValid && structure.isValid,
			countsValid: validation.isValid,
			structureValid: structure.isValid
		}
	};
}
