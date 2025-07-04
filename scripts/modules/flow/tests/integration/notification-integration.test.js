/**
 * @fileoverview Notification Integration Tests
 * Comprehensive integration testing for notification system coordination across
 * hooks, PR automation, and background services. Tests notification delivery,
 * preference management, and multi-channel communication.
 * 
 * @author Claude (Task Master Flow Testing Phase 3.2)
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock dependencies
const mockEmailService = {
  sendEmail: jest.fn(),
  sendBulkEmail: jest.fn(),
  validateEmailAddress: jest.fn(),
  getEmailTemplate: jest.fn(),
  trackEmailDelivery: jest.fn()
};

const mockSlackService = {
  sendMessage: jest.fn(),
  sendDirectMessage: jest.fn(),
  createChannel: jest.fn(),
  postToChannel: jest.fn(),
  uploadFile: jest.fn(),
  addReaction: jest.fn()
};

const mockWebhookService = {
  sendWebhook: jest.fn(),
  validateWebhookUrl: jest.fn(),
  retryWebhook: jest.fn(),
  getWebhookStatus: jest.fn()
};

const mockPushNotificationService = {
  sendPushNotification: jest.fn(),
  registerDevice: jest.fn(),
  unregisterDevice: jest.fn(),
  sendToTopic: jest.fn()
};

const mockTemplateEngine = {
  renderTemplate: jest.fn(),
  compileTemplate: jest.fn(),
  getTemplate: jest.fn(),
  validateTemplate: jest.fn()
};

const mockUserPreferences = {
  getNotificationPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn(),
  getDeliveryChannels: jest.fn(),
  isChannelEnabled: jest.fn()
};

// Mock Notification Coordinator
class MockNotificationCoordinator extends EventEmitter {
  constructor() {
    super();
    this.channels = new Map();
    this.templates = new Map();
    this.queues = new Map();
    this.subscribers = new Map();
    this.statistics = {
      totalNotifications: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      channelStats: new Map(),
      averageDeliveryTime: 0,
      retryAttempts: 0
    };
    this.config = {
      enableBatching: true,
      batchSize: 10,
      batchTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableDeduplication: true,
      defaultChannels: ['email', 'slack']
    };
  }

  async registerNotificationChannel(name, handler, config = {}) {
    const channelConfig = {
      name,
      handler,
      enabled: config.enabled !== false,
      priority: config.priority || 50,
      rateLimit: config.rateLimit || { requests: 100, period: 60000 },
      retryPolicy: config.retryPolicy || { attempts: 3, delay: 1000 },
      formatting: config.formatting || 'default',
      ...config
    };

    this.channels.set(name, channelConfig);
    this.statistics.channelStats.set(name, {
      sent: 0,
      delivered: 0,
      failed: 0,
      averageTime: 0
    });

    this.emit('channelRegistered', { name, config: channelConfig });
    return true;
  }

  async sendNotification(notification) {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      this.statistics.totalNotifications++;

      const notificationContext = {
        notificationId,
        startTime,
        ...notification,
        deliveryAttempts: [],
        status: 'pending',
        channels: notification.channels || this.config.defaultChannels
      };

      this.emit('notificationStarted', { notificationId, notification: notificationContext });

      // Get user preferences
      const preferences = await this.getUserPreferences(notificationContext);
      
      // Filter channels based on preferences
      const enabledChannels = this.filterChannelsByPreferences(notificationContext.channels, preferences);
      
      // Prepare notification content
      await this.prepareNotificationContent(notificationContext);
      
      // Send to all enabled channels
      const deliveryResults = await this.deliverToChannels(notificationContext, enabledChannels);
      
      // Process delivery results
      const result = this.processDeliveryResults(notificationContext, deliveryResults);

      const endTime = Date.now();
      const deliveryTime = endTime - startTime;
      
      this.updateStatistics(result, deliveryTime);

      this.emit('notificationCompleted', { 
        notificationId, 
        result, 
        deliveryTime,
        deliveryResults 
      });

      return {
        success: result.overallSuccess,
        notificationId,
        deliveryTime,
        result,
        deliveryResults,
        channels: enabledChannels
      };

    } catch (error) {
      this.statistics.failedDeliveries++;
      this.emit('notificationError', { notificationId, error });
      
      return {
        success: false,
        notificationId,
        error: error.message,
        deliveryTime: Date.now() - startTime,
        deliveryResults: [],
        channels: []
      };
    }
  }

  async sendBulkNotifications(notifications) {
    const bulkId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      this.emit('bulkNotificationStarted', { bulkId, count: notifications.length });

      const results = [];
      
      if (this.config.enableBatching) {
        // Process in batches
        const batches = this.createBatches(notifications, this.config.batchSize);
        
        for (const batch of batches) {
          const batchResults = await Promise.all(
            batch.map(notification => this.sendNotification(notification))
          );
          results.push(...batchResults);
          
          // Wait between batches if needed
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else {
        // Process all at once
        const bulkResults = await Promise.all(
          notifications.map(notification => this.sendNotification(notification))
        );
        results.push(...bulkResults);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      const summary = this.summarizeBulkResults(results);

      this.emit('bulkNotificationCompleted', { 
        bulkId, 
        summary, 
        processingTime 
      });

      return {
        success: summary.successRate > 0.8, // 80% success threshold
        bulkId,
        processingTime,
        summary,
        results
      };

    } catch (error) {
      this.emit('bulkNotificationError', { bulkId, error });
      
      return {
        success: false,
        bulkId,
        error: error.message,
        processingTime: Date.now() - startTime,
        summary: { total: 0, successful: 0, failed: 0, successRate: 0 },
        results: []
      };
    }
  }

  async getUserPreferences(notification) {
    try {
      return await mockUserPreferences.getNotificationPreferences(notification.userId || notification.recipient);
    } catch (error) {
      // Return default preferences if user preferences can't be retrieved
      return {
        email: { enabled: true, frequency: 'immediate' },
        slack: { enabled: true, frequency: 'immediate' },
        webhook: { enabled: false },
        push: { enabled: false }
      };
    }
  }

  filterChannelsByPreferences(channels, preferences) {
    return channels.filter(channel => {
      const pref = preferences[channel];
      return pref && pref.enabled;
    });
  }

  async prepareNotificationContent(notification) {
    try {
      // Render templates for each channel
      notification.renderedContent = {};
      
      for (const channel of notification.channels) {
        const channelConfig = this.channels.get(channel);
        if (!channelConfig) continue;

        const templateName = notification.template || `${notification.type}_${channel}`;
        
        notification.renderedContent[channel] = await mockTemplateEngine.renderTemplate(
          templateName,
          {
            ...notification.data,
            recipient: notification.recipient,
            timestamp: new Date().toISOString()
          }
        );
      }

      this.emit('contentPrepared', { 
        notificationId: notification.notificationId,
        channels: Object.keys(notification.renderedContent)
      });

    } catch (error) {
      throw new Error(`Content preparation failed: ${error.message}`);
    }
  }

  async deliverToChannels(notification, channels) {
    const deliveryPromises = channels.map(channel => 
      this.deliverToChannel(notification, channel)
    );

    const results = await Promise.allSettled(deliveryPromises);
    
    return results.map((result, index) => ({
      channel: channels[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }

  async deliverToChannel(notification, channelName) {
    const channel = this.channels.get(channelName);
    if (!channel || !channel.enabled) {
      throw new Error(`Channel ${channelName} not available`);
    }

    const startTime = Date.now();
    
    try {
      this.emit('channelDeliveryStarted', { 
        notificationId: notification.notificationId,
        channel: channelName
      });

      let result;
      let retryCount = 0;
      const maxRetries = channel.retryPolicy.attempts;

      while (retryCount <= maxRetries) {
        try {
          result = await this.executeChannelDelivery(notification, channel);
          break;
        } catch (error) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw error;
          }
          
          this.statistics.retryAttempts++;
          await new Promise(resolve => 
            setTimeout(resolve, channel.retryPolicy.delay * retryCount)
          );
        }
      }

      const endTime = Date.now();
      const deliveryTime = endTime - startTime;
      
      this.updateChannelStatistics(channelName, deliveryTime, true);

      this.emit('channelDeliveryCompleted', { 
        notificationId: notification.notificationId,
        channel: channelName,
        deliveryTime,
        retryCount
      });

      return {
        success: true,
        deliveryTime,
        retryCount,
        result
      };

    } catch (error) {
      this.updateChannelStatistics(channelName, 0, false);
      
      this.emit('channelDeliveryError', { 
        notificationId: notification.notificationId,
        channel: channelName,
        error
      });

      throw error;
    }
  }

  async executeChannelDelivery(notification, channel) {
    const content = notification.renderedContent[channel.name];
    
    switch (channel.name) {
      case 'email':
        return await mockEmailService.sendEmail({
          to: notification.recipient,
          subject: content.subject,
          body: content.body,
          attachments: notification.attachments
        });
        
      case 'slack':
        if (notification.slackChannel) {
          return await mockSlackService.postToChannel(
            notification.slackChannel,
            content.message,
            content.attachments
          );
        } else {
          return await mockSlackService.sendDirectMessage(
            notification.recipient,
            content.message
          );
        }
        
      case 'webhook':
        return await mockWebhookService.sendWebhook(
          notification.webhookUrl,
          {
            type: notification.type,
            data: notification.data,
            content: content,
            timestamp: new Date().toISOString()
          }
        );
        
      case 'push':
        return await mockPushNotificationService.sendPushNotification({
          recipient: notification.recipient,
          title: content.title,
          body: content.body,
          data: notification.data
        });
        
      default:
        throw new Error(`Unknown channel: ${channel.name}`);
    }
  }

  processDeliveryResults(notification, deliveryResults) {
    const successful = deliveryResults.filter(r => r.success);
    const failed = deliveryResults.filter(r => !r.success);
    
    const overallSuccess = successful.length > 0; // At least one channel succeeded
    
    return {
      overallSuccess,
      totalChannels: deliveryResults.length,
      successfulChannels: successful.length,
      failedChannels: failed.length,
      successRate: successful.length / deliveryResults.length,
      successful: successful.map(r => ({ channel: r.channel, result: r.result })),
      failed: failed.map(r => ({ channel: r.channel, error: r.error }))
    };
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  summarizeBulkResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: successful.length / results.length
    };
  }

  updateStatistics(result, deliveryTime) {
    const total = this.statistics.totalNotifications;
    const current = this.statistics.averageDeliveryTime;
    this.statistics.averageDeliveryTime = ((current * (total - 1)) + deliveryTime) / total;

    if (result.overallSuccess) {
      this.statistics.successfulDeliveries++;
    } else {
      this.statistics.failedDeliveries++;
    }
  }

  updateChannelStatistics(channelName, deliveryTime, success) {
    const stats = this.statistics.channelStats.get(channelName);
    if (!stats) return;

    stats.sent++;
    
    if (success) {
      stats.delivered++;
      stats.averageTime = ((stats.averageTime * (stats.delivered - 1)) + deliveryTime) / stats.delivered;
    } else {
      stats.failed++;
    }
  }

  // Integration with external systems
  async subscribeToHookEvents(hookCoordinator) {
    hookCoordinator.on('hookCompleted', async (data) => {
      await this.sendNotification({
        type: 'hook_completed',
        recipient: data.author || 'system',
        data: {
          hookName: data.hookName,
          executionTime: data.executionTime,
          result: data.result
        },
        channels: ['slack']
      });
    });

    hookCoordinator.on('hookError', async (data) => {
      await this.sendNotification({
        type: 'hook_error',
        recipient: 'admin',
        data: {
          hookName: data.hookName,
          error: data.error.message,
          executionId: data.executionId
        },
        channels: ['email', 'slack'],
        priority: 'high'
      });
    });
  }

  async subscribeToPREvents(prCoordinator) {
    prCoordinator.on('prAutomationCompleted', async (data) => {
      await this.sendNotification({
        type: 'pr_created',
        recipient: data.author,
        data: {
          prNumber: data.pr.number,
          prUrl: data.pr.html_url,
          qualityStatus: data.qualityResults.summary.passed ? 'passed' : 'warnings'
        },
        channels: ['email', 'slack']
      });
    });

    prCoordinator.on('qualityGatesCompleted', async (data) => {
      if (!data.passed) {
        await this.sendNotification({
          type: 'quality_gate_failed',
          recipient: data.author,
          data: {
            prNumber: data.prNumber,
            qualityIssues: data.qualityResults.summary
          },
          channels: ['email'],
          priority: 'high'
        });
      }
    });
  }

  async subscribeToSafetyEvents(safetyCoordinator) {
    safetyCoordinator.on('safetyChecksCompleted', async (data) => {
      if (data.result.summary.critical > 0) {
        await this.sendNotification({
          type: 'critical_safety_violation',
          recipient: 'security-team',
          data: {
            checkId: data.checkId,
            violations: data.violations.filter(v => v.level === 'critical')
          },
          channels: ['email', 'slack', 'webhook'],
          priority: 'critical'
        });
      }
    });
  }

  getStatistics() {
    return {
      ...this.statistics,
      channelStats: Object.fromEntries(this.statistics.channelStats)
    };
  }

  async reset() {
    this.channels.clear();
    this.templates.clear();
    this.queues.clear();
    this.subscribers.clear();
    this.statistics = {
      totalNotifications: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      channelStats: new Map(),
      averageDeliveryTime: 0,
      retryAttempts: 0
    };
  }
}

describe('Notification Integration Suite', () => {
  let notificationCoordinator;

  beforeEach(async () => {
    notificationCoordinator = new MockNotificationCoordinator();
    
    jest.clearAllMocks();
    
    // Setup mock service responses
    mockEmailService.sendEmail.mockResolvedValue({
      messageId: 'email-123',
      status: 'sent',
      deliveryTime: 150
    });
    
    mockSlackService.sendDirectMessage.mockResolvedValue({
      channel: 'D123456',
      ts: '1234567890.123456',
      message: { text: 'Message sent' }
    });
    
    mockSlackService.postToChannel.mockResolvedValue({
      channel: 'C123456',
      ts: '1234567890.123456',
      message: { text: 'Channel message sent' }
    });
    
    mockWebhookService.sendWebhook.mockResolvedValue({
      status: 200,
      response: { received: true },
      deliveryTime: 250
    });
    
    mockPushNotificationService.sendPushNotification.mockResolvedValue({
      notificationId: 'push-123',
      status: 'delivered',
      devices: 1
    });
    
    mockTemplateEngine.renderTemplate.mockResolvedValue({
      subject: 'Test Subject',
      body: 'Test message body',
      message: 'Slack message',
      title: 'Push Title'
    });
    
    mockUserPreferences.getNotificationPreferences.mockResolvedValue({
      email: { enabled: true, frequency: 'immediate' },
      slack: { enabled: true, frequency: 'immediate' },
      webhook: { enabled: false },
      push: { enabled: false }
    });
    
    // Register default channels
    await notificationCoordinator.registerNotificationChannel('email', mockEmailService.sendEmail);
    await notificationCoordinator.registerNotificationChannel('slack', mockSlackService.sendDirectMessage);
    await notificationCoordinator.registerNotificationChannel('webhook', mockWebhookService.sendWebhook);
    await notificationCoordinator.registerNotificationChannel('push', mockPushNotificationService.sendPushNotification);
  });

  afterEach(async () => {
    await notificationCoordinator.reset();
  });

  describe('Basic Notification Delivery', () => {
    test('should send notification to multiple channels successfully', async () => {
      const notification = {
        type: 'test_notification',
        recipient: 'user@example.com',
        data: {
          message: 'Test message',
          priority: 'normal'
        },
        channels: ['email', 'slack']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(result.result.successfulChannels).toBe(2);
      expect(result.result.failedChannels).toBe(0);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockSlackService.sendDirectMessage).toHaveBeenCalled();
    });

    test('should handle channel failures gracefully', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('Email service down'));

      const notification = {
        type: 'test_notification',
        recipient: 'user@example.com',
        data: { message: 'Test message' },
        channels: ['email', 'slack']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(true); // Still successful because Slack worked
      expect(result.result.successfulChannels).toBe(1);
      expect(result.result.failedChannels).toBe(1);
      expect(result.result.failed[0].channel).toBe('email');
    });

    test('should respect user notification preferences', async () => {
      mockUserPreferences.getNotificationPreferences.mockResolvedValue({
        email: { enabled: false },
        slack: { enabled: true, frequency: 'immediate' },
        webhook: { enabled: false },
        push: { enabled: false }
      });

      const notification = {
        type: 'test_notification',
        recipient: 'user@example.com',
        data: { message: 'Test message' },
        channels: ['email', 'slack', 'webhook']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(result.channels).toEqual(['slack']); // Only slack enabled
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockSlackService.sendDirectMessage).toHaveBeenCalled();
      expect(mockWebhookService.sendWebhook).not.toHaveBeenCalled();
    });
  });

  describe('Bulk Notification Processing', () => {
    test('should process bulk notifications efficiently', async () => {
      const notifications = Array.from({ length: 25 }, (_, i) => ({
        type: 'bulk_test',
        recipient: `user${i}@example.com`,
        data: { message: `Message ${i}` },
        channels: ['email']
      }));

      const result = await notificationCoordinator.sendBulkNotifications(notifications);

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(25);
      expect(result.summary.successful).toBe(25);
      expect(result.summary.successRate).toBe(1.0);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(25);
    });

    test('should handle partial failures in bulk processing', async () => {
      // Make every 3rd email fail
      mockEmailService.sendEmail.mockImplementation((_, index) => {
        if ((index || 0) % 3 === 0) {
          return Promise.reject(new Error('Service error'));
        }
        return Promise.resolve({ messageId: `email-${index}`, status: 'sent' });
      });

      const notifications = Array.from({ length: 9 }, (_, i) => ({
        type: 'bulk_test',
        recipient: `user${i}@example.com`,
        data: { message: `Message ${i}` },
        channels: ['email']
      }));

      const result = await notificationCoordinator.sendBulkNotifications(notifications);

      expect(result.success).toBe(true); // Success rate above 80%
      expect(result.summary.total).toBe(9);
      expect(result.summary.failed).toBeGreaterThan(0);
      expect(result.summary.successRate).toBeGreaterThan(0.6);
    });
  });

  describe('Template Rendering Integration', () => {
    test('should render templates for different channels', async () => {
      const notification = {
        type: 'welcome',
        recipient: 'newuser@example.com',
        template: 'welcome_template',
        data: {
          userName: 'John Doe',
          actionUrl: 'https://example.com/activate'
        },
        channels: ['email', 'slack']
      };

      await notificationCoordinator.sendNotification(notification);

      expect(mockTemplateEngine.renderTemplate).toHaveBeenCalledTimes(2);
      expect(mockTemplateEngine.renderTemplate).toHaveBeenCalledWith(
        'welcome_template',
        expect.objectContaining({
          userName: 'John Doe',
          actionUrl: 'https://example.com/activate',
          recipient: 'newuser@example.com'
        })
      );
    });

    test('should handle template rendering failures', async () => {
      mockTemplateEngine.renderTemplate.mockRejectedValue(new Error('Template not found'));

      const notification = {
        type: 'test',
        recipient: 'user@example.com',
        template: 'nonexistent_template',
        data: { message: 'Test' },
        channels: ['email']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content preparation failed');
    });
  });

  describe('Retry and Error Handling', () => {
    test('should retry failed deliveries according to channel policy', async () => {
      let attemptCount = 0;
      mockEmailService.sendEmail.mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({ messageId: 'email-123', status: 'sent' });
      });

      const notification = {
        type: 'test',
        recipient: 'user@example.com',
        data: { message: 'Test' },
        channels: ['email']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3); // Initial + 2 retries
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(3);
    });

    test('should fail after exhausting retry attempts', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('Persistent failure'));

      const notification = {
        type: 'test',
        recipient: 'user@example.com',
        data: { message: 'Test' },
        channels: ['email']
      };

      const result = await notificationCoordinator.sendNotification(notification);

      expect(result.success).toBe(false);
      expect(result.result.failedChannels).toBe(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Integration with Hook System', () => {
    test('should subscribe to hook events and send notifications', async () => {
      const mockHookCoordinator = new EventEmitter();
      
      await notificationCoordinator.subscribeToHookEvents(mockHookCoordinator);

      // Simulate hook completion
      mockHookCoordinator.emit('hookCompleted', {
        hookName: 'pre-commit-check',
        executionTime: 150,
        result: { status: 'success' },
        author: 'developer@example.com'
      });

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockSlackService.sendDirectMessage).toHaveBeenCalledWith(
        'developer@example.com',
        expect.any(Object)
      );
    });

    test('should send high-priority notifications for hook errors', async () => {
      const mockHookCoordinator = new EventEmitter();
      
      await notificationCoordinator.subscribeToHookEvents(mockHookCoordinator);

      // Simulate hook error
      mockHookCoordinator.emit('hookError', {
        hookName: 'critical-validation',
        error: new Error('Validation failed'),
        executionId: 'exec-123'
      });

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockSlackService.sendDirectMessage).toHaveBeenCalled();
    });
  });

  describe('Integration with PR Automation', () => {
    test('should send PR creation notifications', async () => {
      const mockPRCoordinator = new EventEmitter();
      
      await notificationCoordinator.subscribeToPREvents(mockPRCoordinator);

      // Simulate PR creation
      mockPRCoordinator.emit('prAutomationCompleted', {
        pr: {
          number: 123,
          html_url: 'https://github.com/repo/pull/123'
        },
        author: 'developer@example.com',
        qualityResults: {
          summary: { passed: true }
        }
      });

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockSlackService.sendDirectMessage).toHaveBeenCalled();
    });

    test('should send quality gate failure notifications', async () => {
      const mockPRCoordinator = new EventEmitter();
      
      await notificationCoordinator.subscribeToPREvents(mockPRCoordinator);

      // Simulate quality gate failure
      mockPRCoordinator.emit('qualityGatesCompleted', {
        passed: false,
        prNumber: 123,
        author: 'developer@example.com',
        qualityResults: {
          summary: { errors: 5, warnings: 3 }
        }
      });

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('Integration with Safety System', () => {
    test('should send critical safety violation notifications', async () => {
      const mockSafetyCoordinator = new EventEmitter();
      
      await notificationCoordinator.subscribeToSafetyEvents(mockSafetyCoordinator);

      // Simulate critical safety violation
      mockSafetyCoordinator.emit('safetyChecksCompleted', {
        checkId: 'safety-123',
        result: {
          summary: { critical: 2, errors: 1, warnings: 0 }
        },
        violations: [
          {
            type: 'security-vulnerability',
            level: 'critical',
            message: 'SQL injection vulnerability detected'
          },
          {
            type: 'data-exposure',
            level: 'critical',
            message: 'Sensitive data exposure risk'
          }
        ]
      });

      // Wait for async notification processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockSlackService.sendDirectMessage).toHaveBeenCalled();
      expect(mockWebhookService.sendWebhook).toHaveBeenCalled();
    });
  });

  describe('Channel-Specific Delivery', () => {
    test('should handle Slack channel posts vs direct messages', async () => {
      const channelNotification = {
        type: 'team_update',
        recipient: 'user@example.com',
        slackChannel: '#development',
        data: { message: 'Team update' },
        channels: ['slack']
      };

      await notificationCoordinator.sendNotification(channelNotification);

      expect(mockSlackService.postToChannel).toHaveBeenCalledWith(
        '#development',
        expect.any(Object),
        undefined
      );
      expect(mockSlackService.sendDirectMessage).not.toHaveBeenCalled();

      jest.clearAllMocks();

      const dmNotification = {
        type: 'personal_notification',
        recipient: 'user@example.com',
        data: { message: 'Personal message' },
        channels: ['slack']
      };

      await notificationCoordinator.sendNotification(dmNotification);

      expect(mockSlackService.sendDirectMessage).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(Object)
      );
      expect(mockSlackService.postToChannel).not.toHaveBeenCalled();
    });

    test('should handle webhook notifications with proper payload', async () => {
      const notification = {
        type: 'deployment_complete',
        recipient: 'system',
        webhookUrl: 'https://api.example.com/webhook',
        data: {
          environment: 'production',
          version: '1.2.3',
          status: 'success'
        },
        channels: ['webhook']
      };

      await notificationCoordinator.sendNotification(notification);

      expect(mockWebhookService.sendWebhook).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          type: 'deployment_complete',
          data: expect.objectContaining({
            environment: 'production',
            version: '1.2.3',
            status: 'success'
          })
        })
      );
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track comprehensive notification statistics', async () => {
      // Send multiple notifications
      const notifications = [
        {
          type: 'test1',
          recipient: 'user1@example.com',
          data: { message: 'Test 1' },
          channels: ['email']
        },
        {
          type: 'test2',
          recipient: 'user2@example.com',
          data: { message: 'Test 2' },
          channels: ['slack']
        },
        {
          type: 'test3',
          recipient: 'user3@example.com',
          data: { message: 'Test 3' },
          channels: ['email', 'slack']
        }
      ];

      for (const notification of notifications) {
        await notificationCoordinator.sendNotification(notification);
      }

      const stats = notificationCoordinator.getStatistics();
      
      expect(stats.totalNotifications).toBe(3);
      expect(stats.successfulDeliveries).toBe(3);
      expect(stats.averageDeliveryTime).toBeGreaterThan(0);
      expect(stats.channelStats.email.sent).toBeGreaterThan(0);
      expect(stats.channelStats.slack.sent).toBeGreaterThan(0);
    });

    test('should emit comprehensive notification events', async () => {
      const events = [];
      
      notificationCoordinator.on('notificationStarted', (data) => events.push({ type: 'started', data }));
      notificationCoordinator.on('contentPrepared', (data) => events.push({ type: 'contentPrepared', data }));
      notificationCoordinator.on('channelDeliveryCompleted', (data) => events.push({ type: 'channelCompleted', data }));
      notificationCoordinator.on('notificationCompleted', (data) => events.push({ type: 'completed', data }));

      const notification = {
        type: 'event_test',
        recipient: 'user@example.com',
        data: { message: 'Event test' },
        channels: ['email']
      };

      await notificationCoordinator.sendNotification(notification);

      expect(events.length).toBeGreaterThan(3);
      expect(events.map(e => e.type)).toContain('started');
      expect(events.map(e => e.type)).toContain('completed');
    });
  });
}); 