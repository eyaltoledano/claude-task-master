import { parentPort, workerData } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TestLogger } from '../utils/logger.js';
import { TestHelpers } from '../utils/test-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Worker logger that sends messages to parent
class WorkerLogger extends TestLogger {
  constructor(logDir, testRunId, groupName) {
    super(logDir, `${testRunId}_${groupName}`);
    this.groupName = groupName;
  }

  log(level, message, options = {}) {
    super.log(level, message, options);
    
    // Send log to parent
    parentPort.postMessage({
      type: 'log',
      level: level.toLowerCase(),
      message: `[${this.groupName}] ${message}`
    });
  }

  step(message) {
    super.step(message);
    
    parentPort.postMessage({
      type: 'step',
      message: `[${this.groupName}] ${message}`
    });
  }

  addCost(cost) {
    super.addCost(cost);
    
    parentPort.postMessage({
      type: 'cost',
      cost
    });
  }
}

// Main worker execution
async function runTestGroup() {
  const { groupName, testModules, sharedContext, logDir, testRunId } = workerData;
  
  const logger = new WorkerLogger(logDir, testRunId, groupName);
  const helpers = new TestHelpers(logger);
  
  logger.info(`Worker started for test group: ${groupName}`);
  
  const results = {
    group: groupName,
    status: 'passed',
    tests: {},
    errors: [],
    startTime: Date.now()
  };

  try {
    // Run each test module in the group
    for (const testModule of testModules) {
      try {
        logger.info(`Running test: ${testModule}`);
        
        // Dynamic import of test module
        const testPath = join(dirname(__dirname), 'tests', `${testModule}.test.js`);
        const { default: testFn } = await import(testPath);
        
        // Run the test with shared context
        const testResults = await testFn(logger, helpers, sharedContext);
        
        results.tests[testModule] = testResults;
        
        if (testResults.status !== 'passed') {
          results.status = 'failed';
          if (testResults.errors) {
            results.errors.push(...testResults.errors);
          }
        }
        
      } catch (error) {
        logger.error(`Test ${testModule} failed: ${error.message}`);
        results.tests[testModule] = {
          status: 'failed',
          error: error.message,
          stack: error.stack
        };
        results.status = 'failed';
        results.errors.push({
          test: testModule,
          error: error.message
        });
      }
    }
    
  } catch (error) {
    logger.error(`Worker error: ${error.message}`);
    results.status = 'failed';
    results.errors.push({
      group: groupName,
      error: error.message,
      stack: error.stack
    });
  }

  results.endTime = Date.now();
  results.duration = results.endTime - results.startTime;
  
  // Flush logs and get summary
  logger.flush();
  const summary = logger.getSummary();
  results.summary = summary;

  // Send results to parent
  parentPort.postMessage({
    type: 'results',
    results
  });

  logger.info(`Worker completed for test group: ${groupName}`);
}

// Run the test group
runTestGroup().catch(error => {
  console.error('Worker fatal error:', error);
  process.exit(1);
});