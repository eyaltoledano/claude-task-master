/**
 * Performance test for <200ms requirement on optimistic UI updates
 * Tests the integration of StateManager and APIClient
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Set up DOM environment
const dom = new JSDOM(
	`
    <!DOCTYPE html>
    <html>
    <body>
        <div class="kanban-board">
            <div class="kanban-column" data-column="backlog">
                <div class="task-container" data-column="backlog">
                    <div class="task-card" data-task-id="1" data-status="backlog">
                        <div class="task-title">Task 1</div>
                    </div>
                </div>
            </div>
            <div class="kanban-column" data-column="in-progress">
                <div class="task-container" data-column="in-progress"></div>
            </div>
        </div>
    </body>
    </html>
`,
	{
		url: 'http://localhost:3000',
		pretendToBeVisual: true
	}
);

global.document = dom.window.document;
global.window = dom.window;
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = clearTimeout;

// Load the actual implementations
const stateManagerPath = path.join(
	__dirname,
	'../../../src/ui/client/js/stateManager.js'
);
const apiClientPath = path.join(
	__dirname,
	'../../../src/ui/client/js/apiClient.js'
);

const stateManagerCode = fs.readFileSync(stateManagerPath, 'utf8');
const apiClientCode = fs.readFileSync(apiClientPath, 'utf8');

// Execute the modules
eval(stateManagerCode.replace('export default', 'StateManager ='));
eval(apiClientCode.replace('export', ''));

async function runPerformanceTest() {
	console.log('Running Performance Test for <200ms Requirement\n');

	const stateManager = new StateManager({
		maxHistorySize: 20,
		debounceDelay: 0, // No debounce for immediate updates
		enableAnimations: true
	});
	stateManager.init();

	const apiClient = new APIClient({
		maxRetries: 3,
		retryDelay: 1000,
		backoffMultiplier: 2,
		enableQueuing: true
	});

	// Mock fetch for API calls
	global.fetch = jest.fn(() =>
		Promise.resolve({
			ok: true,
			json: async () => ({
				success: true,
				task: { id: '1', status: 'in-progress' }
			})
		})
	);

	const measurements = [];
	const iterations = 10;

	console.log(`Running ${iterations} iterations of optimistic update...\n`);

	for (let i = 0; i < iterations; i++) {
		const startTime = performance.now();

		// Simulate drag-drop operation
		const change = {
			taskId: '1',
			fromStatus: i % 2 === 0 ? 'backlog' : 'in-progress',
			toStatus: i % 2 === 0 ? 'in-progress' : 'backlog'
		};

		// Apply optimistic update
		const changeId = await stateManager.applyOptimisticUpdate(change);

		// Trigger DOM update
		await new Promise((resolve) => setTimeout(resolve, 0));

		const endTime = performance.now();
		const duration = endTime - startTime;
		measurements.push(duration);

		console.log(
			`Iteration ${i + 1}: ${duration.toFixed(2)}ms ${duration < 200 ? '✅' : '❌'}`
		);

		// Confirm the change for next iteration
		stateManager.confirmChange(changeId);
	}

	console.log('\n--- Performance Summary ---');
	console.log(
		`Average: ${(measurements.reduce((a, b) => a + b, 0) / measurements.length).toFixed(2)}ms`
	);
	console.log(`Min: ${Math.min(...measurements).toFixed(2)}ms`);
	console.log(`Max: ${Math.max(...measurements).toFixed(2)}ms`);
	console.log(
		`Under 200ms: ${measurements.filter((m) => m < 200).length}/${iterations}`
	);

	const allUnder200ms = measurements.every((m) => m < 200);
	console.log(
		`\n${allUnder200ms ? '✅ PASS' : '❌ FAIL'}: All updates completed in <200ms`
	);

	// Test rapid consecutive updates (batching)
	console.log('\n--- Batching Test ---');
	const batchStart = performance.now();

	const promises = [];
	for (let i = 0; i < 5; i++) {
		promises.push(
			stateManager.applyOptimisticUpdate({
				taskId: `${i + 1}`,
				fromStatus: 'backlog',
				toStatus: 'in-progress'
			})
		);
	}

	await Promise.all(promises);
	await new Promise((resolve) => setTimeout(resolve, 0));

	const batchEnd = performance.now();
	const batchDuration = batchEnd - batchStart;

	console.log(`5 rapid updates completed in: ${batchDuration.toFixed(2)}ms`);
	console.log(`Average per update: ${(batchDuration / 5).toFixed(2)}ms`);
	console.log(
		`${batchDuration < 1000 ? '✅ PASS' : '❌ FAIL'}: Batch completed in reasonable time`
	);

	return allUnder200ms;
}

// Jest mock for testing
if (typeof jest === 'undefined') {
	global.jest = {
		fn: (impl) => {
			const mockFn = impl || (() => {});
			mockFn.mock = { calls: [] };
			return mockFn;
		}
	};
}

// Run the test
runPerformanceTest()
	.then((passed) => {
		process.exit(passed ? 0 : 1);
	})
	.catch((error) => {
		console.error('Test failed:', error);
		process.exit(1);
	});
