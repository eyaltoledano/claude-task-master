#!/usr/bin/env node

// 🔄 主要用途：一次性迁移工具
// migrate-config.js 主要是一个配置迁移脚本，用于从旧的单项目配置结构迁移到新的多项目配置结构。

// 📋 具体功能
// 配置结构迁移
// 从旧的项目级配置（ .taskmaster/config.json）迁移到Express API配置
// 创建新的 config/express-api-config.json和 projects/.registry/projects.json
// 项目发现与注册
// 扫描 projects/目录下的所有现有项目
// 自动将发现的项目注册到新的配置系统中
// 数据保护
// 备份旧配置文件（创建.backup文件）
// 安全地清理旧配置文件
// 🎯 使用场景
// 主要场景（一次性）：
// 版本升级：从单项目版本升级到多项目版本时
// 架构迁移：改变配置结构时的一次性迁移
// 次要场景（可重复使用）：
// 配置修复：当配置文件损坏时重新生成
// 重新初始化：需要重建配置结构时
// 新项目发现：扫描并注册新添加的项目

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigMigration {
  constructor() {
    this.projectsDir = path.resolve(__dirname, '../projects');
    this.configDir = path.resolve(__dirname, '../express-api');
    this.projectsRegistryDir = path.resolve(__dirname, '../projects/.registry');
    this.globalConfigPath = path.join(this.configDir, 'config.json');
    this.projectsConfigPath = path.join(this.projectsRegistryDir, 'projects.json');
    this.templatesConfigPath = path.join(this.projectsRegistryDir, 'templates.json');
  }

  async migrate() {
    console.log('🔄 Starting configuration migration...');

    try {
      // 1. 确保新配置目录存在
      await this.ensureConfigDirectory();
      await this.ensureProjectsRegistryDirectory();

      // 2. 创建全局配置（如果不存在）
      await this.createGlobalConfig();

      // 3. 扫描现有项目并迁移配置
      const projects = await this.scanExistingProjects();
      
      // 4. 创建项目注册表和模板配置
      await this.createProjectsConfig(projects);
      await this.createTemplatesConfig();

      // 5. 清理旧的项目配置文件
      await this.cleanupOldConfigs(projects);

      console.log('✅ Configuration migration completed successfully!');
      console.log(`📊 Migrated ${projects.length} projects`);

    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  }

  async ensureConfigDirectory() {
    try {
      await fs.access(this.configDir);
      console.log('📁 Config directory already exists');
    } catch (error) {
      await fs.mkdir(this.configDir, { recursive: true });
      console.log('📁 Created config directory');
    }
  }

  async ensureProjectsRegistryDirectory() {
    try {
      await fs.access(this.projectsRegistryDir);
      console.log('📁 Projects registry directory already exists');
    } catch (error) {
      await fs.mkdir(this.projectsRegistryDir, { recursive: true });
      console.log('📁 Created projects registry directory');
    }
  }

  async createGlobalConfig() {
    try {
      await fs.access(this.globalConfigPath);
      console.log('⚙️  Global config already exists');
      return;
    } catch (error) {
      // 文件不存在，创建默认配置
    }

    const globalConfig = {
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
        timeout: 30000,
        concurrency: {
          maxConcurrentTasks: 5,
          maxConcurrentProjects: 10
        }
      },
      api: {
        rateLimit: {
          windowMs: 900000,
          max: 100
        },
        cors: {
          origin: "*",
          methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
          allowedHeaders: ["Content-Type", "Authorization", "X-Project-ID"]
        }
      },
      version: "1.0.0",
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(this.globalConfigPath, JSON.stringify(globalConfig, null, 2));
    console.log('⚙️  Created global config');
  }

  async scanExistingProjects() {
    const projects = [];

    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectId = entry.name;
          const projectPath = path.join(this.projectsDir, projectId);
          const taskmasterPath = path.join(projectPath, '.taskmaster');
          
          try {
            // 检查是否是有效的TaskMaster项目
            await fs.access(taskmasterPath);
            
            // 尝试读取现有配置
            const project = await this.extractProjectInfo(projectId, projectPath);
            projects.push(project);
            
            console.log(`📦 Found project: ${projectId}`);
          } catch (error) {
            console.log(`⚠️  Skipping invalid project: ${projectId}`);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      console.log('📁 No existing projects directory found');
    }

    return projects;
  }

  async extractProjectInfo(projectId, projectPath) {
    const configPath = path.join(projectPath, '.taskmaster', 'config.json');
    
    let projectInfo = {
      id: projectId,
      name: projectId,
      description: '',
      template: 'default',
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      status: 'active',
      tags: [],
      hasOldConfig: false
    };

    try {
      // 尝试读取现有配置
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (config.projectInfo) {
        projectInfo.name = config.projectInfo.name || projectId;
        projectInfo.description = config.projectInfo.description || '';
        projectInfo.template = config.projectInfo.template || 'default';
        projectInfo.createdAt = config.projectInfo.created || projectInfo.createdAt;
        projectInfo.hasOldConfig = true;
      }
    } catch (error) {
      // 配置文件不存在或无法读取，使用默认值
      console.log(`⚠️  Could not read config for ${projectId}, using defaults`);
    }

    return projectInfo;
  }

  async createProjectsConfig(projects) {
    const projectsConfig = {
      projects: {},
      metadata: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        version: "1.0.0",
        lastUpdated: new Date().toISOString()
      }
    };

    // 添加所有项目到注册表
    for (const project of projects) {
      projectsConfig.projects[project.id] = {
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        lastAccessed: project.lastAccessed,
        status: project.status,
        tags: project.tags,
        template: project.template
      };
    }

    await fs.writeFile(this.projectsConfigPath, JSON.stringify(projectsConfig, null, 2));
    console.log('📋 Created projects config');
  }

  async createTemplatesConfig() {
    const templatesConfig = {
      templates: {
        default: {
          name: "Default Project Template",
          description: "Standard project template with basic structure",
          structure: {
            tasks: true,
            docs: true,
            reports: true
          }
        },
        "web-app": {
          name: "Web Application Template",
          description: "Template for web application projects",
          structure: {
            tasks: true,
            docs: true,
            reports: true,
            components: true,
            api: true
          }
        },
        "mobile-app": {
          name: "Mobile Application Template",
          description: "Template for mobile application projects",
          structure: {
            tasks: true,
            docs: true,
            reports: true,
            screens: true,
            api: true
          }
        }
      },
      settings: {
        defaultTemplate: "default"
      },
      version: "1.0.0",
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(this.templatesConfigPath, JSON.stringify(templatesConfig, null, 2));
    console.log('📋 Created templates config');
  }

  async cleanupOldConfigs(projects) {
    let cleanedCount = 0;

    for (const project of projects) {
      if (project.hasOldConfig) {
        const configPath = path.join(this.projectsDir, project.id, '.taskmaster', 'config.json');
        const backupPath = path.join(this.projectsDir, project.id, '.taskmaster', 'config.json.backup');
        
        try {
          // 备份旧配置
          await fs.copyFile(configPath, backupPath);
          
          // 删除旧配置
          await fs.unlink(configPath);
          
          cleanedCount++;
          console.log(`🧹 Cleaned up config for ${project.id} (backup created)`);
        } catch (error) {
          console.log(`⚠️  Failed to cleanup config for ${project.id}: ${error.message}`);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old config files`);
    }
  }
}

// 运行迁移
const migration = new ConfigMigration();
migration.migrate();
