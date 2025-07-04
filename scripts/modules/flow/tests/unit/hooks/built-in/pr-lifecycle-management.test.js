/**
 * @fileoverview PR Lifecycle Management Hook Tests
 * Tests for PR lifecycle management hook including creation,
 * monitoring, and automated management operations.
 * 
 * @author Claude (Task Master Flow Testing Phase 2.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock PRLifecycleManagementHook class
class MockPRLifecycleManagementHook extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      autoCreatePR: options.autoCreatePR !== false,
      autoAssignReviewers: options.autoAssignReviewers !== false,
      autoAddLabels: options.autoAddLabels !== false,
      monitorStatus: options.monitorStatus !== false,
      autoMerge: options.autoMerge || false,
      requireApprovals: options.requireApprovals || 1,
      ...options
    };
    this.activePRs = new Map();
    this.statistics = {
      totalPRs: 0,
      createdPRs: 0,
      mergedPRs: 0,
      closedPRs: 0,
      failedPRs: 0
    };
    this.isActive = false;
  }

  async activate() {
    this.isActive = true;
    this.emit('hookActivated');
    return true;
  }

  async deactivate() {
    this.isActive = false;
    this.emit('hookDeactivated');
    return true;
  }

  async execute(context = {}) {
    if (!this.isActive) {
      throw new Error('Hook not active');
    }

    const action = context.action || 'create';
    
    switch (action) {
      case 'create':
        return await this.createPR(context);
      case 'update':
        return await this.updatePR(context);
      case 'monitor':
        return await this.monitorPR(context);
      case 'merge':
        return await this.mergePR(context);
      case 'close':
        return await this.closePR(context);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async createPR(context) {
    this.statistics.totalPRs++;

    try {
      if (!context.branch || !context.title) {
        throw new Error('Branch and title are required for PR creation');
      }

      // Use counter instead of timestamp for unique IDs in concurrent operations
      const prId = `pr-${this.statistics.totalPRs}-${Date.now()}`;
      
      const pr = {
        id: prId,
        number: Math.floor(Math.random() * 1000) + 1,
        title: context.title,
        description: context.description || '',
        branch: context.branch,
        baseBranch: context.baseBranch || 'main',
        author: context.author || 'system',
        status: 'open',
        state: 'draft',
        reviewers: [],
        labels: [],
        approvals: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Auto-assign reviewers if enabled
      if (this.config.autoAssignReviewers && context.reviewers) {
        pr.reviewers = [...context.reviewers];
        await this.assignReviewers(pr, context.reviewers);
      }

      // Auto-add labels if enabled
      if (this.config.autoAddLabels && context.labels) {
        pr.labels = [...context.labels];
        await this.addLabels(pr, context.labels);
      }

      this.activePRs.set(pr.id, pr);
      this.statistics.createdPRs++;

      this.emit('prCreated', {
        prId: pr.id,
        prNumber: pr.number,
        title: pr.title,
        branch: pr.branch
      });

      return {
        success: true,
        pr,
        message: `PR #${pr.number} created successfully`
      };
    } catch (error) {
      this.statistics.failedPRs++;
      this.emit('prCreationFailed', {
        error: error.message,
        context
      });
      throw error;
    }
  }

  async updatePR(context) {
    if (!context.prId) {
      throw new Error('PR ID is required for updates');
    }

    const pr = this.activePRs.get(context.prId);
    if (!pr) {
      throw new Error(`PR ${context.prId} not found`);
    }

    const updates = {};
    
    if (context.title) {
      pr.title = context.title;
      updates.title = context.title;
    }

    if (context.description) {
      pr.description = context.description;
      updates.description = context.description;
    }

    if (context.state) {
      pr.state = context.state;
      updates.state = context.state;
    }

    if (context.addReviewers) {
      pr.reviewers.push(...context.addReviewers);
      updates.addedReviewers = context.addReviewers;
    }

    if (context.addLabels) {
      pr.labels.push(...context.addLabels);
      updates.addedLabels = context.addLabels;
    }

    pr.updatedAt = new Date();

    this.emit('prUpdated', {
      prId: pr.id,
      prNumber: pr.number,
      updates
    });

    return {
      success: true,
      pr,
      updates,
      message: `PR #${pr.number} updated successfully`
    };
  }

  async monitorPR(context) {
    if (!context.prId) {
      throw new Error('PR ID is required for monitoring');
    }

    const pr = this.activePRs.get(context.prId);
    if (!pr) {
      throw new Error(`PR ${context.prId} not found`);
    }

    // Mock monitoring checks
    const monitoringResult = {
      prId: pr.id,
      prNumber: pr.number,
      status: pr.status,
      state: pr.state,
      checks: {
        ciPassed: Math.random() > 0.2, // 80% pass rate
        reviewsCompleted: pr.approvals >= this.config.requireApprovals,
        conflictsResolved: Math.random() > 0.1, // 90% no conflicts
        branchUpToDate: Math.random() > 0.3 // 70% up to date
      },
      recommendations: [],
      monitoredAt: new Date()
    };

    // Generate recommendations based on checks
    if (!monitoringResult.checks.ciPassed) {
      monitoringResult.recommendations.push('Fix failing CI checks');
    }

    if (!monitoringResult.checks.reviewsCompleted) {
      monitoringResult.recommendations.push(`Need ${this.config.requireApprovals - pr.approvals} more approvals`);
    }

    if (!monitoringResult.checks.conflictsResolved) {
      monitoringResult.recommendations.push('Resolve merge conflicts');
    }

    if (!monitoringResult.checks.branchUpToDate) {
      monitoringResult.recommendations.push('Update branch with latest changes');
    }

    // Check if ready for auto-merge
    const readyForMerge = Object.values(monitoringResult.checks).every(check => check);
    if (readyForMerge && this.config.autoMerge && pr.state === 'ready') {
      monitoringResult.autoMergeTriggered = true;
      setTimeout(() => this.mergePR({ prId: pr.id }), 1000); // Delay for realism
    }

    this.emit('prMonitored', monitoringResult);

    return {
      success: true,
      monitoring: monitoringResult,
      message: `PR #${pr.number} monitoring completed`
    };
  }

  async mergePR(context) {
    if (!context.prId) {
      throw new Error('PR ID is required for merging');
    }

    const pr = this.activePRs.get(context.prId);
    if (!pr) {
      throw new Error(`PR ${context.prId} not found`);
    }

    if (pr.status === 'merged') {
      throw new Error(`PR #${pr.number} is already merged`);
    }

    // Check merge requirements
    if (pr.approvals < this.config.requireApprovals) {
      throw new Error(`PR #${pr.number} needs ${this.config.requireApprovals - pr.approvals} more approvals`);
    }

    pr.status = 'merged';
    pr.mergedAt = new Date();
    pr.updatedAt = new Date();

    this.statistics.mergedPRs++;

    this.emit('prMerged', {
      prId: pr.id,
      prNumber: pr.number,
      branch: pr.branch,
      mergedAt: pr.mergedAt
    });

    return {
      success: true,
      pr,
      message: `PR #${pr.number} merged successfully`
    };
  }

  async closePR(context) {
    if (!context.prId) {
      throw new Error('PR ID is required for closing');
    }

    const pr = this.activePRs.get(context.prId);
    if (!pr) {
      throw new Error(`PR ${context.prId} not found`);
    }

    if (pr.status === 'closed' || pr.status === 'merged') {
      throw new Error(`PR #${pr.number} is already ${pr.status}`);
    }

    pr.status = 'closed';
    pr.closedAt = new Date();
    pr.updatedAt = new Date();
    pr.closeReason = context.reason || 'Manual close';

    this.statistics.closedPRs++;

    this.emit('prClosed', {
      prId: pr.id,
      prNumber: pr.number,
      reason: pr.closeReason,
      closedAt: pr.closedAt
    });

    return {
      success: true,
      pr,
      message: `PR #${pr.number} closed successfully`
    };
  }

  async assignReviewers(pr, reviewers) {
    // Mock reviewer assignment
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.emit('reviewersAssigned', {
      prId: pr.id,
      prNumber: pr.number,
      reviewers
    });
  }

  async addLabels(pr, labels) {
    // Mock label addition
    await new Promise(resolve => setTimeout(resolve, 30));
    
    this.emit('labelsAdded', {
      prId: pr.id,
      prNumber: pr.number,
      labels
    });
  }

  // Utility methods
  getPR(prId) {
    return this.activePRs.get(prId);
  }

  listPRs(filter = {}) {
    const prs = Array.from(this.activePRs.values());
    
    if (filter.status) {
      return prs.filter(pr => pr.status === filter.status);
    }
    
    if (filter.state) {
      return prs.filter(pr => pr.state === filter.state);
    }
    
    if (filter.author) {
      return prs.filter(pr => pr.author === filter.author);
    }
    
    return prs;
  }

  getStatistics() {
    const successfulOperations = this.statistics.createdPRs;
    const totalOperations = this.statistics.totalPRs;
    
    return {
      ...this.statistics,
      activePRs: this.activePRs.size,
      successRate: totalOperations > 0 
        ? (successfulOperations / totalOperations) * 100 
        : 0,
      mergeRate: this.statistics.createdPRs > 0 
        ? (this.statistics.mergedPRs / this.statistics.createdPRs) * 100 
        : 0,
      isActive: this.isActive
    };
  }

  async cleanup() {
    this.activePRs.clear();
    this.statistics = {
      totalPRs: 0,
      createdPRs: 0,
      mergedPRs: 0,
      closedPRs: 0,
      failedPRs: 0
    };
    this.emit('hookCleanedUp');
  }
}

describe('PR Lifecycle Management Hook', () => {
  let prHook;

  beforeEach(async () => {
    prHook = new MockPRLifecycleManagementHook();
    await prHook.activate();
  });

  afterEach(async () => {
    if (prHook.isActive) {
      await prHook.deactivate();
    }
    await prHook.cleanup();
  });

  describe('Hook Activation', () => {
    test('should activate successfully', async () => {
      const newHook = new MockPRLifecycleManagementHook();
      await newHook.activate();
      
      expect(newHook.isActive).toBe(true);
      
      await newHook.deactivate();
    });

    test('should emit activation events', async () => {
      const activatedSpy = jest.fn();
      const deactivatedSpy = jest.fn();
      
      const newHook = new MockPRLifecycleManagementHook();
      newHook.on('hookActivated', activatedSpy);
      newHook.on('hookDeactivated', deactivatedSpy);
      
      await newHook.activate();
      await newHook.deactivate();
      
      expect(activatedSpy).toHaveBeenCalled();
      expect(deactivatedSpy).toHaveBeenCalled();
    });
  });

  describe('PR Creation', () => {
    test('should create PR successfully', async () => {
      const context = {
        action: 'create',
        branch: 'feature/new-feature',
        title: 'Add new feature',
        description: 'This PR adds a new feature',
        author: 'developer'
      };
      
      const result = await prHook.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.pr.title).toBe('Add new feature');
      expect(result.pr.branch).toBe('feature/new-feature');
      expect(result.pr.status).toBe('open');
      expect(prHook.activePRs.size).toBe(1);
    });

    test('should auto-assign reviewers when enabled', async () => {
      const eventSpy = jest.fn();
      prHook.on('reviewersAssigned', eventSpy);
      
      const context = {
        action: 'create',
        branch: 'feature/test',
        title: 'Test PR',
        reviewers: ['reviewer1', 'reviewer2']
      };
      
      const result = await prHook.execute(context);
      
      expect(result.pr.reviewers).toEqual(['reviewer1', 'reviewer2']);
      expect(eventSpy).toHaveBeenCalledWith({
        prId: result.pr.id,
        prNumber: result.pr.number,
        reviewers: ['reviewer1', 'reviewer2']
      });
    });

    test('should auto-add labels when enabled', async () => {
      const eventSpy = jest.fn();
      prHook.on('labelsAdded', eventSpy);
      
      const context = {
        action: 'create',
        branch: 'feature/test',
        title: 'Test PR',
        labels: ['feature', 'high-priority']
      };
      
      const result = await prHook.execute(context);
      
      expect(result.pr.labels).toEqual(['feature', 'high-priority']);
      expect(eventSpy).toHaveBeenCalledWith({
        prId: result.pr.id,
        prNumber: result.pr.number,
        labels: ['feature', 'high-priority']
      });
    });

    test('should emit prCreated event', async () => {
      const eventSpy = jest.fn();
      prHook.on('prCreated', eventSpy);
      
      const context = {
        action: 'create',
        branch: 'feature/event-test',
        title: 'Event Test PR'
      };
      
      const result = await prHook.execute(context);
      
      expect(eventSpy).toHaveBeenCalledWith({
        prId: result.pr.id,
        prNumber: result.pr.number,
        title: 'Event Test PR',
        branch: 'feature/event-test'
      });
    });

    test('should reject creation without required fields', async () => {
      const context = { action: 'create' };
      
      await expect(prHook.execute(context)).rejects.toThrow('Branch and title are required for PR creation');
    });
  });

  describe('PR Updates', () => {
    let prId;

    beforeEach(async () => {
      const createResult = await prHook.execute({
        action: 'create',
        branch: 'feature/update-test',
        title: 'Update Test PR'
      });
      prId = createResult.pr.id;
    });

    test('should update PR successfully', async () => {
      const context = {
        action: 'update',
        prId,
        title: 'Updated PR Title',
        description: 'Updated description',
        state: 'ready'
      };
      
      const result = await prHook.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.pr.title).toBe('Updated PR Title');
      expect(result.pr.description).toBe('Updated description');
      expect(result.pr.state).toBe('ready');
    });

    test('should add reviewers and labels', async () => {
      const context = {
        action: 'update',
        prId,
        addReviewers: ['new-reviewer'],
        addLabels: ['bug-fix']
      };
      
      const result = await prHook.execute(context);
      
      expect(result.pr.reviewers).toContain('new-reviewer');
      expect(result.pr.labels).toContain('bug-fix');
      expect(result.updates.addedReviewers).toEqual(['new-reviewer']);
      expect(result.updates.addedLabels).toEqual(['bug-fix']);
    });

    test('should emit prUpdated event', async () => {
      const eventSpy = jest.fn();
      prHook.on('prUpdated', eventSpy);
      
      const context = {
        action: 'update',
        prId,
        title: 'Event Test Update'
      };
      
      await prHook.execute(context);
      
      expect(eventSpy).toHaveBeenCalledWith({
        prId,
        prNumber: expect.any(Number),
        updates: { title: 'Event Test Update' }
      });
    });

    test('should reject update for non-existent PR', async () => {
      const context = {
        action: 'update',
        prId: 'non-existent-pr'
      };
      
      await expect(prHook.execute(context)).rejects.toThrow('PR non-existent-pr not found');
    });
  });

  describe('PR Monitoring', () => {
    let prId;

    beforeEach(async () => {
      const createResult = await prHook.execute({
        action: 'create',
        branch: 'feature/monitor-test',
        title: 'Monitor Test PR'
      });
      prId = createResult.pr.id;
    });

    test('should monitor PR status and checks', async () => {
      const context = {
        action: 'monitor',
        prId
      };
      
      const result = await prHook.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.monitoring.prId).toBe(prId);
      expect(result.monitoring.checks).toHaveProperty('ciPassed');
      expect(result.monitoring.checks).toHaveProperty('reviewsCompleted');
      expect(result.monitoring.checks).toHaveProperty('conflictsResolved');
      expect(result.monitoring.checks).toHaveProperty('branchUpToDate');
      expect(result.monitoring.recommendations).toBeInstanceOf(Array);
    });

    test('should emit prMonitored event', async () => {
      const eventSpy = jest.fn();
      prHook.on('prMonitored', eventSpy);
      
      const context = {
        action: 'monitor',
        prId
      };
      
      await prHook.execute(context);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prId,
          checks: expect.any(Object),
          recommendations: expect.any(Array)
        })
      );
    });

    test('should generate appropriate recommendations', async () => {
      // This test relies on the random nature of the mock checks
      // In a real implementation, we would mock specific scenarios
      const context = {
        action: 'monitor',
        prId
      };
      
      const result = await prHook.execute(context);
      
      expect(result.monitoring.recommendations).toBeInstanceOf(Array);
      // Recommendations should be strings
      result.monitoring.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
      });
    });
  });

  describe('PR Merging', () => {
    let prId;

    beforeEach(async () => {
      const createResult = await prHook.execute({
        action: 'create',
        branch: 'feature/merge-test',
        title: 'Merge Test PR'
      });
      prId = createResult.pr.id;
      
      // Set up PR for merging
      const pr = prHook.getPR(prId);
      pr.approvals = prHook.config.requireApprovals;
    });

    test('should merge PR successfully', async () => {
      const context = {
        action: 'merge',
        prId
      };
      
      const result = await prHook.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.pr.status).toBe('merged');
      expect(result.pr.mergedAt).toBeInstanceOf(Date);
    });

    test('should emit prMerged event', async () => {
      const eventSpy = jest.fn();
      prHook.on('prMerged', eventSpy);
      
      const context = {
        action: 'merge',
        prId
      };
      
      await prHook.execute(context);
      
      expect(eventSpy).toHaveBeenCalledWith({
        prId,
        prNumber: expect.any(Number),
        branch: 'feature/merge-test',
        mergedAt: expect.any(Date)
      });
    });

    test('should reject merge without sufficient approvals', async () => {
      const pr = prHook.getPR(prId);
      pr.approvals = 0; // Reset approvals
      
      const context = {
        action: 'merge',
        prId
      };
      
      await expect(prHook.execute(context)).rejects.toThrow(/needs \d+ more approvals/);
    });

    test('should reject merge of already merged PR', async () => {
      // First merge
      await prHook.execute({ action: 'merge', prId });
      
      // Try to merge again
      await expect(prHook.execute({ action: 'merge', prId })).rejects.toThrow('is already merged');
    });
  });

  describe('PR Closing', () => {
    let prId;

    beforeEach(async () => {
      const createResult = await prHook.execute({
        action: 'create',
        branch: 'feature/close-test',
        title: 'Close Test PR'
      });
      prId = createResult.pr.id;
    });

    test('should close PR successfully', async () => {
      const context = {
        action: 'close',
        prId,
        reason: 'No longer needed'
      };
      
      const result = await prHook.execute(context);
      
      expect(result.success).toBe(true);
      expect(result.pr.status).toBe('closed');
      expect(result.pr.closedAt).toBeInstanceOf(Date);
      expect(result.pr.closeReason).toBe('No longer needed');
    });

    test('should emit prClosed event', async () => {
      const eventSpy = jest.fn();
      prHook.on('prClosed', eventSpy);
      
      const context = {
        action: 'close',
        prId,
        reason: 'Test close'
      };
      
      await prHook.execute(context);
      
      expect(eventSpy).toHaveBeenCalledWith({
        prId,
        prNumber: expect.any(Number),
        reason: 'Test close',
        closedAt: expect.any(Date)
      });
    });

    test('should reject closing already closed PR', async () => {
      // First close
      await prHook.execute({ action: 'close', prId });
      
      // Try to close again
      await expect(prHook.execute({ action: 'close', prId })).rejects.toThrow('is already closed');
    });
  });

  describe('Utility Methods', () => {
    let prId;

    beforeEach(async () => {
      const createResult = await prHook.execute({
        action: 'create',
        branch: 'feature/utility-test',
        title: 'Utility Test PR',
        author: 'test-author'
      });
      prId = createResult.pr.id;
    });

    test('should get PR by ID', () => {
      const pr = prHook.getPR(prId);
      
      expect(pr).toBeDefined();
      expect(pr.id).toBe(prId);
      expect(pr.title).toBe('Utility Test PR');
    });

    test('should list all PRs', () => {
      const prs = prHook.listPRs();
      
      expect(prs).toHaveLength(1);
      expect(prs[0].id).toBe(prId);
    });

    test('should filter PRs by status', async () => {
      // Close the PR
      await prHook.execute({ action: 'close', prId });
      
      const closedPRs = prHook.listPRs({ status: 'closed' });
      const openPRs = prHook.listPRs({ status: 'open' });
      
      expect(closedPRs).toHaveLength(1);
      expect(openPRs).toHaveLength(0);
    });

    test('should filter PRs by author', () => {
      const authorPRs = prHook.listPRs({ author: 'test-author' });
      const otherPRs = prHook.listPRs({ author: 'other-author' });
      
      expect(authorPRs).toHaveLength(1);
      expect(otherPRs).toHaveLength(0);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track PR statistics', async () => {
      // Create multiple PRs with different outcomes
      const pr1 = await prHook.execute({
        action: 'create',
        branch: 'feature/stats-1',
        title: 'Stats PR 1'
      });
      
      const pr2 = await prHook.execute({
        action: 'create',
        branch: 'feature/stats-2',
        title: 'Stats PR 2'
      });
      
      // Set up for merge
      const pr1Obj = prHook.getPR(pr1.pr.id);
      pr1Obj.approvals = prHook.config.requireApprovals;
      
      // Merge first PR and close second PR (different outcomes)
      await prHook.execute({ action: 'merge', prId: pr1.pr.id });
      await prHook.execute({ action: 'close', prId: pr2.pr.id });
      
      const stats = prHook.getStatistics();
      
      expect(stats.totalPRs).toBe(2);
      expect(stats.createdPRs).toBe(2);
      expect(stats.mergedPRs).toBe(1);
      expect(stats.closedPRs).toBe(1);
      expect(stats.successRate).toBe(100);
      expect(stats.mergeRate).toBe(50);
    });

    test('should track failed PR creation', async () => {
      try {
        await prHook.execute({ action: 'create' }); // Missing required fields
      } catch (error) {
        // Expected to fail
      }
      
      const stats = prHook.getStatistics();
      
      expect(stats.totalPRs).toBe(1);
      expect(stats.failedPRs).toBe(1);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should reject execution when hook not active', async () => {
      await prHook.deactivate();
      
      await expect(prHook.execute({ action: 'create' })).rejects.toThrow('Hook not active');
    });

    test('should reject unknown actions', async () => {
      await expect(prHook.execute({ action: 'unknown' })).rejects.toThrow('Unknown action: unknown');
    });

    test('should emit prCreationFailed event on creation errors', async () => {
      const eventSpy = jest.fn();
      prHook.on('prCreationFailed', eventSpy);
      
      try {
        await prHook.execute({ action: 'create' }); // Missing required fields
      } catch (error) {
        // Expected to fail
      }
      
      expect(eventSpy).toHaveBeenCalledWith({
        error: 'Branch and title are required for PR creation',
        context: { action: 'create' }
      });
    });
  });

  describe('Auto-merge Functionality', () => {
    test('should trigger auto-merge when conditions are met', async () => {
      const autoMergeHook = new MockPRLifecycleManagementHook({ 
        autoMerge: true,
        requireApprovals: 1 
      });
      await autoMergeHook.activate();
      
      const createResult = await autoMergeHook.execute({
        action: 'create',
        branch: 'feature/auto-merge-test',
        title: 'Auto Merge Test PR'
      });
      
      const pr = autoMergeHook.getPR(createResult.pr.id);
      pr.state = 'ready';
      pr.approvals = 1;
      
      // Mock successful monitoring that triggers auto-merge
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.9); // All checks pass
      
      const monitorResult = await autoMergeHook.execute({
        action: 'monitor',
        prId: createResult.pr.id
      });
      
      expect(monitorResult.monitoring.autoMergeTriggered).toBe(true);
      
      Math.random = originalRandom;
      await autoMergeHook.deactivate();
    });
  });

  describe('Performance and Cleanup', () => {
    test('should handle multiple concurrent PR operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        operations.push(
          prHook.execute({
            action: 'create',
            branch: `feature/concurrent-${i}`,
            title: `Concurrent PR ${i}`
          })
        );
      }
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r.success)).toBe(true);
      expect(prHook.activePRs.size).toBe(10);
    });

    test('should cleanup hook state', async () => {
      await prHook.execute({
        action: 'create',
        branch: 'feature/cleanup-test',
        title: 'Cleanup Test PR'
      });
      
      expect(prHook.activePRs.size).toBe(1);
      
      await prHook.cleanup();
      
      expect(prHook.activePRs.size).toBe(0);
      expect(prHook.getStatistics().totalPRs).toBe(0);
    });

    test('should emit hookCleanedUp event', async () => {
      const eventSpy = jest.fn();
      prHook.on('hookCleanedUp', eventSpy);
      
      await prHook.cleanup();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });
}); 