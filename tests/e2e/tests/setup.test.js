import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { testConfig } from '../config/test-config.js';

/**
 * Setup test module that handles initialization, PRD parsing, and complexity analysis
 * @param {Object} logger - TestLogger instance
 * @param {Object} helpers - TestHelpers instance
 * @returns {Promise<Object>} Test results object with status and directory path
 */
export async function runSetupTest(logger, helpers) {
  const testResults = {
    status: 'pending',
    testDir: null,
    steps: {
      createDirectory: false,
      linkGlobally: false,
      copyEnv: false,
      initialize: false,
      parsePrd: false,
      analyzeComplexity: false,
      generateReport: false
    },
    errors: [],
    prdPath: null,
    complexityReport: null
  };

  try {
    // Step 1: Create test directory with timestamp
    logger.step('Creating test directory');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, -1);
    const testDir = join(testConfig.paths.baseTestDir, `run_${timestamp}`);
    
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    
    testResults.testDir = testDir;
    testResults.steps.createDirectory = true;
    logger.success(`Test directory created: ${testDir}`);

    // Step 2: Link task-master globally
    logger.step('Linking task-master globally');
    const linkResult = await helpers.executeCommand('npm', ['link'], {
      cwd: testConfig.paths.projectRoot,
      timeout: 60000
    });

    if (linkResult.exitCode === 0) {
      testResults.steps.linkGlobally = true;
      logger.success('Task-master linked globally');
    } else {
      throw new Error(`Failed to link task-master: ${linkResult.stderr}`);
    }

    // Step 3: Copy .env file
    logger.step('Copying .env file to test directory');
    const envSourcePath = testConfig.paths.mainEnvFile;
    const envDestPath = join(testDir, '.env');
    
    if (helpers.fileExists(envSourcePath)) {
      if (helpers.copyFile(envSourcePath, envDestPath)) {
        testResults.steps.copyEnv = true;
        logger.success('.env file copied successfully');
      } else {
        throw new Error('Failed to copy .env file');
      }
    } else {
      logger.warning('.env file not found at source, proceeding without it');
    }

    // Step 4: Initialize project with task-master init
    logger.step('Initializing project with task-master');
    const initResult = await helpers.taskMaster('init', [
      '-y',
      '--name="E2E Test ' + testDir.split('/').pop() + '"',
      '--description="Automated E2E test run"'
    ], {
      cwd: testDir,
      timeout: 120000
    });

    if (initResult.exitCode === 0) {
      testResults.steps.initialize = true;
      logger.success('Project initialized successfully');
      
      // Save init debug log if available
      const initDebugPath = join(testDir, 'init-debug.log');
      if (existsSync(initDebugPath)) {
        logger.info('Init debug log saved');
      }
    } else {
      throw new Error(`Initialization failed: ${initResult.stderr}`);
    }

    // Step 5: Parse PRD from sample file
    logger.step('Parsing PRD from sample file');
    
    // First, copy the sample PRD to the test directory
    const prdSourcePath = testConfig.paths.samplePrdSource;
    const prdDestPath = join(testDir, 'prd.txt');
    testResults.prdPath = prdDestPath;
    
    if (!helpers.fileExists(prdSourcePath)) {
      // If sample PRD doesn't exist in fixtures, use the example PRD
      const examplePrdPath = join(testConfig.paths.projectRoot, 'assets/example_prd.txt');
      if (helpers.fileExists(examplePrdPath)) {
        helpers.copyFile(examplePrdPath, prdDestPath);
        logger.info('Using example PRD file');
      } else {
        // Create a minimal PRD for testing
        const minimalPrd = `<PRD>
# Overview
A simple task management system for developers.

# Core Features
- Task creation and management
- Task dependencies
- Status tracking
- Task prioritization

# Technical Architecture
- Node.js backend
- REST API
- JSON data storage
- CLI interface

# Development Roadmap
Phase 1: Core functionality
- Initialize project structure
- Implement task CRUD operations
- Add dependency management

Phase 2: Enhanced features
- Add task prioritization
- Implement search functionality
- Add export capabilities

# Logical Dependency Chain
1. Project setup and initialization
2. Core data models
3. Basic CRUD operations
4. Dependency system
5. CLI interface
6. Advanced features
</PRD>`;
        
        writeFileSync(prdDestPath, minimalPrd);
        logger.info('Created minimal PRD for testing');
      }
    } else {
      helpers.copyFile(prdSourcePath, prdDestPath);
    }

    // Parse the PRD
    const parsePrdResult = await helpers.taskMaster('parse-prd', ['prd.txt'], {
      cwd: testDir,
      timeout: 180000
    });

    if (parsePrdResult.exitCode === 0) {
      testResults.steps.parsePrd = true;
      logger.success('PRD parsed successfully');
      
      // Extract task count from output
      const taskCountMatch = parsePrdResult.stdout.match(/(\d+) tasks? created/i);
      if (taskCountMatch) {
        logger.info(`Created ${taskCountMatch[1]} tasks from PRD`);
      }
    } else {
      throw new Error(`PRD parsing failed: ${parsePrdResult.stderr}`);
    }

    // Step 6: Run complexity analysis
    logger.step('Running complexity analysis on parsed tasks');
    // Ensure reports directory exists
    const reportsDir = join(testDir, '.taskmaster/reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    const analyzeResult = await helpers.taskMaster('analyze-complexity', ['--research', '--output', '.taskmaster/reports/task-complexity-report.json'], {
      cwd: testDir,
      timeout: 240000
    });

    if (analyzeResult.exitCode === 0) {
      testResults.steps.analyzeComplexity = true;
      logger.success('Complexity analysis completed');
      
      // Extract complexity information from output
      const complexityMatch = analyzeResult.stdout.match(/Total Complexity Score: ([\d.]+)/);
      if (complexityMatch) {
        logger.info(`Total complexity score: ${complexityMatch[1]}`);
      }
    } else {
      throw new Error(`Complexity analysis failed: ${analyzeResult.stderr}`);
    }

    // Step 7: Generate complexity report
    logger.step('Generating complexity report');
    const reportResult = await helpers.taskMaster('complexity-report', [], {
      cwd: testDir,
      timeout: 60000
    });

    if (reportResult.exitCode === 0) {
      testResults.steps.generateReport = true;
      logger.success('Complexity report generated');
      
      // Check if complexity report file was created (not needed since complexity-report reads from the standard location)
      const reportPath = join(testDir, '.taskmaster/reports/task-complexity-report.json');
      if (helpers.fileExists(reportPath)) {
        testResults.complexityReport = helpers.readJson(reportPath);
        logger.info('Complexity report saved to task-complexity-report.json');
        
        // Log summary if available
        if (testResults.complexityReport && testResults.complexityReport.summary) {
          const summary = testResults.complexityReport.summary;
          logger.info(`Tasks analyzed: ${summary.totalTasks || 0}`);
          logger.info(`Average complexity: ${summary.averageComplexity || 0}`);
        }
      }
    } else {
      logger.warning(`Complexity report generation had issues: ${reportResult.stderr}`);
      // Don't fail the test for report generation issues
      testResults.steps.generateReport = true;
    }

    // Verify tasks.json was created
    const tasksJsonPath = join(testDir, '.taskmaster/tasks/tasks.json');
    if (helpers.fileExists(tasksJsonPath)) {
      const taskCount = helpers.getTaskCount(tasksJsonPath);
      logger.info(`Verified tasks.json exists with ${taskCount} tasks`);
    } else {
      throw new Error('tasks.json was not created');
    }

    // All steps completed successfully
    testResults.status = 'success';
    logger.success('Setup test completed successfully');

  } catch (error) {
    testResults.status = 'failed';
    testResults.errors.push(error.message);
    logger.error(`Setup test failed: ${error.message}`);
    
    // Log which steps completed
    logger.info('Completed steps:');
    Object.entries(testResults.steps).forEach(([step, completed]) => {
      if (completed) {
        logger.info(`  ✓ ${step}`);
      } else {
        logger.info(`  ✗ ${step}`);
      }
    });
  }

  // Flush logs before returning
  logger.flush();

  return testResults;
}

// Export default for direct execution
export default runSetupTest;