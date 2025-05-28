/**
 * Configuration API types for claude-task-master
 */

import type { ProviderName, ProviderRole, ModelInfo } from '../models/ai.js';
import type { LogLevel, Environment } from '../utils/common.js';

/**
 * Task Master configuration
 */
export interface TaskMasterConfig {
  version: string;
  models: ModelConfiguration;
  parameters: ParameterConfiguration;
  features: FeatureConfiguration;
  paths: PathConfiguration;
  debug?: boolean;
  environment?: Environment;
}

/**
 * Model configuration
 */
export interface ModelConfiguration {
  main: {
    provider: ProviderName;
    model: string;
  };
  research?: {
    provider: ProviderName;
    model: string;
  };
  fallback?: {
    provider: ProviderName;
    model: string;
  };
  baseUrls?: Partial<Record<ProviderRole, string>>;
}

/**
 * Parameter configuration for different roles
 */
export interface ParameterConfiguration {
  main?: ModelParameters;
  research?: ModelParameters;
  fallback?: ModelParameters;
}

/**
 * Model parameters
 */
export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

/**
 * Feature configuration
 */
export interface FeatureConfiguration {
  autoExpand?: boolean;
  autoValidate?: boolean;
  useMcp?: boolean;
  useResearchMode?: boolean;
  enableLogging?: boolean;
  logLevel?: LogLevel;
  telemetry?: boolean;
  experimental?: Record<string, boolean>;
}

/**
 * Path configuration
 */
export interface PathConfiguration {
  tasksDir?: string;
  configFile?: string;
  envFile?: string;
  logDir?: string;
  cacheDir?: string;
}

/**
 * API key configuration
 */
export interface ApiKeyConfig {
  provider: ProviderName;
  key: string;
  isValid?: boolean;
  lastValidated?: Date;
  usageLimit?: number;
  usageCount?: number;
}

/**
 * Configuration update request
 */
export interface ConfigUpdateRequest {
  models?: Partial<ModelConfiguration>;
  parameters?: Partial<ParameterConfiguration>;
  features?: Partial<FeatureConfiguration>;
  paths?: Partial<PathConfiguration>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  role: ProviderRole;
  capabilities?: string[];
  maxCost?: number;
  preferredProviders?: ProviderName[];
  excludeProviders?: ProviderName[];
  minContextWindow?: number;
  requiresInternet?: boolean;
}

/**
 * Model recommendation
 */
export interface ModelRecommendation {
  provider: ProviderName;
  model: string;
  score: number;
  reasons: string[];
  info: ModelInfo;
}

/**
 * Configuration export format
 */
export interface ConfigExport {
  version: string;
  timestamp: Date;
  config: TaskMasterConfig;
  metadata?: {
    exportedBy?: string;
    reason?: string;
    checksum?: string;
  };
}

/**
 * Configuration import options
 */
export interface ConfigImportOptions {
  merge?: boolean;
  validate?: boolean;
  backup?: boolean;
  overrideApiKeys?: boolean;
}

/**
 * User preferences
 */
export interface UserPreferences {
  userId?: string;
  theme?: 'light' | 'dark' | 'auto';
  defaultRole?: ProviderRole;
  shortcuts?: Record<string, string>;
  recentProjects?: string[];
  favoriteModels?: string[];
}

/**
 * Project-specific configuration
 */
export interface ProjectConfig {
  projectId: string;
  name: string;
  description?: string;
  created: Date;
  modified: Date;
  overrides?: Partial<TaskMasterConfig>;
  metadata?: Record<string, any>;
}