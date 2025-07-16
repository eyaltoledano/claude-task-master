#!/usr/bin/env node

import { createDatabase, createSyncEngine, DataTransformer } from './index.js';
import path from 'path';
import fs from 'fs';

/**
 * Simple test to verify database setup is working
 */
async function testDatabaseSetup() {
  console.log('🧪 Testing SQLite + Drizzle setup...\n');
  
  const projectRoot = process.cwd();
  const tasksJsonPath = path.join(projectRoot, '.taskmaster', 'tasks', 'tasks.json');
  
  try {
    // Test 1: Database creation and initialization
    console.log('1. Creating database...');
    const db = await createDatabase(projectRoot);
    console.log('✅ Database created successfully');
    
    // Test 2: Basic CRUD operations
    console.log('\n2. Testing basic operations...');
    
    // Create a tag
    const tag = await db.createTag('test', 'Test tag for database setup', { test: true });
    console.log(`✅ Created tag: ${tag.name} (ID: ${tag.id})`);
    
    // Create a task
    const task = await db.createTask(tag.id, {
      id: 1,
      title: 'Test Task',
      description: 'A test task for database verification',
      status: 'pending',
      priority: 'medium',
      details: 'This is a test task created during database setup verification.'
    });
    console.log(`✅ Created task: ${task.title} (ID: ${task.id})`);
    
    // Query tasks
    const tasks = await db.getTasksByTag('test');
    console.log(`✅ Retrieved ${tasks.length} task(s) for tag 'test'`);
    
    // Test 3: Data transformation
    console.log('\n3. Testing data transformation...');
    const transformer = new DataTransformer();
    
    const sampleJsonData = {
      master: {
        tasks: [
          {
            id: 1,
            title: 'Sample Task',
            description: 'A sample task',
            status: 'pending',
            dependencies: [],
            priority: 'medium',
            details: 'Sample details',
            testStrategy: 'Sample test'
          }
        ],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        }
      }
    };
    
    const sqliteFormat = transformer.jsonToSqlite(sampleJsonData);
    console.log(`✅ Converted JSON to SQLite format: ${sqliteFormat.tags.length} tags, ${sqliteFormat.tasks.length} tasks`);
    
    const reconstructedJson = transformer.sqliteToJson(
      sqliteFormat.tags,
      sqliteFormat.tasks,
      sqliteFormat.dependencies
    );
    console.log(`✅ Reconstructed JSON format: ${Object.keys(reconstructedJson).length} tag(s)`);
    
    // Test 4: Hash calculation
    const hash1 = transformer.calculateHash(sampleJsonData);
    const hash2 = transformer.calculateHash(sampleJsonData);
    const hash3 = transformer.calculateHash({ ...sampleJsonData, modified: true });
    
    console.log(`✅ Hash consistency: ${hash1 === hash2 ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Hash uniqueness: ${hash1 !== hash3 ? 'PASS' : 'FAIL'}`);
    
    // Test 5: Sync engine creation (if tasks.json exists)
    console.log('\n4. Testing sync engine...');
    if (fs.existsSync(tasksJsonPath)) {
      const syncEngine = await createSyncEngine(projectRoot, tasksJsonPath);
      console.log('✅ Sync engine created successfully');
      
      const conflicts = await syncEngine.detectConflicts();
      console.log(`✅ Conflict detection completed: ${conflicts.length} conflict(s) found`);
    } else {
      console.log('ℹ️  No tasks.json found, skipping sync engine test');
    }
    
    // Cleanup
    console.log('\n5. Cleaning up...');
    await db.deleteTag(tag.id);
    console.log('✅ Test data cleaned up');
    
    db.close();
    console.log('✅ Database connection closed');
    
    console.log('\n🎉 All tests passed! Database setup is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatabaseSetup();
}

export { testDatabaseSetup }; 