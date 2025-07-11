/**
 * Comprehensive E2E tests for research-save command
 * Tests all aspects of saving research results to files and knowledge base
 */

export default async function testResearchSave(logger, helpers, context) {
	const { testDir } = context;
	const results = {
		status: 'passed',
		errors: [],
		tests: []
	};

	async function runTest(name, testFn) {
		try {
			logger.info(`\nRunning: ${name}`);
			await testFn();
			results.tests.push({ name, status: 'passed' });
			logger.success(`✓ ${name}`);
		} catch (error) {
			results.tests.push({ name, status: 'failed', error: error.message });
			results.errors.push({ test: name, error: error.message });
			logger.error(`✗ ${name}: ${error.message}`);
		}
	}

	try {
		logger.info('Starting comprehensive research-save tests...');

		// Test 1: Basic research and save
		await runTest('Basic research and save', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				['How to implement OAuth 2.0 in Node.js', '--output', 'oauth-guide.md'],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Verify file was created
			const outputPath = `${testDir}/oauth-guide.md`;
			if (!helpers.fileExists(outputPath)) {
				throw new Error('Research output file was not created');
			}

			// Check file content
			const content = helpers.readFile(outputPath);
			if (!content.includes('OAuth') || !content.includes('Node.js')) {
				throw new Error('Saved research does not contain expected content');
			}
		});

		// Test 2: Research save with task context
		await runTest('Research save with task context', async () => {
			// Create a task
			const taskResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Implement secure API authentication'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(taskResult.stdout);

			const result = await helpers.taskMaster(
				'research-save',
				[
					'--task',
					taskId,
					'JWT vs OAuth comparison for REST APIs',
					'--output',
					'auth-research.md'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check saved content includes task context
			const content = helpers.readFile(`${testDir}/auth-research.md`);
			if (!content.includes('JWT') || !content.includes('OAuth')) {
				throw new Error('Research does not cover requested topics');
			}

			// Should reference the task
			if (!content.includes(taskId) && !content.includes('Task #')) {
				throw new Error('Saved research does not reference the task context');
			}
		});

		// Test 3: Research save to knowledge base
		await runTest('Save to knowledge base', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'Database indexing strategies',
					'--knowledge-base',
					'--category',
					'database'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check knowledge base directory
			const kbPath = `${testDir}/.taskmaster/knowledge-base/database`;
			if (!helpers.fileExists(kbPath)) {
				throw new Error('Knowledge base category directory not created');
			}

			// Should create a file with timestamp or ID
			const files = helpers.listFiles(kbPath);
			if (files.length === 0) {
				throw new Error('No files created in knowledge base');
			}

			// Verify content
			const savedFile = files[0];
			const content = helpers.readFile(`${kbPath}/${savedFile}`);
			if (!content.includes('index') || !content.includes('database')) {
				throw new Error('Knowledge base entry lacks expected content');
			}
		});

		// Test 4: Research save with custom format
		await runTest('Save with custom format', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'React performance optimization',
					'--output',
					'react-perf.json',
					'--format',
					'json'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Verify JSON format
			const content = helpers.readFile(`${testDir}/react-perf.json`);
			let parsed;
			try {
				parsed = JSON.parse(content);
			} catch (e) {
				throw new Error('Output is not valid JSON');
			}

			// Check JSON structure
			if (!parsed.topic || !parsed.content || !parsed.timestamp) {
				throw new Error('JSON output missing expected fields');
			}

			if (
				!parsed.content.toLowerCase().includes('react') ||
				!parsed.content.toLowerCase().includes('performance')
			) {
				throw new Error('JSON content not relevant to query');
			}
		});

		// Test 5: Research save with metadata
		await runTest('Save with metadata', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'Microservices communication patterns',
					'--output',
					'microservices.md',
					'--metadata',
					'author=TaskMaster',
					'--metadata',
					'tags=architecture,microservices',
					'--metadata',
					'version=1.0'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check file content for metadata
			const content = helpers.readFile(`${testDir}/microservices.md`);

			// Should include metadata in frontmatter or header
			if (!content.includes('author') && !content.includes('Author')) {
				throw new Error('Metadata not included in saved file');
			}

			if (
				!content.includes('microservice') ||
				!content.includes('communication')
			) {
				throw new Error('Research content not relevant');
			}
		});

		// Test 6: Append to existing file
		await runTest('Append to existing research file', async () => {
			// Create initial file
			const initialContent =
				'# API Research\n\n## Previous Research\n\nInitial content here.\n\n';
			helpers.writeFile(`${testDir}/api-research.md`, initialContent);

			const result = await helpers.taskMaster(
				'research-save',
				[
					'GraphQL schema design best practices',
					'--output',
					'api-research.md',
					'--append'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check file was appended
			const content = helpers.readFile(`${testDir}/api-research.md`);
			if (!content.includes('Previous Research')) {
				throw new Error('Original content was overwritten instead of appended');
			}
			if (!content.includes('GraphQL') || !content.includes('schema')) {
				throw new Error('New research not appended');
			}
		});

		// Test 7: Research save with references
		await runTest('Save with source references', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'TypeScript decorators guide',
					'--output',
					'decorators.md',
					'--include-references'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check for references section
			const content = helpers.readFile(`${testDir}/decorators.md`);
			if (!content.includes('TypeScript') || !content.includes('decorator')) {
				throw new Error('Research content not relevant');
			}

			// Should include references or sources
			const hasReferences =
				content.includes('Reference') ||
				content.includes('Source') ||
				content.includes('Further reading') ||
				content.includes('Links');
			if (!hasReferences) {
				throw new Error('No references section included');
			}
		});

		// Test 8: Batch research and save
		await runTest('Batch research topics', async () => {
			const topics = [
				'Docker best practices',
				'Kubernetes deployment strategies',
				'CI/CD pipeline setup'
			];

			const result = await helpers.taskMaster(
				'research-save',
				['--batch', '--output-dir', 'devops-research', ...topics],
				{ cwd: testDir, timeout: 180000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check directory was created
			const outputDir = `${testDir}/devops-research`;
			if (!helpers.fileExists(outputDir)) {
				throw new Error('Output directory not created');
			}

			// Should have files for each topic
			const files = helpers.listFiles(outputDir);
			if (files.length < topics.length) {
				throw new Error(
					`Expected ${topics.length} files, found ${files.length}`
				);
			}

			// Verify each file has relevant content
			let foundDocker = false,
				foundK8s = false,
				foundCICD = false;
			files.forEach((file) => {
				const content = helpers.readFile(`${outputDir}/${file}`).toLowerCase();
				if (content.includes('docker')) foundDocker = true;
				if (content.includes('kubernetes')) foundK8s = true;
				if (
					content.includes('ci') ||
					content.includes('cd') ||
					content.includes('pipeline')
				)
					foundCICD = true;
			});

			if (!foundDocker || !foundK8s || !foundCICD) {
				throw new Error('Not all topics were researched and saved');
			}
		});

		// Test 9: Research save with template
		await runTest('Save with custom template', async () => {
			// Create template file
			const template = `# {{TOPIC}}

Date: {{DATE}}
Category: {{CATEGORY}}

## Summary
{{SUMMARY}}

## Detailed Research
{{CONTENT}}

## Key Takeaways
{{TAKEAWAYS}}

## Implementation Notes
{{NOTES}}
`;
			helpers.writeFile(`${testDir}/research-template.md`, template);

			const result = await helpers.taskMaster(
				'research-save',
				[
					'Redis caching strategies',
					'--output',
					'redis-research.md',
					'--template',
					'research-template.md',
					'--category',
					'performance'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check template was used
			const content = helpers.readFile(`${testDir}/redis-research.md`);
			if (!content.includes('Redis caching strategies')) {
				throw new Error('Template topic not filled');
			}
			if (!content.includes('Category: performance')) {
				throw new Error('Template category not filled');
			}
			if (
				!content.includes('Key Takeaways') ||
				!content.includes('Implementation Notes')
			) {
				throw new Error('Template structure not preserved');
			}
		});

		// Test 10: Error handling - invalid output path
		await runTest('Error handling - invalid output path', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				['Test topic', '--output', '/invalid/path/file.md'],
				{ cwd: testDir, allowFailure: true }
			);
			if (result.exitCode === 0) {
				throw new Error('Should have failed with invalid output path');
			}
		});

		// Test 11: Research save with task integration
		await runTest('Save and link to task', async () => {
			// Create task
			const taskResult = await helpers.taskMaster(
				'add-task',
				['--title', 'Implement caching layer'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(taskResult.stdout);

			const result = await helpers.taskMaster(
				'research-save',
				[
					'--task',
					taskId,
					'Caching strategies comparison',
					'--output',
					'caching-research.md',
					'--link-to-task'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check task was updated with research link
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			if (
				!showResult.stdout.includes('caching-research.md') &&
				!showResult.stdout.includes('Research')
			) {
				throw new Error('Task not updated with research link');
			}
		});

		// Test 12: Research save with compression
		await runTest('Save with compression for large research', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'Comprehensive guide to distributed systems',
					'--output',
					'dist-systems.md.gz',
					'--compress'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check compressed file exists
			const compressedPath = `${testDir}/dist-systems.md.gz`;
			if (!helpers.fileExists(compressedPath)) {
				throw new Error('Compressed file not created');
			}
		});

		// Test 13: Research save with versioning
		await runTest('Save with version control', async () => {
			// Save initial version
			await helpers.taskMaster(
				'research-save',
				['API design patterns', '--output', 'api-patterns.md', '--version'],
				{ cwd: testDir, timeout: 120000 }
			);

			// Save updated version
			const result = await helpers.taskMaster(
				'research-save',
				[
					'API design patterns - updated',
					'--output',
					'api-patterns.md',
					'--version'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check for version files
			const files = helpers.listFiles(testDir);
			const versionFiles = files.filter(
				(f) => f.includes('api-patterns') && f.includes('.v')
			);

			if (versionFiles.length === 0) {
				throw new Error('No version files created');
			}
		});

		// Test 14: Research save with export formats
		await runTest('Export to multiple formats', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'Testing strategies overview',
					'--output',
					'testing',
					'--formats',
					'md,json,txt'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check all format files exist
			const formats = ['md', 'json', 'txt'];
			formats.forEach((format) => {
				const filePath = `${testDir}/testing.${format}`;
				if (!helpers.fileExists(filePath)) {
					throw new Error(`${format} format file not created`);
				}
			});
		});

		// Test 15: Research save with summary generation
		await runTest('Save with auto-generated summary', async () => {
			const result = await helpers.taskMaster(
				'research-save',
				[
					'Machine learning deployment strategies',
					'--output',
					'ml-deployment.md',
					'--include-summary',
					'--summary-length',
					'200'
				],
				{ cwd: testDir, timeout: 120000 }
			);
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${result.stderr}`);
			}

			// Check for summary section
			const content = helpers.readFile(`${testDir}/ml-deployment.md`);
			if (
				!content.includes('Summary') &&
				!content.includes('TL;DR') &&
				!content.includes('Overview')
			) {
				throw new Error('No summary section found');
			}

			// Content should be about ML deployment
			if (
				!content.includes('machine learning') &&
				!content.includes('ML') &&
				!content.includes('deployment')
			) {
				throw new Error('Research content not relevant to query');
			}
		});

		// Calculate summary
		const totalTests = results.tests.length;
		const passedTests = results.tests.filter(
			(t) => t.status === 'passed'
		).length;
		const failedTests = results.tests.filter(
			(t) => t.status === 'failed'
		).length;

		logger.info('\n=== Research-Save Test Summary ===');
		logger.info(`Total tests: ${totalTests}`);
		logger.info(`Passed: ${passedTests}`);
		logger.info(`Failed: ${failedTests}`);

		if (failedTests > 0) {
			results.status = 'failed';
			logger.error(`\n${failedTests} tests failed`);
		} else {
			logger.success('\n✅ All research-save tests passed!');
		}
	} catch (error) {
		results.status = 'failed';
		results.errors.push({
			test: 'research-save test suite',
			error: error.message,
			stack: error.stack
		});
		logger.error(`Research-save test suite failed: ${error.message}`);
	}

	return results;
}
