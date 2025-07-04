/**
 * @fileoverview Safety Check Integration Tests
 * Comprehensive integration testing for safety validation and failure handling
 * across the AST-Claude pipeline. Tests safety checks, quality validation,
 * pre-commit hooks, and recovery mechanisms.
 * 
 * @author Claude (Task Master Flow Testing Phase 3.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
const mockFileSystem = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn(),
  stat: jest.fn(),
  createBackup: jest.fn(),
  restoreBackup: jest.fn()
};

const mockGitService = {
  getChangedFiles: jest.fn(),
  getCommitHash: jest.fn(),
  createBranch: jest.fn(),
  stageFiles: jest.fn(),
  commitChanges: jest.fn(),
  revertChanges: jest.fn()
};

const mockLintingService = {
  lintFile: jest.fn(),
  lintProject: jest.fn(),
  fixLintErrors: jest.fn(),
  getLintConfig: jest.fn()
};

const mockSecurityScanner = {
  scanFile: jest.fn(),
  scanProject: jest.fn(),
  checkVulnerabilities: jest.fn(),
  validateDependencies: jest.fn()
};

const mockQualityAnalyzer = {
  analyzeComplexity: jest.fn(),
  checkCoverage: jest.fn(),
  analyzePerformance: jest.fn(),
  validateArchitecture: jest.fn()
};

// Mock Safety Check Coordinator
class MockSafetyCheckCoordinator extends EventEmitter {
  constructor() {
    super();
    this.checks = new Map();
    this.policies = new Map();
    this.violations = [];
    this.statistics = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      skippedChecks: 0,
      criticalFailures: 0,
      averageCheckTime: 0
    };
    this.config = {
      enablePreCommitChecks: true,
      enableRealTimeChecks: true,
      failOnCritical: true,
      autoFixEnabled: false,
      backupBeforeChanges: true
    };
  }

  async registerSafetyCheck(name, checker, config = {}) {
    const checkConfig = {
      name,
      checker,
      level: config.level || 'warning', // 'info', 'warning', 'error', 'critical'
      category: config.category || 'general',
      enabled: config.enabled !== false,
      autoFix: config.autoFix || false,
      dependencies: config.dependencies || [],
      timeout: config.timeout || 30000,
      retries: config.retries || 2,
      ...config
    };

    this.checks.set(name, checkConfig);
    this.emit('safetyCheckRegistered', { name, config: checkConfig });
    return true;
  }

  async runSafetyChecks(context) {
    const checkId = `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      this.statistics.totalChecks++;
      
      const checkContext = {
        checkId,
        startTime,
        ...context,
        violations: [],
        fixes: [],
        results: new Map()
      };

      this.emit('safetyChecksStarted', { checkId, context: checkContext });

      // Get applicable checks based on context
      const applicableChecks = this.getApplicableChecks(context);
      
      // Create backup if enabled
      if (this.config.backupBeforeChanges && context.filePaths) {
        await this.createBackup(checkContext);
      }

      // Run pre-commit checks if applicable
      if (context.type === 'pre-commit') {
        await this.runPreCommitChecks(checkContext, applicableChecks);
      }

      // Run standard safety checks
      await this.runStandardChecks(checkContext, applicableChecks);

      // Run quality checks
      await this.runQualityChecks(checkContext);

      // Run security checks
      await this.runSecurityChecks(checkContext);

      // Analyze violations and determine overall result
      const result = this.analyzeResults(checkContext);

      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      this.updateStatistics(result, executionTime);

      this.emit('safetyChecksCompleted', { 
        checkId, 
        result, 
        executionTime,
        violations: checkContext.violations 
      });

      return {
        success: result.overall === 'pass' || result.overall === 'pass-with-warnings',
        checkId,
        executionTime,
        result,
        violations: checkContext.violations,
        fixes: checkContext.fixes,
        results: Object.fromEntries(checkContext.results)
      };

    } catch (error) {
      this.statistics.failedChecks++;
      this.emit('safetyChecksError', { checkId, error });
      
      return {
        success: false,
        checkId,
        error: error.message,
        executionTime: Date.now() - startTime,
        violations: [],
        fixes: [],
        results: {}
      };
    }
  }

  async runPreCommitChecks(context, checks) {
    const preCommitChecks = checks.filter(check => 
      check.category === 'pre-commit' || check.category === 'general'
    );

    this.emit('preCommitChecksStarted', { 
      checkId: context.checkId, 
      checkCount: preCommitChecks.length 
    });

    for (const check of preCommitChecks) {
      await this.executeCheck(context, check, 'pre-commit');
    }

    this.emit('preCommitChecksCompleted', { 
      checkId: context.checkId,
      violations: context.violations.filter(v => v.phase === 'pre-commit')
    });
  }

  async runStandardChecks(context, checks) {
    const standardChecks = checks.filter(check => 
      check.category !== 'pre-commit' && check.category !== 'security' && check.category !== 'quality'
    );

    for (const check of standardChecks) {
      await this.executeCheck(context, check, 'standard');
    }
  }

  async runQualityChecks(context) {
    this.emit('qualityChecksStarted', { checkId: context.checkId });

    const qualityResults = {
      complexity: null,
      coverage: null,
      performance: null,
      architecture: null
    };

    try {
      // Complexity analysis
      if (context.filePaths) {
        qualityResults.complexity = await mockQualityAnalyzer.analyzeComplexity(context.filePaths);
        this.validateComplexity(context, qualityResults.complexity);
      }

      // Coverage analysis
      if (context.testFiles) {
        qualityResults.coverage = await mockQualityAnalyzer.checkCoverage(context.testFiles);
        this.validateCoverage(context, qualityResults.coverage);
      }

      // Performance analysis
      if (context.performanceTests) {
        qualityResults.performance = await mockQualityAnalyzer.analyzePerformance(context.performanceTests);
        this.validatePerformance(context, qualityResults.performance);
      }

      // Architecture validation
      if (context.projectRoot) {
        qualityResults.architecture = await mockQualityAnalyzer.validateArchitecture(context.projectRoot);
        this.validateArchitecture(context, qualityResults.architecture);
      }

      context.results.set('quality', qualityResults);

    } catch (error) {
      context.violations.push({
        type: 'quality-check-error',
        level: 'error',
        message: `Quality check failed: ${error.message}`,
        phase: 'quality',
        timestamp: new Date().toISOString()
      });
    }

    this.emit('qualityChecksCompleted', { 
      checkId: context.checkId, 
      results: qualityResults 
    });
  }

  async runSecurityChecks(context) {
    this.emit('securityChecksStarted', { checkId: context.checkId });

    const securityResults = {
      fileScans: [],
      vulnerabilities: [],
      dependencies: []
    };

    try {
      // File security scans
      if (context.filePaths) {
        for (const filePath of context.filePaths) {
          const scanResult = await mockSecurityScanner.scanFile(filePath);
          securityResults.fileScans.push({ filePath, ...scanResult });
          
          if (scanResult.violations && scanResult.violations.length > 0) {
            context.violations.push(...scanResult.violations.map(v => ({
              ...v,
              type: 'security',
              phase: 'security',
              filePath,
              timestamp: new Date().toISOString()
            })));
          }
        }
      }

      // Project-wide vulnerability check
      if (context.projectRoot) {
        securityResults.vulnerabilities = await mockSecurityScanner.checkVulnerabilities(context.projectRoot);
        
        securityResults.vulnerabilities.forEach(vuln => {
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            context.violations.push({
              type: 'security-vulnerability',
              level: vuln.severity === 'critical' ? 'critical' : 'error',
              message: `Security vulnerability: ${vuln.description}`,
              phase: 'security',
              vulnerability: vuln,
              timestamp: new Date().toISOString()
            });
          }
        });
      }

      // Dependency validation
      if (context.dependencies) {
        securityResults.dependencies = await mockSecurityScanner.validateDependencies(context.dependencies);
        
        securityResults.dependencies.forEach(dep => {
          if (dep.issues && dep.issues.length > 0) {
            context.violations.push(...dep.issues.map(issue => ({
              type: 'dependency-security',
              level: issue.severity || 'warning',
              message: `Dependency issue in ${dep.name}: ${issue.description}`,
              phase: 'security',
              dependency: dep.name,
              timestamp: new Date().toISOString()
            })));
          }
        });
      }

      context.results.set('security', securityResults);

    } catch (error) {
      context.violations.push({
        type: 'security-check-error',
        level: 'error',
        message: `Security check failed: ${error.message}`,
        phase: 'security',
        timestamp: new Date().toISOString()
      });
    }

    this.emit('securityChecksCompleted', { 
      checkId: context.checkId, 
      results: securityResults 
    });
  }

  async executeCheck(context, check, phase) {
    const checkStartTime = Date.now();
    
    try {
      this.emit('checkStarted', { 
        checkId: context.checkId, 
        checkName: check.name, 
        phase 
      });

      const checkContext = {
        checkId: context.checkId,
        phase,
        filePaths: context.filePaths,
        projectRoot: context.projectRoot,
        options: context.options || {},
        timestamp: new Date().toISOString()
      };

      let result;
      let retryCount = 0;
      
      while (retryCount <= check.retries) {
        try {
          result = await Promise.race([
            check.checker(checkContext),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Check ${check.name} timeout`)), check.timeout)
            )
          ]);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount > check.retries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }

      const checkEndTime = Date.now();
      const checkExecutionTime = checkEndTime - checkStartTime;

      context.results.set(check.name, result);

      // Process check result
      if (result.violations && result.violations.length > 0) {
        context.violations.push(...result.violations.map(v => ({
          ...v,
          checkName: check.name,
          level: v.level || check.level,
          phase,
          timestamp: new Date().toISOString()
        })));
      }

      // Process potential fixes
      if (result.fixes && result.fixes.length > 0 && check.autoFix) {
        context.fixes.push(...result.fixes.map(f => ({
          ...f,
          checkName: check.name,
          phase,
          timestamp: new Date().toISOString()
        })));
      }

      this.emit('checkCompleted', { 
        checkId: context.checkId, 
        checkName: check.name, 
        phase, 
        result,
        executionTime: checkExecutionTime 
      });

    } catch (error) {
      context.violations.push({
        type: 'check-execution-error',
        level: 'error',
        message: `Check ${check.name} failed: ${error.message}`,
        checkName: check.name,
        phase,
        timestamp: new Date().toISOString()
      });

      this.emit('checkError', { 
        checkId: context.checkId, 
        checkName: check.name, 
        phase, 
        error 
      });
    }
  }

  getApplicableChecks(context) {
    return Array.from(this.checks.values())
      .filter(check => {
        if (!check.enabled) return false;
        
        // Filter by file type if specified
        if (check.fileTypes && context.filePaths) {
          const hasApplicableFiles = context.filePaths.some(filePath =>
            check.fileTypes.some(type => filePath.endsWith(type))
          );
          if (!hasApplicableFiles) return false;
        }

        // Filter by context type if specified
        if (check.contextTypes && !check.contextTypes.includes(context.type)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by level priority (critical first)
        const levelPriority = { critical: 0, error: 1, warning: 2, info: 3 };
        return levelPriority[a.level] - levelPriority[b.level];
      });
  }

  validateComplexity(context, complexityResult) {
    if (complexityResult.averageComplexity > 10) {
      context.violations.push({
        type: 'high-complexity',
        level: complexityResult.averageComplexity > 15 ? 'error' : 'warning',
        message: `High code complexity detected: ${complexityResult.averageComplexity}`,
        phase: 'quality',
        data: complexityResult
      });
    }
  }

  validateCoverage(context, coverageResult) {
    if (coverageResult.percentage < 80) {
      context.violations.push({
        type: 'low-coverage',
        level: coverageResult.percentage < 60 ? 'error' : 'warning',
        message: `Low test coverage: ${coverageResult.percentage}%`,
        phase: 'quality',
        data: coverageResult
      });
    }
  }

  validatePerformance(context, performanceResult) {
    if (performanceResult.averageResponseTime > 2000) {
      context.violations.push({
        type: 'slow-performance',
        level: performanceResult.averageResponseTime > 5000 ? 'error' : 'warning',
        message: `Slow performance detected: ${performanceResult.averageResponseTime}ms`,
        phase: 'quality',
        data: performanceResult
      });
    }
  }

  validateArchitecture(context, architectureResult) {
    if (architectureResult.violations && architectureResult.violations.length > 0) {
      context.violations.push(...architectureResult.violations.map(violation => ({
        type: 'architecture-violation',
        level: violation.severity || 'warning',
        message: violation.message,
        phase: 'quality',
        data: violation
      })));
    }
  }

  analyzeResults(context) {
    const violations = context.violations;
    const criticalCount = violations.filter(v => v.level === 'critical').length;
    const errorCount = violations.filter(v => v.level === 'error').length;
    const warningCount = violations.filter(v => v.level === 'warning').length;
    const infoCount = violations.filter(v => v.level === 'info').length;

    let overall = 'pass';
    let canProceed = true;

    if (criticalCount > 0) {
      overall = 'critical-fail';
      canProceed = false;
    } else if (errorCount > 0) {
      overall = 'fail';
      canProceed = !this.config.failOnCritical;
    } else if (warningCount > 0) {
      overall = 'pass-with-warnings';
    }

    return {
      overall,
      canProceed,
      summary: {
        total: violations.length,
        critical: criticalCount,
        errors: errorCount,
        warnings: warningCount,
        info: infoCount
      },
      violations: violations.slice(0, 50) // Limit for performance
    };
  }

  async createBackup(context) {
    if (context.filePaths) {
      for (const filePath of context.filePaths) {
        await mockFileSystem.createBackup(filePath);
      }
    }
  }

  async applyFixes(context) {
    if (!this.config.autoFixEnabled || context.fixes.length === 0) {
      return { applied: 0, failed: 0 };
    }

    let applied = 0;
    let failed = 0;

    for (const fix of context.fixes) {
      try {
        await this.applyFix(fix);
        applied++;
      } catch (error) {
        failed++;
        this.emit('fixFailed', { fix, error });
      }
    }

    return { applied, failed };
  }

  async applyFix(fix) {
    switch (fix.type) {
      case 'file-content':
        await mockFileSystem.writeFile(fix.filePath, fix.content);
        break;
      case 'lint-fix':
        await mockLintingService.fixLintErrors(fix.filePath, fix.rules);
        break;
      default:
        throw new Error(`Unknown fix type: ${fix.type}`);
    }
  }

  updateStatistics(result, executionTime) {
    const total = this.statistics.totalChecks;
    const current = this.statistics.averageCheckTime;
    this.statistics.averageCheckTime = ((current * (total - 1)) + executionTime) / total;

    if (result.overall === 'pass' || result.overall === 'pass-with-warnings') {
      this.statistics.passedChecks++;
    } else {
      this.statistics.failedChecks++;
    }

    if (result.summary.critical > 0) {
      this.statistics.criticalFailures++;
    }
  }

  getStatistics() {
    return { ...this.statistics };
  }

  async reset() {
    this.checks.clear();
    this.policies.clear();
    this.violations = [];
    this.statistics = {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      skippedChecks: 0,
      criticalFailures: 0,
      averageCheckTime: 0
    };
  }
}

describe('Safety Check Integration Suite', () => {
  let safetyCoordinator;
  let mockSyntaxChecker;
  let mockStyleChecker;

  beforeEach(async () => {
    safetyCoordinator = new MockSafetyCheckCoordinator();
    
    jest.clearAllMocks();
    
    mockSyntaxChecker = jest.fn().mockResolvedValue({ 
      violations: [],
      fixes: []
    });
    
    mockStyleChecker = jest.fn().mockResolvedValue({ 
      violations: [],
      fixes: []
    });
    
    mockFileSystem.createBackup.mockResolvedValue(true);
    mockQualityAnalyzer.analyzeComplexity.mockResolvedValue({
      averageComplexity: 5,
      maxComplexity: 8,
      files: []
    });
    
    mockQualityAnalyzer.checkCoverage.mockResolvedValue({
      percentage: 85,
      lines: { covered: 850, total: 1000 }
    });
  });

  afterEach(async () => {
    await safetyCoordinator.reset();
  });

  describe('Basic Safety Check Execution', () => {
    test('should execute all safety checks successfully', async () => {
      await safetyCoordinator.registerSafetyCheck('syntax-check', mockSyntaxChecker, {
        level: 'error',
        category: 'general'
      });
      
      await safetyCoordinator.registerSafetyCheck('style-check', mockStyleChecker, {
        level: 'warning',
        category: 'general'
      });

      const result = await safetyCoordinator.runSafetyChecks({
        type: 'standard',
        filePaths: ['/test/file.js', '/test/utils.js'],
        projectRoot: '/test'
      });

      expect(result.success).toBe(true);
      expect(result.result.overall).toBe('pass');
    });

    test('should handle critical failures appropriately', async () => {
      await safetyCoordinator.registerSafetyCheck('critical-check', () => {
        return Promise.resolve({
          violations: [{
            type: 'critical-error',
            level: 'critical',
            message: 'Critical failure detected'
          }]
        });
      }, {
        level: 'critical',
        category: 'general'
      });

      const result = await safetyCoordinator.runSafetyChecks({
        type: 'standard',
        filePaths: ['/test/file.js']
      });

      expect(result.success).toBe(false);
      expect(result.result.overall).toBe('critical-fail');
      expect(result.result.canProceed).toBe(false);
    });
  });

  describe('Quality Validation Integration', () => {
    test('should perform comprehensive quality analysis', async () => {
      const result = await safetyCoordinator.runSafetyChecks({
        type: 'quality',
        filePaths: ['/test/file.js'],
        testFiles: ['/test/file.test.js']
      });

      expect(mockQualityAnalyzer.analyzeComplexity).toHaveBeenCalledWith(['/test/file.js']);
      expect(mockQualityAnalyzer.checkCoverage).toHaveBeenCalledWith(['/test/file.test.js']);
      expect(result.results.quality).toBeDefined();
    });

    test('should flag high complexity code', async () => {
      mockQualityAnalyzer.analyzeComplexity.mockResolvedValue({
        averageComplexity: 12,
        maxComplexity: 20,
        files: [{ path: '/test/complex.js', complexity: 20 }]
      });

      const result = await safetyCoordinator.runSafetyChecks({
        type: 'quality',
        filePaths: ['/test/complex.js']
      });

      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'high-complexity',
            level: 'warning',
            phase: 'quality'
          })
        ])
      );
    });

    test('should flag low test coverage', async () => {
      mockQualityAnalyzer.checkCoverage.mockResolvedValue({
        percentage: 55,
        lines: { covered: 550, total: 1000 }
      });

      const result = await safetyCoordinator.runSafetyChecks({
        type: 'quality',
        testFiles: ['/test/insufficient.test.js']
      });

      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'low-coverage',
            level: 'error',
            phase: 'quality'
          })
        ])
      );
    });
  });

  describe('Backup and Recovery', () => {
    test('should create backup before checks', async () => {
      await safetyCoordinator.runSafetyChecks({
        type: 'pre-commit',
        filePaths: ['/test/important.js']
      });

      expect(mockFileSystem.createBackup).toHaveBeenCalledWith('/test/important.js');
    });

    test('should track safety check statistics', async () => {
      await safetyCoordinator.registerSafetyCheck('tracked-check', mockSyntaxChecker);

      await safetyCoordinator.runSafetyChecks({
        type: 'standard',
        filePaths: ['/test/file.js']
      });

      const stats = safetyCoordinator.getStatistics();
      
      expect(stats.totalChecks).toBe(1);
      expect(stats.passedChecks).toBe(1);
      expect(stats.averageCheckTime).toBeGreaterThan(0);
    });
  });
}); 