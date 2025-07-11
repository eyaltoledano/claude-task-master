// UnifiedAgentService.js - Abstracts VibeKit for unified agent handling

import { VibeKitService } from './vibekit.service.js';

export class UnifiedAgentService {
  constructor(backend) {
    this.vibekit = new VibeKitService(backend);
    this.sessions = new Map();
  }

  async getAgents() {
    try {
      return await this.vibekit.getAvailableAgents();
    } catch (error) {
      console.error('Failed to get agents:', error);
      return [];
    }
  }

  async createSession(agentType, taskId) {
    try {
      const session = await this.vibekit.createAgentSession(agentType, taskId);
      this.sessions.set(session.id, session);
      return session;
    } catch (error) {
      console.error(`Failed to create session for ${agentType}:`, error);
      throw error;
    }
  }

  async watchSession(sessionId) {
    try {
      return await this.vibekit.watchSession(sessionId);
    } catch (error) {
      console.error(`Failed to watch session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSessions(agentType) {
    try {
      // Assuming VibeKit has getSessionsForAgent
      return await this.vibekit.getSessionsForAgent(agentType);
    } catch (error) {
      console.error(`Failed to get sessions for ${agentType}:`, error);
      return [];
    }
  }

  async executeTask(agentType, taskId, options = {}) {
    const maxRetries = options.retries || 2;
    let attempts = 0;
    while (attempts <= maxRetries) {
      try {
        return await this.vibekit.executeWithAgent(agentType, taskId, options);
      } catch (error) {
        attempts++;
        if (attempts > maxRetries) throw error;
        console.warn(`Retry ${attempts}/${maxRetries} for execution`);
      }
    }
  }
} 