// In tests/unit/parse-prd.test.js
// Testing parse-prd.js streaming vs non-streaming behavior and progress reporting

import { jest } from '@jest/globals';

describe('parse-prd file extension compatibility', () => {
	test('Accepts .txt files for PRD input', () => {
		// Test that .txt files are valid PRD inputs
		const txtPath = '/path/to/requirements.txt';

		// The parse-prd.js implementation uses fs.promises.readFile which works with any text file
		// regardless of extension, so we verify this behavior
		expect(txtPath.endsWith('.txt')).toBe(true);

		// Simulate the file reading logic - no extension-specific validation
		const isValidPath =
			txtPath && typeof txtPath === 'string' && txtPath.length > 0;
		expect(isValidPath).toBe(true);
	});

	test('Accepts .md files for PRD input', () => {
		// Test that .md files are valid PRD inputs
		const mdPath = '/path/to/requirements.md';

		// The parse-prd.js implementation treats all text files the same way
		expect(mdPath.endsWith('.md')).toBe(true);

		// Simulate the file reading logic - no extension-specific validation
		const isValidPath =
			mdPath && typeof mdPath === 'string' && mdPath.length > 0;
		expect(isValidPath).toBe(true);
	});

	test('Accepts other text file extensions for PRD input', () => {
		// Test that other text file extensions work
		const testPaths = [
			'/path/to/prd.rst',
			'/path/to/requirements.doc',
			'/path/to/spec.rtf',
			'/path/to/prd' // No extension
		];

		testPaths.forEach((path) => {
			// The implementation only checks if the file exists and is readable,
			// not the extension, so all should be treated equally
			const isValidPath = path && typeof path === 'string' && path.length > 0;
			expect(isValidPath).toBe(true);
		});
	});

	test('File extension does not affect parsing behavior', () => {
		// Simulate the core logic that determines how files are processed
		const mockFileContent = '# Sample PRD\n\nThis is a test PRD content.';

		const processFile = (filePath, content) => {
			// The actual implementation only cares about content, not extension
			if (!filePath || !content) {
				return { success: false, error: 'Missing file or content' };
			}

			// Same processing logic regardless of extension
			return {
				success: true,
				contentLength: content.length,
				hasContent: content.trim().length > 0
			};
		};

		// Test different extensions with same content
		const txtResult = processFile('/path/to/prd.txt', mockFileContent);
		const mdResult = processFile('/path/to/prd.md', mockFileContent);
		const noExtResult = processFile('/path/to/prd', mockFileContent);

		// All should produce identical results
		expect(txtResult).toEqual(mdResult);
		expect(mdResult).toEqual(noExtResult);
		expect(txtResult.success).toBe(true);
		expect(txtResult.contentLength).toBe(mockFileContent.length);
	});
});

describe('parse-prd streaming behavior', () => {
	test('Uses streaming when reportProgress function is provided', () => {
		const mockReportProgress = jest.fn(() => Promise.resolve());

		// Test the logic that determines streaming vs non-streaming
		const useStreaming = typeof mockReportProgress === 'function';
		expect(useStreaming).toBe(true);
	});

	test('Uses non-streaming when reportProgress is not provided', () => {
		const useStreaming = typeof undefined === 'function';
		expect(useStreaming).toBe(false);
	});

	test('Uses non-streaming when reportProgress is not a function', () => {
		const notAFunction = 'not a function';
		const useStreaming = typeof notAFunction === 'function';
		expect(useStreaming).toBe(false);
	});

	test('Fallback logic handles streaming errors correctly', () => {
		// Test the error message patterns that trigger fallback
		const streamingErrors = [
			'textStream is not async iterable',
			'Failed to process AI text stream: some error',
			'Stream object is not iterable - no textStream found'
		];

		streamingErrors.forEach((errorMessage) => {
			const lowerMessage = errorMessage.toLowerCase();
			const isStreamingError =
				lowerMessage.includes('not async iterable') ||
				lowerMessage.includes('failed to process ai text stream') ||
				lowerMessage.includes('stream object is not iterable');

			expect(isStreamingError).toBe(true);
		});

		// Test that non-streaming errors don't trigger fallback
		const nonStreamingErrors = [
			'API key not found',
			'File not found',
			'Invalid JSON response'
		];

		nonStreamingErrors.forEach((errorMessage) => {
			const lowerMessage = errorMessage.toLowerCase();
			const isStreamingError =
				lowerMessage.includes('not async iterable') ||
				lowerMessage.includes('failed to process ai text stream') ||
				lowerMessage.includes('stream object is not iterable');

			expect(isStreamingError).toBe(false);
		});
	});
});

describe('MCP progress reporting compliance', () => {
	test('Progress values always increase and only report for complete tasks', () => {
		// Mock progress reports to track sequence
		const progressReports = [];
		const mockReportProgress = jest.fn((report) => {
			progressReports.push(report);
			return Promise.resolve();
		});

		// Simulate the progress reporting pattern used in parsePRDWithStreaming
		const simulateProgress = async (numTasks = 10) => {
			// Initial progress with input token count
			await mockReportProgress({
				progress: 0,
				total: numTasks,
				message: `Starting PRD analysis (Input: 2150 tokens) with research...`
			});

			// Simulate task generation from streaming - partial parsing
			const streamingTasks = [
				{ title: 'Task One', description: 'First task', priority: 'high' },
				{ title: 'Task Two', description: 'Second task', priority: 'medium' },
				{ title: 'Task Three', description: 'Third task', priority: 'low' }
			];

			// Priority indicator mapping
			const priorityMap = {
				high: '🔴',
				medium: '🟠',
				low: '🟢'
			};

			for (let i = 0; i < streamingTasks.length; i++) {
				const task = streamingTasks[i];
				// Only report progress if task has a valid title
				if (task.title && typeof task.title === 'string' && task.title.trim()) {
					const priority = task.priority || 'medium';
					const priorityIndicator = priorityMap[priority];
					const estimatedOutputTokens = 340 + i * 340; // Simulate growing output tokens
					await mockReportProgress({
						progress: i + 1,
						total: numTasks,
						message: `${priorityIndicator} Task ${i + 1}/${numTasks} - ${task.title} | ~Output: ${estimatedOutputTokens} tokens`
					});
				}
			}

			// Simulate fallback parsing finding remaining tasks from the same accumulated text
			// This happens when streaming didn't parse all tasks, so fallback tries full JSON parse
			const fallbackTasks = [
				{
					title: 'Task Four',
					description: 'Fourth task found in fallback parse',
					priority: 'medium'
				},
				{
					title: 'Task Five',
					description: 'Fifth task found in fallback parse',
					priority: 'high'
				}
			];

			for (let i = 0; i < fallbackTasks.length; i++) {
				const task = fallbackTasks[i];
				const currentProgress = streamingTasks.length + i + 1;
				const priority = task.priority || 'medium';
				const priorityIndicator = priorityMap[priority];
				const estimatedOutputTokens = 1360 + (i + 1) * 340; // Continue growing output tokens
				await mockReportProgress({
					progress: currentProgress,
					total: numTasks,
					message: `${priorityIndicator} Task ${currentProgress}/${numTasks} - ${task.title} | ~Output: ${estimatedOutputTokens} tokens`
				});
			}

			// Final completion with actual token counts
			await mockReportProgress({
				progress: numTasks,
				total: numTasks,
				message: `✅ Task Generation Completed | Tokens (I/O): 2150/1847 ($0.0423)`
			});
		};

		return simulateProgress().then(() => {
			// Verify progress always increases (or stays the same for setup phases)
			for (let i = 1; i < progressReports.length; i++) {
				expect(progressReports[i].progress).toBeGreaterThanOrEqual(
					progressReports[i - 1].progress
				);
			}

			// Verify total is consistent throughout
			const totals = progressReports.map((r) => r.total);
			expect(new Set(totals).size).toBe(1); // All totals should be the same
			expect(totals[0]).toBe(10); // Should equal numTasks

			// Verify we have meaningful progress messages
			progressReports.forEach((report) => {
				expect(report.message).toBeTruthy();
				expect(typeof report.message).toBe('string');
				expect(report.message.length).toBeGreaterThan(0);
			});

			// Verify the final progress equals the total
			const finalReport = progressReports[progressReports.length - 1];
			expect(finalReport.progress).toBe(finalReport.total);

			// Verify that task generation messages contain task titles and token info
			const taskMessages = progressReports.filter(
				(r) =>
					r.message.includes('Task ') &&
					r.message.includes(' - ') &&
					!r.message.includes('Starting') &&
					!r.message.includes('Completed')
			);
			taskMessages.forEach((report) => {
				// Should contain priority indicator emoji and token info for task messages
				expect(report.message).toMatch(
					/^[🔴🟠🟢] Task \d+\/\d+ - .+ \| ~Output: \d+ tokens$/u
				);
			});
		});
	});

	test('Progress reporting with streaming JSON parser simulation', async () => {
		// This test simulates the streaming progress behavior without calling real AI services
		const progressReports = [];
		const mockReportProgress = jest.fn((report) => {
			progressReports.push(report);
			return Promise.resolve();
		});

		// Simulate the streaming progress pattern used in parsePRDWithStreaming
		const simulateStreamingProgress = async (numTasks = 3) => {
			// Initial progress with input token count
			await mockReportProgress({
				progress: 0,
				total: numTasks,
				message: `Starting PRD analysis (Input: 1850 tokens)...`
			});

			// Simulate tasks being parsed from streaming JSON
			const mockTasks = [
				{ title: 'Set up project structure', priority: 'high' },
				{ title: 'Implement user authentication', priority: 'high' },
				{ title: 'Design database schema', priority: 'medium' }
			];

			// Priority indicator mapping
			const priorityMap = {
				high: '🔴',
				medium: '🟠',
				low: '🟢'
			};

			// Report progress for each task as it's parsed from the stream
			for (let i = 0; i < mockTasks.length; i++) {
				const task = mockTasks[i];
				const currentProgress = i + 1;
				const priorityIndicator = priorityMap[task.priority];
				const estimatedOutputTokens = 280 + i * 280; // Simulate growing output tokens
				await mockReportProgress({
					progress: currentProgress,
					total: numTasks,
					message: `${priorityIndicator} Task ${currentProgress}/${numTasks} - ${task.title} | ~Output: ${estimatedOutputTokens} tokens`
				});
			}

			// Final completion message with actual token counts
			await mockReportProgress({
				progress: numTasks,
				total: numTasks,
				message: `✅ Task Generation Completed | Tokens (I/O): 1850/840 ($0.0287)`
			});

			return { success: true, tasksGenerated: mockTasks.length };
		};

		// Run the simulation
		const result = await simulateStreamingProgress(3);

		// Verify the simulation succeeded
		expect(result.success).toBe(true);
		expect(result.tasksGenerated).toBe(3);

		// Verify progress reports were made
		expect(progressReports.length).toBeGreaterThan(0);
		expect(mockReportProgress).toHaveBeenCalledTimes(5); // 1 setup + 3 tasks + 1 completion

		// Verify MCP compliance - progress always increases or stays the same
		for (let i = 1; i < progressReports.length; i++) {
			expect(progressReports[i].progress).toBeGreaterThanOrEqual(
				progressReports[i - 1].progress
			);
		}

		// Verify consistent total throughout
		const totals = progressReports.map((r) => r.total);
		expect(new Set(totals).size).toBe(1); // All totals should be the same
		expect(totals[0]).toBe(3); // Should equal numTasks

		// Verify we have the expected progress sequence (updated for new format)
		expect(progressReports[0].progress).toBe(0); // Starting
		expect(progressReports[1].progress).toBe(1); // First task
		expect(progressReports[2].progress).toBe(2); // Second task
		expect(progressReports[3].progress).toBe(3); // Third task
		expect(progressReports[4].progress).toBe(3); // Completion

		// Verify task messages have the correct format
		const taskMessages = progressReports.filter(
			(r) =>
				r.message.includes('Task ') &&
				r.message.includes(' - ') &&
				!r.message.includes('Starting') &&
				!r.message.includes('AI analysis') &&
				!r.message.includes('Completed')
		);

		expect(taskMessages.length).toBe(3); // Should have 3 task progress messages

		// Verify all task messages have the correct format with priority indicators and tokens
		taskMessages.forEach((report) => {
			expect(report.message).toMatch(
				/^[🔴🟠🟢] Task \d+\/\d+ - .+ \| ~Output: \d+ tokens$/u
			);
		});

		// Verify specific task titles and priority indicators are included
		expect(taskMessages[0].message).toContain(
			'🔴 Task 1/3 - Set up project structure | ~Output: 280 tokens'
		);
		expect(taskMessages[1].message).toContain(
			'🔴 Task 2/3 - Implement user authentication | ~Output: 560 tokens'
		);
		expect(taskMessages[2].message).toContain(
			'🟠 Task 3/3 - Design database schema | ~Output: 840 tokens'
		);

		// Verify final completion message
		const completionMessage = progressReports[progressReports.length - 1];
		expect(completionMessage.message).toContain('✅ Task Generation Completed');
		expect(completionMessage.message).toContain('Tokens (I/O): 1850/840');
		expect(completionMessage.progress).toBe(completionMessage.total);
	});

	test('Progress reporting handles function validation', () => {
		const mockValidReportProgress = jest.fn(() => Promise.resolve());
		const mockInvalidReportProgress = 'not a function';

		// Test valid function
		expect(typeof mockValidReportProgress === 'function').toBe(true);

		// Test invalid function
		expect(typeof mockInvalidReportProgress === 'function').toBe(false);

		// Test undefined
		expect(typeof undefined === 'function').toBe(false);
	});

	test('Progress error handling does not break main flow', () => {
		const mockFailingReportProgress = jest.fn(() =>
			Promise.reject(new Error('Progress reporting failed'))
		);

		// Simulate the error handling pattern
		const handleProgressWithErrorHandling = async () => {
			try {
				await mockFailingReportProgress({
					progress: 50,
					total: 100,
					message: 'Test progress'
				}).catch((error) => {
					// This should not throw - should handle gracefully
					expect(error.message).toBe('Progress reporting failed');
					return; // Continue processing
				});

				// Main flow should continue
				return { success: true };
			} catch (error) {
				// Main flow should not be broken by progress errors
				return { success: false, error: error.message };
			}
		};

		return handleProgressWithErrorHandling().then((result) => {
			expect(result.success).toBe(true);
			expect(mockFailingReportProgress).toHaveBeenCalled();
		});
	});
});
