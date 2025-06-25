/**
 * Test for getTagAwareFilePath utility function
 * Tests the fix for Issue #850
 */

import { getTagAwareFilePath } from '../../../../scripts/modules/utils.js';
import path from 'path';

describe('getTagAwareFilePath utility function', () => {
	const projectRoot = '/test/project';
	const basePath = '.taskmaster/reports/task-complexity-report.json';

	it('should return base path for master tag', () => {
		const result = getTagAwareFilePath(basePath, 'master', projectRoot);
		const expected = path.join(projectRoot, basePath);
		expect(result).toBe(expected);
	});

	it('should return base path for null tag', () => {
		const result = getTagAwareFilePath(basePath, null, projectRoot);
		const expected = path.join(projectRoot, basePath);
		expect(result).toBe(expected);
	});

	it('should return base path for undefined tag', () => {
		const result = getTagAwareFilePath(basePath, undefined, projectRoot);
		const expected = path.join(projectRoot, basePath);
		expect(result).toBe(expected);
	});

	it('should return tag-specific path for non-master tag', () => {
		const tag = 'feature-branch';
		const result = getTagAwareFilePath(basePath, tag, projectRoot);
		const expected = path.join(
			projectRoot,
			'.taskmaster/reports/task-complexity-report_feature-branch.json'
		);
		expect(result).toBe(expected);
	});

	it('should handle different file extensions', () => {
		const csvBasePath = '.taskmaster/reports/export.csv';
		const tag = 'dev-branch';
		const result = getTagAwareFilePath(csvBasePath, tag, projectRoot);
		const expected = path.join(
			projectRoot,
			'.taskmaster/reports/export_dev-branch.csv'
		);
		expect(result).toBe(expected);
	});

	it('should handle paths without extensions', () => {
		const noExtPath = '.taskmaster/reports/summary';
		const tag = 'test-tag';
		const result = getTagAwareFilePath(noExtPath, tag, projectRoot);
		// Since there's no extension, it should append the tag
		const expected = path.join(
			projectRoot,
			'.taskmaster/reports/summary_test-tag'
		);
		expect(result).toBe(expected);
	});

	it('should use default project root when not provided', () => {
		const tag = 'feature-tag';
		const result = getTagAwareFilePath(basePath, tag);
		const expected = path.join(
			'.',
			'.taskmaster/reports/task-complexity-report_feature-tag.json'
		);
		expect(result).toBe(expected);
	});

	it('should handle complex tag names with special characters', () => {
		const tag = 'feature-user-auth-v2';
		const result = getTagAwareFilePath(basePath, tag, projectRoot);
		const expected = path.join(
			projectRoot,
			'.taskmaster/reports/task-complexity-report_feature-user-auth-v2.json'
		);
		expect(result).toBe(expected);
	});
});
