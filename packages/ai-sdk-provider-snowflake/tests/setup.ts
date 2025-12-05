/**
 * Jest test setup file
 *
 * Runs before all tests in each worker to:
 * 1. Load environment variables from root .env file
 * 2. Log the test environment status (credentials, CLI)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { logEnvironmentStatus } from './test-utils.js';

// Load environment variables from root .env file FIRST
// This must happen before test-utils.ts checks credentials
const rootEnvPath = resolve(__dirname, '../../../.env');
config({ path: rootEnvPath });

console.log('🔧 Test setup complete - loaded .env from:', rootEnvPath);

// Log environment status once at startup
logEnvironmentStatus();
