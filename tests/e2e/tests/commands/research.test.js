/**
 * Comprehensive E2E tests for research command
 * Tests all aspects of AI-powered research functionality
 */

const {
	mkdtempSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	mkdirSync
} = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

describe('research command', () => {
	let testDir;
	let helpers;

	beforeEach(async () => {
		// Create test directory
		testDir = mkdtempSync(join(tmpdir(), 'task-master-research-'));

		// Initialize test helpers
		const context = global.createTestContext('research');
		helpers = context.helpers;

		// Copy .env file if it exists
		const mainEnvPath = join(__dirname, '../../../../.env');
		const testEnvPath = join(testDir, '.env');
		if (existsSync(mainEnvPath)) {
			const envContent = readFileSync(mainEnvPath, 'utf8');
			writeFileSync(testEnvPath, envContent);
		}

		// Initialize task-master project
		const initResult = await helpers.taskMaster('init', ['-y'], {
			cwd: testDir
		});
		expect(initResult).toHaveExitCode(0);
	});

	afterEach(() => {
		// Clean up test directory
		if (testDir && existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Basic research functionality', () => {
		it('should perform research on a topic', async () => {
			const result = await helpers.taskMaster(
				'research',
				[
					'What are the best practices for implementing OAuth 2.0 authentication?'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');

			// Should contain relevant OAuth information
			const hasOAuthInfo =
				result.stdout.toLowerCase().includes('oauth') ||
				result.stdout.toLowerCase().includes('authentication');
			expect(hasOAuthInfo).toBe(true);
		}, 120000);

		it('should research using --topic flag', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'React performance optimization techniques'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');

			// Should contain React-related information
			const hasReactInfo =
				result.stdout.toLowerCase().includes('react') ||
				result.stdout.toLowerCase().includes('performance');
			expect(hasReactInfo).toBe(true);
		}, 120000);

		it('should handle technical research queries', async () => {
			const result = await helpers.taskMaster(
				'research',
				['Compare PostgreSQL vs MongoDB for a real-time analytics application'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Should contain database comparison
			const hasDatabaseInfo =
				result.stdout.toLowerCase().includes('postgresql') ||
				result.stdout.toLowerCase().includes('mongodb');
			expect(hasDatabaseInfo).toBe(true);
		}, 120000);
	});

	describe('Research depth control', () => {
		it('should perform quick research with --quick flag', async () => {
			const startTime = Date.now();
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'REST API design', '--quick'],
				{ cwd: testDir, timeout: 60000 }
			);
			const duration = Date.now() - startTime;

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');

			// Quick research should be faster
			expect(duration).toBeLessThan(60000);
		}, 90000);

		it('should perform detailed research with --detailed flag', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Microservices architecture patterns', '--detailed'],
				{ cwd: testDir, timeout: 120000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');

			// Detailed research should have more content
			expect(result.stdout.length).toBeGreaterThan(500);

			// Should contain comprehensive information
			const hasPatterns =
				result.stdout.toLowerCase().includes('pattern') ||
				result.stdout.toLowerCase().includes('architecture');
			expect(hasPatterns).toBe(true);
		}, 150000);
	});

	describe('Research with citations', () => {
		it('should include sources with --sources flag', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'GraphQL best practices', '--sources'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');

			// Should include source references
			const hasSources =
				result.stdout.includes('Source:') ||
				result.stdout.includes('Reference:') ||
				result.stdout.includes('http');
			expect(hasSources).toBe(true);
		}, 120000);
	});

	describe('Research output options', () => {
		it('should save research to file with --save flag', async () => {
			const outputPath = join(testDir, 'research-output.md');

			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Docker container security', '--save', outputPath],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research saved to');

			// Verify file was created
			expect(existsSync(outputPath)).toBe(true);

			// Verify file contains research content
			const content = readFileSync(outputPath, 'utf8');
			expect(content).toContain('Docker');
			expect(content.length).toBeGreaterThan(100);
		}, 120000);

		it('should output in JSON format', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'WebSocket implementation', '--output', 'json'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Output should be valid JSON
			const jsonOutput = JSON.parse(result.stdout);
			expect(jsonOutput.topic).toBeDefined();
			expect(jsonOutput.research).toBeDefined();
			expect(jsonOutput.timestamp).toBeDefined();
		}, 120000);

		it('should output in markdown format by default', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'CI/CD pipeline best practices'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);

			// Should contain markdown formatting
			const hasMarkdown =
				result.stdout.includes('#') ||
				result.stdout.includes('*') ||
				result.stdout.includes('-');
			expect(hasMarkdown).toBe(true);
		}, 120000);
	});

	describe('Research categories', () => {
		it('should research coding patterns', async () => {
			const result = await helpers.taskMaster(
				'research',
				[
					'--topic',
					'Singleton pattern in JavaScript',
					'--category',
					'patterns'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('singleton');
			expect(result.stdout.toLowerCase()).toContain('pattern');
		}, 120000);

		it('should research security topics', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'OWASP Top 10 vulnerabilities', '--category', 'security'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('security');
			expect(result.stdout.toUpperCase()).toContain('OWASP');
		}, 120000);

		it('should research performance topics', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Database query optimization', '--category', 'performance'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('optimization');
			expect(result.stdout.toLowerCase()).toContain('performance');
		}, 120000);
	});

	describe('Research integration with tasks', () => {
		it('should research for specific task context', async () => {
			// Create a task first
			const addResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Implement real-time chat feature'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Research for the task
			const result = await helpers.taskMaster(
				'research',
				['--task', taskId, '--topic', 'WebSocket vs Server-Sent Events'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research Results');
			expect(result.stdout.toLowerCase()).toContain('websocket');
		}, 120000);

		it('should append research to task notes', async () => {
			// Create a task
			const addResult = await helpers.taskMaster(
				'add-task',
				['--prompt', 'Setup monitoring system'],
				{ cwd: testDir }
			);
			const taskId = helpers.extractTaskId(addResult.stdout);

			// Research and append to task
			const result = await helpers.taskMaster(
				'research',
				[
					'--task',
					taskId,
					'--topic',
					'Prometheus vs ELK stack',
					'--append-to-task'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research appended to task');

			// Verify task has research notes
			const showResult = await helpers.taskMaster('show', [taskId], {
				cwd: testDir
			});
			expect(showResult.stdout.toLowerCase()).toContain('prometheus');
		}, 120000);
	});

	describe('Research history', () => {
		it('should save research history', async () => {
			// Perform multiple researches
			await helpers.taskMaster(
				'research',
				['--topic', 'GraphQL subscriptions'],
				{ cwd: testDir, timeout: 60000 }
			);

			await helpers.taskMaster('research', ['--topic', 'Redis pub/sub'], {
				cwd: testDir,
				timeout: 60000
			});

			// Check research history
			const historyPath = join(testDir, '.taskmaster/research-history.json');
			if (existsSync(historyPath)) {
				const history = JSON.parse(readFileSync(historyPath, 'utf8'));
				expect(history.length).toBeGreaterThanOrEqual(2);
			}
		}, 150000);

		it('should list recent research with --history flag', async () => {
			// Perform a research first
			await helpers.taskMaster(
				'research',
				['--topic', 'Kubernetes deployment strategies'],
				{ cwd: testDir, timeout: 60000 }
			);

			// List history
			const result = await helpers.taskMaster('research', ['--history'], {
				cwd: testDir
			});

			expect(result).toHaveExitCode(0);
			expect(result.stdout).toContain('Research History');
		}, 90000);
	});

	describe('Error handling', () => {
		it('should fail without topic', async () => {
			const result = await helpers.taskMaster('research', [], {
				cwd: testDir,
				allowFailure: true
			});

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('topic');
		});

		it('should handle invalid output format', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Test topic', '--output', 'invalid-format'],
				{ cwd: testDir, allowFailure: true }
			);

			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain('Invalid output format');
		});

		it('should handle network errors gracefully', async () => {
			// This test might pass if network is available
			// It's mainly to ensure the command handles errors gracefully
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Test with potential network issues'],
				{ cwd: testDir, timeout: 30000, allowFailure: true }
			);

			// Should either succeed or fail gracefully
			if (result.exitCode !== 0) {
				expect(result.stderr).toBeTruthy();
			} else {
				expect(result.stdout).toContain('Research Results');
			}
		}, 45000);
	});

	describe('Research focus areas', () => {
		it('should research implementation details', async () => {
			const result = await helpers.taskMaster(
				'research',
				[
					'--topic',
					'JWT implementation in Node.js',
					'--focus',
					'implementation'
				],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('implementation');
			expect(result.stdout.toLowerCase()).toContain('code');
		}, 120000);

		it('should research best practices', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'REST API versioning', '--focus', 'best-practices'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout.toLowerCase()).toContain('best practice');
		}, 120000);

		it('should research comparisons', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Vue vs React vs Angular', '--focus', 'comparison'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			const output = result.stdout.toLowerCase();
			expect(output).toContain('vue');
			expect(output).toContain('react');
			expect(output).toContain('angular');
		}, 120000);
	});

	describe('Research with constraints', () => {
		it('should limit research length with --max-length', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Machine learning basics', '--max-length', '500'],
				{ cwd: testDir, timeout: 60000 }
			);

			expect(result).toHaveExitCode(0);
			// Research output should be concise
			expect(result.stdout.length).toBeLessThan(2000); // Accounting for formatting
		}, 90000);

		it('should research with specific year constraint', async () => {
			const result = await helpers.taskMaster(
				'research',
				['--topic', 'Latest JavaScript features', '--year', '2024'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			// Should focus on recent content
			const hasRecentInfo =
				result.stdout.includes('2024') ||
				result.stdout.toLowerCase().includes('latest') ||
				result.stdout.toLowerCase().includes('recent');
			expect(hasRecentInfo).toBe(true);
		}, 120000);
	});

	describe('Research caching', () => {
		it('should cache and reuse research results', async () => {
			const topic = 'Redis caching strategies';

			// First research
			const startTime1 = Date.now();
			const result1 = await helpers.taskMaster('research', ['--topic', topic], {
				cwd: testDir,
				timeout: 90000
			});
			const duration1 = Date.now() - startTime1;
			expect(result1).toHaveExitCode(0);

			// Second research (should be cached)
			const startTime2 = Date.now();
			const result2 = await helpers.taskMaster('research', ['--topic', topic], {
				cwd: testDir,
				timeout: 30000
			});
			const duration2 = Date.now() - startTime2;
			expect(result2).toHaveExitCode(0);

			// Cached result should be much faster
			if (result2.stdout.includes('(cached)')) {
				expect(duration2).toBeLessThan(duration1 / 2);
			}
		}, 150000);

		it('should bypass cache with --no-cache flag', async () => {
			const topic = 'Docker best practices';

			// First research
			await helpers.taskMaster('research', ['--topic', topic], {
				cwd: testDir,
				timeout: 60000
			});

			// Second research without cache
			const result = await helpers.taskMaster(
				'research',
				['--topic', topic, '--no-cache'],
				{ cwd: testDir, timeout: 90000 }
			);

			expect(result).toHaveExitCode(0);
			expect(result.stdout).not.toContain('(cached)');
		}, 180000);
	});
});
