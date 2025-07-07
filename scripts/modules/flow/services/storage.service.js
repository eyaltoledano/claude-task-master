/**
 * Task Master Flow - Storage Service
 * Phase 1: Schema & Storage Layer
 * 
 * Effect-based storage service using @effect/platform-node for robust file operations.
 */

import { Effect, Context, Layer, Schema as S } from "effect";
import { FileSystem } from "@effect/platform-node";
import path from "path";
import { 
  SandboxConfig, 
  AgentConfig, 
  ExecutionConfig 
} from '../schemas/index.js';
import { 
  validateSchema, 
  parseWithSchema, 
  encodeWithSchema,
  ValidationError 
} from '../schemas/validation.js';

/**
 * Storage configuration
 */
export const StorageConfig = S.Struct({
  basePath: S.String,
  autoBackup: S.Boolean.withDefault(true),
  backupCount: S.Number.pipe(S.clamp(1, 10)).withDefault(3),
  atomicWrites: S.Boolean.withDefault(true),
  createDirectories: S.Boolean.withDefault(true)
});

/**
 * Storage service interface
 */
export class FlowStorageService extends Context.Tag("flow/StorageService")() {
  static Live = Layer.effect(
    FlowStorageService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      
      /**
       * Ensure directory exists
       */
      const ensureDirectory = (dirPath) =>
        Effect.gen(function* () {
          const exists = yield* fs.exists(dirPath);
          if (!exists) {
            yield* fs.makeDirectory(dirPath, { recursive: true });
          }
        });

      /**
       * Create backup of file before writing
       */
      const createBackup = (filePath, config) =>
        Effect.gen(function* () {
          if (!config.autoBackup) return;
          
          const exists = yield* fs.exists(filePath);
          if (!exists) return;
          
          const backupPath = `${filePath}.backup.${Date.now()}`;
          yield* fs.copy(filePath, backupPath);
          
          // Clean up old backups
          yield* cleanupBackups(filePath, config.backupCount);
        });

      /**
       * Clean up old backup files
       */
      const cleanupBackups = (filePath, maxBackups) =>
        Effect.gen(function* () {
          const dir = path.dirname(filePath);
          const basename = path.basename(filePath);
          
          const files = yield* fs.readDirectory(dir);
          const backupFiles = files
            .filter(file => file.startsWith(`${basename}.backup.`))
            .map(file => ({
              name: file,
              path: path.join(dir, file),
              timestamp: parseInt(file.split('.').pop() || '0')
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
          
          // Remove excess backups
          for (const backup of backupFiles.slice(maxBackups)) {
            yield* fs.remove(backup.path);
          }
        });

      /**
       * Write file atomically
       */
      const writeFileAtomic = (filePath, content, config) =>
        Effect.gen(function* () {
          if (!config.atomicWrites) {
            yield* fs.writeFileString(filePath, content);
            return;
          }
          
          const tempPath = `${filePath}.tmp.${Date.now()}`;
          
          try {
            // Write to temporary file first
            yield* fs.writeFileString(tempPath, content);
            
            // Atomic move to final location
            yield* fs.copy(tempPath, filePath);
            yield* fs.remove(tempPath);
          } catch (error) {
            // Clean up temp file on error
            const tempExists = yield* fs.exists(tempPath);
            if (tempExists) {
              yield* fs.remove(tempPath);
            }
            throw error;
          }
        });

      /**
       * Read and validate configuration file
       */
      const readConfig = (filePath, schema, config) =>
        Effect.gen(function* () {
          // Check if file exists
          const exists = yield* fs.exists(filePath);
          if (!exists) {
            return Effect.fail(new Error(`Configuration file not found: ${filePath}`));
          }
          
          // Read file content
          const content = yield* fs.readFileString(filePath);
          
          // Parse and validate
          const validated = yield* parseWithSchema(schema, content, {
            strict: true
          });
          
          return validated;
        });

      /**
       * Write and validate configuration file
       */
      const writeConfig = (filePath, data, schema, config) =>
        Effect.gen(function* () {
          // Ensure directory exists
          if (config.createDirectories) {
            yield* ensureDirectory(path.dirname(filePath));
          }
          
          // Create backup if file exists
          yield* createBackup(filePath, config);
          
          // Validate and encode data
          const jsonContent = yield* encodeWithSchema(schema, data, {
            pretty: true,
            strict: true
          });
          
          // Write file atomically
          yield* writeFileAtomic(filePath, jsonContent, config);
          
          return data;
        });

      /**
       * Storage service implementation
       */
      return {
        // Generic file operations
        readConfig,
        writeConfig,
        
        // Specific configuration types
        readSandboxConfig: (filePath, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return readConfig(filePath, SandboxConfig, storageConfig);
        },
        
        writeSandboxConfig: (filePath, data, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return writeConfig(filePath, data, SandboxConfig, storageConfig);
        },
        
        readAgentConfig: (filePath, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return readConfig(filePath, AgentConfig, storageConfig);
        },
        
        writeAgentConfig: (filePath, data, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return writeConfig(filePath, data, AgentConfig, storageConfig);
        },
        
        readExecutionConfig: (filePath, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return readConfig(filePath, ExecutionConfig, storageConfig);
        },
        
        writeExecutionConfig: (filePath, data, config = {}) => {
          const storageConfig = { 
            basePath: '.taskmaster/flow',
            autoBackup: true,
            backupCount: 3,
            atomicWrites: true,
            createDirectories: true,
            ...config 
          };
          return writeConfig(filePath, data, ExecutionConfig, storageConfig);
        },
        
        // Utility operations
        exists: (filePath) => fs.exists(filePath),
        
        remove: (filePath) => fs.remove(filePath),
        
        listConfigs: (directory) =>
          Effect.gen(function* () {
            const exists = yield* fs.exists(directory);
            if (!exists) return [];
            
            const files = yield* fs.readDirectory(directory);
            return files.filter(file => file.endsWith('.json'));
          }),
        
        createDirectory: (dirPath) => 
          fs.makeDirectory(dirPath, { recursive: true }),
        
        copyConfig: (source, destination) =>
          Effect.gen(function* () {
            // Ensure destination directory exists
            yield* ensureDirectory(path.dirname(destination));
            yield* fs.copy(source, destination);
          }),
        
        validateConfig: (filePath, schema) =>
          Effect.gen(function* () {
            const exists = yield* fs.exists(filePath);
            if (!exists) {
              return { valid: false, error: "File not found" };
            }
            
            try {
              const content = yield* fs.readFileString(filePath);
              yield* parseWithSchema(schema, content);
              return { valid: true };
            } catch (error) {
              return { 
                valid: false, 
                error: error.message,
                details: error instanceof ValidationError ? error.errors : []
              };
            }
          })
      };
    })
  );
}

/**
 * Convenience functions for direct usage
 */

/**
 * Create storage service with default configuration
 */
export const createStorageService = (basePath = '.taskmaster/flow') => {
  const config = {
    basePath,
    autoBackup: true,
    backupCount: 3,
    atomicWrites: true,
    createDirectories: true
  };
  
  return FlowStorageService.Live;
};

/**
 * Storage paths utilities
 */
export const StoragePaths = {
  sandbox: (name) => `.taskmaster/flow/sandbox/${name}.json`,
  agent: (name) => `.taskmaster/flow/agent/${name}.json`,
  execution: (id) => `.taskmaster/flow/execution/${id}.json`,
  config: (type, name) => `.taskmaster/flow/config/${type}/${name}.json`,
  
  // Directory paths
  sandboxDir: () => '.taskmaster/flow/sandbox',
  agentDir: () => '.taskmaster/flow/agent',
  executionDir: () => '.taskmaster/flow/execution',
  configDir: (type) => `.taskmaster/flow/config/${type}`,
  flowDir: () => '.taskmaster/flow'
};

/**
 * JSDoc type definitions
 * 
 * @typedef {Object} StorageServiceType
 * @property {Function} readConfig - Read and validate configuration file
 * @property {Function} writeConfig - Write and validate configuration file
 * @property {Function} readSandboxConfig - Read sandbox configuration
 * @property {Function} writeSandboxConfig - Write sandbox configuration
 * @property {Function} readAgentConfig - Read agent configuration
 * @property {Function} writeAgentConfig - Write agent configuration
 * @property {Function} readExecutionConfig - Read execution configuration
 * @property {Function} writeExecutionConfig - Write execution configuration
 */ 