import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ParallelTestRunner extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.workers = [];
    this.results = {};
  }

  /**
   * Run test groups in parallel
   * @param {Object} testGroups - Groups of tests to run
   * @param {Object} sharedContext - Shared context for all tests
   * @returns {Promise<Object>} Combined results from all test groups
   */
  async runTestGroups(testGroups, sharedContext) {
    const groupNames = Object.keys(testGroups);
    const workerPromises = [];

    this.logger.info(`Starting parallel execution of ${groupNames.length} test groups`);

    for (const groupName of groupNames) {
      const workerPromise = this.runTestGroup(groupName, testGroups[groupName], sharedContext);
      workerPromises.push(workerPromise);
    }

    // Wait for all workers to complete
    const results = await Promise.allSettled(workerPromises);

    // Process results
    const combinedResults = {
      overall: 'passed',
      groups: {},
      summary: {
        totalGroups: groupNames.length,
        passedGroups: 0,
        failedGroups: 0,
        errors: []
      }
    };

    results.forEach((result, index) => {
      const groupName = groupNames[index];
      
      if (result.status === 'fulfilled') {
        combinedResults.groups[groupName] = result.value;
        if (result.value.status === 'passed') {
          combinedResults.summary.passedGroups++;
        } else {
          combinedResults.summary.failedGroups++;
          combinedResults.overall = 'failed';
        }
      } else {
        combinedResults.groups[groupName] = {
          status: 'failed',
          error: result.reason.message || 'Unknown error'
        };
        combinedResults.summary.failedGroups++;
        combinedResults.summary.errors.push({
          group: groupName,
          error: result.reason.message
        });
        combinedResults.overall = 'failed';
      }
    });

    return combinedResults;
  }

  /**
   * Run a single test group in a worker thread
   */
  async runTestGroup(groupName, testModules, sharedContext) {
    return new Promise((resolve, reject) => {
      const workerPath = join(__dirname, 'test-worker.js');
      
      const worker = new Worker(workerPath, {
        workerData: {
          groupName,
          testModules,
          sharedContext,
          logDir: this.logger.logDir,
          testRunId: this.logger.testRunId
        }
      });

      this.workers.push(worker);

      // Handle messages from worker
      worker.on('message', (message) => {
        if (message.type === 'log') {
          const level = message.level.toLowerCase();
          if (typeof this.logger[level] === 'function') {
            this.logger[level](message.message);
          } else {
            // Fallback to info if the level doesn't exist
            this.logger.info(message.message);
          }
        } else if (message.type === 'step') {
          this.logger.step(message.message);
        } else if (message.type === 'cost') {
          this.logger.addCost(message.cost);
        } else if (message.type === 'results') {
          this.results[groupName] = message.results;
        }
      });

      // Handle worker completion
      worker.on('exit', (code) => {
        this.workers = this.workers.filter(w => w !== worker);
        
        if (code === 0) {
          resolve(this.results[groupName] || { status: 'passed', group: groupName });
        } else {
          reject(new Error(`Worker for group ${groupName} exited with code ${code}`));
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        this.workers = this.workers.filter(w => w !== worker);
        reject(error);
      });

    });
  }

  /**
   * Terminate all running workers
   */
  async terminate() {
    const terminationPromises = this.workers.map(worker => 
      worker.terminate().catch(err => 
        this.logger.warning(`Failed to terminate worker: ${err.message}`)
      )
    );

    await Promise.all(terminationPromises);
    this.workers = [];
  }
}

/**
 * Sequential test runner for comparison or fallback
 */
export class SequentialTestRunner {
  constructor(logger, helpers) {
    this.logger = logger;
    this.helpers = helpers;
  }

  /**
   * Run tests sequentially
   */
  async runTests(testModules, context) {
    const results = {
      overall: 'passed',
      tests: {},
      summary: {
        totalTests: testModules.length,
        passedTests: 0,
        failedTests: 0,
        errors: []
      }
    };

    for (const testModule of testModules) {
      try {
        this.logger.step(`Running ${testModule} tests`);
        
        // Dynamic import of test module
        const testPath = join(dirname(__dirname), 'tests', `${testModule}.test.js`);
        const { default: testFn } = await import(testPath);
        
        // Run the test
        const testResults = await testFn(this.logger, this.helpers, context);
        
        results.tests[testModule] = testResults;
        
        if (testResults.status === 'passed') {
          results.summary.passedTests++;
        } else {
          results.summary.failedTests++;
          results.overall = 'failed';
        }
        
      } catch (error) {
        this.logger.error(`Failed to run ${testModule}: ${error.message}`);
        results.tests[testModule] = {
          status: 'failed',
          error: error.message
        };
        results.summary.failedTests++;
        results.summary.errors.push({
          test: testModule,
          error: error.message
        });
        results.overall = 'failed';
      }
    }

    return results;
  }
}