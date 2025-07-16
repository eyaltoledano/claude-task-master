// Main database imports and exports
import { SQLiteManager } from './sqlite-manager.js';
import { SyncEngine } from './sync-engine.js';
import { DataTransformer } from './data-transformer.js';

export { SQLiteManager, SyncEngine, DataTransformer };

// Schema exports
export * as schema from './schema.js';

// Configuration loader
import fs from 'fs';
import path from 'path';

const configPath = new URL('../../config/database.json', import.meta.url);
const databaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

export { databaseConfig };

// Database factory for easy initialization
export async function createDatabase(projectRoot, config = databaseConfig) {
  switch (config.dialect) {
    case 'sqlite': {
      const sqliteManager = new SQLiteManager(projectRoot);
      await sqliteManager.initialize();
      return sqliteManager;
    }
      
    // Future database support can be added here
    // case 'postgresql': {
    //   return new PostgreSQLManager(projectRoot, config);
    // }
    // case 'mysql': {
    //   return new MySQLManager(projectRoot, config);
    // }
      
    default:
      throw new Error(`Unsupported database dialect: ${config.dialect}`);
  }
}

// Convenience function to create a sync engine
export async function createSyncEngine(projectRoot, tasksJsonPath, config = databaseConfig) {
  const dbManager = await createDatabase(projectRoot, config);
  return new SyncEngine(dbManager, tasksJsonPath, config.sync);
} 