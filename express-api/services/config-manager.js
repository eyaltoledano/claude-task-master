import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { getCacheManager } from '../utils/cache-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigManager {
  constructor() {
    this.logger = createLogger('config-manager');
    this.cache = getCacheManager();
    this.configDir = path.resolve(__dirname, '..');
    this.projectsDir = path.resolve(__dirname, '../../projects');
    this.globalConfigPath = path.join(this.configDir, 'config.json');
    this.projectsConfigPath = path.join(this.projectsDir, '.registry', 'projects.json');
    this.templatesConfigPath = path.join(this.projectsDir, '.registry', 'templates.json');
    this.cachePrefix = 'config:';
    this.cacheTTL = 300000; // 5分钟缓存

    this.globalConfig = null;
    this.projectsConfig = null;
    this.configCache = new Map(); // 保留原有缓存作为备用
  }

  /**
   * 初始化配置管理器
   */
  async initialize() {
    try {
      await this.ensureConfigDirectory();
      await this.loadGlobalConfig();
      await this.loadProjectsConfig();
      this.logger.info('Configuration manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize configuration manager', { error: error.message });
      throw error;
    }
  }

  /**
   * 确保配置目录存在
   */
  async ensureConfigDirectory() {
    try {
      await fs.access(this.configDir);
    } catch (error) {
      await fs.mkdir(this.configDir, { recursive: true });
      this.logger.info('Created config directory', { path: this.configDir });
    }
  }

  /**
   * 加载全局配置
   */
  async loadGlobalConfig() {
    try {
      const configData = await fs.readFile(this.globalConfigPath, 'utf8');
      this.globalConfig = JSON.parse(configData);
      this.logger.debug('Global config loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn('Global config file not found, creating default');
        await this.createDefaultGlobalConfig();
      } else {
        throw error;
      }
    }
  }

  /**
   * 加载项目配置
   */
  async loadProjectsConfig() {
    try {
      const configData = await fs.readFile(this.projectsConfigPath, 'utf8');
      this.projectsConfig = JSON.parse(configData);
      this.logger.debug('Projects config loaded successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn('Projects config file not found, creating default');
        await this.createDefaultProjectsConfig();
      } else {
        throw error;
      }
    }
  }

  /**
   * 创建默认全局配置
   */
  async createDefaultGlobalConfig() {
    const defaultConfig = {
      ai: {
        main: {
          provider: "openrouter",
          modelId: "deepseek/deepseek-r1-0528:free",
          maxTokens: 4000,
          temperature: 0.2,
          model: "deepseek/deepseek-r1-0528:free"
        },
        fallback: {
          provider: "openrouter",
          modelId: "deepseek/deepseek-r1-0528:free", 
          maxTokens: 4000,
          temperature: 0.2,
          model: "deepseek/deepseek-r1-0528:free"
        },
        research: {
          provider: "perplexity",
          modelId: "sonar-pro",
          maxTokens: 8700,
          temperature: 0.1,
          model: "sonar-pro"
        }
      },
      defaults: {
        task: {
          priority: "medium",
          status: "pending",
          autoGenerate: true
        },
        prd: {
          maxTasks: 20,
          includeDetails: true,
          includeTestStrategy: true
        }
      },
      system: {
        logLevel: "info",
        maxRetries: 3,
        timeout: 30000
      },
      version: "1.0.0",
      lastUpdated: new Date().toISOString()
    };

    await this.saveGlobalConfig(defaultConfig);
    this.globalConfig = defaultConfig;
  }

  /**
   * 创建默认项目配置
   */
  async createDefaultProjectsConfig() {
    const defaultConfig = {
      projects: {},
      templates: {
        default: {
          name: "Default Project Template",
          description: "Standard project template with basic structure",
          structure: {
            tasks: true,
            docs: true,
            reports: true
          }
        }
      },
      settings: {
        defaultTemplate: "default",
        autoCleanup: {
          enabled: false,
          inactiveDays: 90
        }
      },
      version: "1.0.0",
      lastUpdated: new Date().toISOString()
    };

    await this.saveProjectsConfig(defaultConfig);
    this.projectsConfig = defaultConfig;
  }

  /**
   * 获取项目的完整配置（全局配置 + 项目特定配置）
   */
  async getProjectConfig(projectId) {
    const cacheKey = `project:${projectId}`;
    
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    try {
      // 基础配置从全局配置开始
      const config = JSON.parse(JSON.stringify(this.globalConfig));
      
      // 添加项目信息
      const projectInfo = this.projectsConfig.projects[projectId];
      if (projectInfo) {
        config.project = projectInfo;
      }

      // 尝试加载项目特定配置
      const projectConfigPath = path.join(
        __dirname, '../../projects', projectId, '.taskmaster', 'project.json'
      );
      
      try {
        const projectConfigData = await fs.readFile(projectConfigPath, 'utf8');
        const projectConfig = JSON.parse(projectConfigData);
        
        // 合并配置（项目配置覆盖全局配置）
        this.mergeConfig(config, projectConfig);
      } catch (error) {
        // 项目特定配置文件不存在是正常的
        if (error.code !== 'ENOENT') {
          this.logger.warn('Failed to load project config', { 
            projectId, 
            error: error.message 
          });
        }
      }

      // 缓存配置
      this.configCache.set(cacheKey, config);
      
      return config;
    } catch (error) {
      this.logger.error('Failed to get project config', { 
        projectId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 深度合并配置对象
   */
  mergeConfig(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * 获取全局配置
   */
  getGlobalConfig() {
    return this.globalConfig;
  }

  /**
   * 获取项目列表配置
   */
  getProjectsConfig() {
    return this.projectsConfig;
  }

  /**
   * 保存全局配置
   */
  async saveGlobalConfig(config) {
    config.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.globalConfigPath, JSON.stringify(config, null, 2));
    this.globalConfig = config;
    this.clearCache();
    this.logger.info('Global config saved successfully');
  }

  /**
   * 保存项目配置
   */
  async saveProjectsConfig(config) {
    config.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.projectsConfigPath, JSON.stringify(config, null, 2));
    this.projectsConfig = config;
    this.clearCache();
    this.logger.info('Projects config saved successfully');
  }

  /**
   * 注册新项目
   */
  async registerProject(projectId, projectInfo) {
    this.projectsConfig.projects[projectId] = {
      ...projectInfo,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      status: 'active'
    };
    
    await this.saveProjectsConfig(this.projectsConfig);
    this.logger.info('Project registered successfully', { projectId });
  }

  /**
   * 更新项目访问时间
   */
  async updateProjectAccess(projectId) {
    if (this.projectsConfig.projects[projectId]) {
      this.projectsConfig.projects[projectId].lastAccessed = new Date().toISOString();
      await this.saveProjectsConfig(this.projectsConfig);
    }
  }

  /**
   * 更新项目状态
   */
  async updateProjectStatus(projectId, status) {
    if (this.projectsConfig.projects[projectId]) {
      this.projectsConfig.projects[projectId].status = status;
      this.projectsConfig.projects[projectId].lastUpdated = new Date().toISOString();
      await this.saveProjectsConfig(this.projectsConfig);
      this.logger.info('Project status updated', { projectId, status });
    } else {
      throw new Error(`Project ${projectId} not found in registry`);
    }
  }

  /**
   * 从注册文件中删除项目
   */
  async removeProjectFromRegistry(projectId) {
    if (this.projectsConfig.projects[projectId]) {
      delete this.projectsConfig.projects[projectId];
      this.projectsConfig.lastUpdated = new Date().toISOString();
      await this.saveProjectsConfig(this.projectsConfig);
      this.logger.info('Project removed from registry', { projectId });
    } else {
      throw new Error(`Project ${projectId} not found in registry`);
    }
  }

  /**
   * 获取活跃项目列表（过滤掉已删除的项目）
   */
  getActiveProjects() {
    const activeProjects = {};
    for (const [projectId, project] of Object.entries(this.projectsConfig.projects)) {
      if (project.status !== 'deleted') {
        activeProjects[projectId] = project;
      }
    }
    return activeProjects;
  }

  /**
   * 清除配置缓存
   */
  clearCache() {
    this.configCache.clear();
    this.logger.debug('Configuration cache cleared');
  }

  /**
   * 重新加载配置
   */
  async reload() {
    this.clearCache();
    await this.loadGlobalConfig();
    await this.loadProjectsConfig();
    this.logger.info('Configuration reloaded successfully');
  }
}

export default ConfigManager;
