import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AgentsConfigService {
  constructor() {
    this.configPath = path.join(__dirname, 'agents.json');
    this.ensureConfigExists();
  }

  async ensureConfigExists() {
    try {
      await fs.access(this.configPath);
    } catch (error) {
      // Create default config if it doesn't exist
      await this.createDefaultConfig();
    }
  }

  async createDefaultConfig() {
    const defaultConfig = {
      version: "1.0.0",
      agents: {
        claude: {
          enabled: true,
          model: "claude-3-5-sonnet-20241022",
          maxTokens: 4000,
          temperature: 0.7,
          color: "7c3aed",
          provider: "anthropic"
        },
        codex: {
          enabled: true,
          model: "gpt-4-turbo-preview",
          maxTokens: 4000,
          temperature: 0.7,
          color: "10b981",
          provider: "openai"
        },
        gemini: {
          enabled: true,
          model: "gemini-1.5-pro",
          maxTokens: 4000,
          temperature: 0.7,
          color: "f59e0b",
          provider: "gemini"
        },
        opencode: {
          enabled: true,
          model: "deepseek-coder-v2",
          maxTokens: 4000,
          temperature: 0.7,
          color: "ef4444",
          provider: "openai"
        }
      },
      preferences: {
        taskTypes: {
          planning: {
            keywords: ["design", "architect", "plan", "structure", "organize"],
            preferredAgents: ["claude", "gemini", "codex"],
            description: "High-level design and architecture tasks"
          },
          execution: {
            keywords: ["implement", "create", "build", "develop", "code"],
            preferredAgents: ["codex", "claude", "opencode"],
            description: "Code implementation tasks"
          },
          debugging: {
            keywords: ["fix", "debug", "resolve", "troubleshoot", "error"],
            preferredAgents: ["claude", "codex"],
            description: "Bug fixing and debugging tasks"
          },
          documentation: {
            keywords: ["document", "readme", "guide", "explain", "describe"],
            preferredAgents: ["claude", "gemini"],
            description: "Documentation and explanation tasks"
          },
          testing: {
            keywords: ["test", "verify", "validate", "check", "ensure"],
            preferredAgents: ["codex", "claude"],
            description: "Test writing and validation tasks"
          }
        },
        rankings: {
          claude: { overall: 1, planning: 1, execution: 2, debugging: 1, documentation: 1 },
          codex: { overall: 2, planning: 3, execution: 1, debugging: 2, documentation: 3 },
          gemini: { overall: 3, planning: 2, execution: 4, debugging: 4, documentation: 2 },
          opencode: { overall: 4, planning: 4, execution: 3, debugging: 3, documentation: 4 }
        }
      },
      sandbox: {
        autoCleanupHours: 4,
        warnBeforeCleanupMinutes: 30,
        maxConcurrentSandboxes: 3
      },
      github: {
        autoCreatePR: true,
        branchPrefix: "tm",
        taskLabelColor: "0366d6",
        agentLabelPrefix: "agent-"
      },
      tracking: {
        pullRequests: {},
        sandboxHistory: {},
        statistics: {
          totalPRsCreated: 0,
          prsByAgent: {},
          averageSandboxDuration: 0
        }
      }
    };

    await this.saveConfig(defaultConfig);
  }

  async loadConfig() {
    try {
      const content = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading agents config:', error);
      await this.createDefaultConfig();
      return this.loadConfig();
    }
  }

  async saveConfig(config) {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving agents config:', error);
      throw error;
    }
  }

  async updateConfig(updateFn) {
    const config = await this.loadConfig();
    const updated = updateFn(config);
    await this.saveConfig(updated);
    return updated;
  }

  // Agent Configuration Methods
  async getAgentConfig(agentName) {
    const config = await this.loadConfig();
    return config.agents[agentName];
  }

  async getEnabledAgents() {
    const config = await this.loadConfig();
    return Object.entries(config.agents)
      .filter(([_, agentConfig]) => agentConfig.enabled)
      .map(([name]) => name);
  }

  async getConfiguredAgents() {
    const enabledAgents = await this.getEnabledAgents();
    return enabledAgents.filter(agent => this.hasApiKey(agent));
  }

  hasApiKey(agent) {
    const keyMap = {
      'claude': process.env.ANTHROPIC_API_KEY,
      'codex': process.env.OPENAI_API_KEY,
      'gemini': process.env.GOOGLE_API_KEY,
      'opencode': process.env.OPENAI_API_KEY
    };
    return !!keyMap[agent];
  }

  getApiKeyForAgent(agent) {
    const keyMap = {
      'claude': process.env.ANTHROPIC_API_KEY,
      'codex': process.env.OPENAI_API_KEY,
      'gemini': process.env.GOOGLE_API_KEY,
      'opencode': process.env.OPENAI_API_KEY
    };
    return keyMap[agent];
  }

  getE2BTemplateForAgent(agent) {
    const templateMap = {
      'claude': 'claude',
      'codex': 'codex',
      'gemini': 'gemini',
      'opencode': 'opencode'
    };
    return templateMap[agent] || process.env.E2B_TEMPLATE_ID;
  }

  // VibeKit Configuration Builder
  async getVibeKitConfig(agent) {
    const config = await this.loadConfig();
    const agentConfig = config.agents[agent];
    
    if (!agentConfig || !agentConfig.enabled) {
      throw new Error(`Agent ${agent} is not enabled`);
    }

    const apiKey = this.getApiKeyForAgent(agent);
    if (!apiKey) {
      throw new Error(`Missing API key for agent ${agent}`);
    }

    return {
      agent: {
        type: agent,
        model: {
          apiKey,
          name: agentConfig.model,
          provider: agentConfig.provider,
          maxTokens: agentConfig.maxTokens,
          temperature: agentConfig.temperature
        }
      },
      environment: {
        e2b: {
          apiKey: process.env.E2B_API_KEY,
          templateId: this.getE2BTemplateForAgent(agent)
        }
      },
      github: await this.getGitHubConfig()
    };
  }

  async getGitHubConfig() {
    // Load GitHub auth from existing system
    try {
      const { autoLoadGitHubToken } = await import('../commands/github-auth-demo.js');
      const githubAuth = await autoLoadGitHubToken();
      
      if (githubAuth?.success) {
        return {
          token: githubAuth.token,
          repository: await this.detectRepository()
        };
      }
    } catch (error) {
      console.warn('GitHub auth not available:', error.message);
    }

    // Fallback to environment variable
    if (process.env.GITHUB_API_KEY) {
      return {
        token: process.env.GITHUB_API_KEY,
        repository: await this.detectRepository()
      };
    }

    return null;
  }

  async detectRepository() {
    // Try to detect repository from git config
    try {
      const { execSync } = await import('child_process');
      const remote = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
      
      // Convert SSH/HTTPS URLs to owner/repo format
      const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
      return match ? match[1] : 'joedanz/test-repo'; // fallback
    } catch (error) {
      return 'joedanz/test-repo'; // fallback
    }
  }

  // PR Tracking Methods
  async recordPR(subtaskId, pr, agent) {
    return this.updateConfig(config => {
      const [taskId, subtaskNum] = subtaskId.split('.');
      const key = `task-${taskId}-subtask-${subtaskNum}`;
      
      config.tracking.pullRequests[key] = {
        prNumber: pr.number,
        prUrl: pr.html_url,
        branch: pr.head.ref,
        agent: agent,
        createdAt: pr.created_at,
        status: pr.state,
        taskId: taskId,
        subtaskId: subtaskId,
        commitSha: pr.head.sha,
        labels: [`task-${taskId}`, `agent-${agent}`]
      };
      
      // Update statistics
      config.tracking.statistics.totalPRsCreated++;
      config.tracking.statistics.prsByAgent[agent] = 
        (config.tracking.statistics.prsByAgent[agent] || 0) + 1;
      
      return config;
    });
  }

  async recordSandboxCreation(agent, subtaskId) {
    return this.updateConfig(config => {
      const sandboxId = `${agent}-${Date.now()}`;
      const [taskId] = subtaskId.split('.');
      
      config.tracking.sandboxHistory[sandboxId] = {
        sandboxId,
        agent,
        createdAt: new Date().toISOString(),
        taskId,
        subtaskId
      };
      
      return config;
    });
  }

  async recordSandboxKilled(agent, subtaskId, duration) {
    return this.updateConfig(config => {
      // Find the sandbox for this agent/subtask
      const sandbox = Object.values(config.tracking.sandboxHistory).find(
        s => s.agent === agent && s.subtaskId === subtaskId && !s.killedAt
      );
      
      if (sandbox) {
        sandbox.killedAt = new Date().toISOString();
        sandbox.duration = duration;
        
        // Update average duration
        const currentAvg = config.tracking.statistics.averageSandboxDuration || 0;
        config.tracking.statistics.averageSandboxDuration = 
          Math.round((currentAvg + duration) / 2);
      }
      
      return config;
    });
  }

  async getPRsForTask(taskId) {
    const config = await this.loadConfig();
    return Object.values(config.tracking.pullRequests)
      .filter(pr => pr.taskId === taskId);
  }

  async getPRForSubtask(subtaskId) {
    const config = await this.loadConfig();
    const [taskId, subtaskNum] = subtaskId.split('.');
    const key = `task-${taskId}-subtask-${subtaskNum}`;
    return config.tracking.pullRequests[key];
  }

  // Task Type Detection
  async detectTaskType(subtask) {
    const config = await this.loadConfig();
    const text = `${subtask.title} ${subtask.description} ${subtask.details}`.toLowerCase();
    
    for (const [type, typeConfig] of Object.entries(config.preferences.taskTypes)) {
      if (typeConfig.keywords.some(keyword => text.includes(keyword))) {
        return type;
      }
    }
    
    return 'execution'; // Default
  }

  // Agent Selection
  async selectBestAgent(subtask) {
    const config = await this.loadConfig();
    const configuredAgents = await this.getConfiguredAgents();
    
    if (configuredAgents.length === 0) {
      throw new Error('No agents configured with API keys');
    }
    
    if (configuredAgents.length === 1) {
      return configuredAgents[0];
    }
    
    // Detect task type
    const taskType = await this.detectTaskType(subtask);
    
    // Get preferred agents for this task type
    const preferredAgents = config.preferences.taskTypes[taskType]?.preferredAgents || [];
    
    // Filter to available agents in preference order
    const availablePreferred = preferredAgents.filter(agent => 
      configuredAgents.includes(agent)
    );
    
    if (availablePreferred.length > 0) {
      return availablePreferred[0];
    }
    
    // Fall back to overall ranking
    const rankedAgents = configuredAgents.sort((a, b) => {
      const rankA = config.preferences.rankings[a]?.overall || 999;
      const rankB = config.preferences.rankings[b]?.overall || 999;
      return rankA - rankB;
    });
    
    return rankedAgents[0];
  }

  // Sandbox Cleanup
  async getOrphanedSandboxes() {
    const config = await this.loadConfig();
    const maxAgeHours = config.sandbox.autoCleanupHours;
    const now = new Date();
    
    return Object.values(config.tracking.sandboxHistory)
      .filter(sandbox => {
        if (sandbox.killedAt) return false; // Already cleaned
        
        const ageHours = (now - new Date(sandbox.createdAt)) / (1000 * 60 * 60);
        return ageHours > maxAgeHours;
      });
  }

  async markSandboxCleaned(sandboxId) {
    return this.updateConfig(config => {
      const sandbox = config.tracking.sandboxHistory[sandboxId];
      if (sandbox) {
        sandbox.killedAt = new Date().toISOString();
        sandbox.autoCleanedUp = true;
      }
      return config;
    });
  }

  // Statistics
  async getStatistics() {
    const config = await this.loadConfig();
    return config.tracking.statistics;
  }
} 