/**
 * Jest test setup file
 * Loads environment variables from root .env file
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env file
const rootEnvPath = resolve(__dirname, '../../../.env');
config({ path: rootEnvPath });

console.log('🔧 Test setup complete - loaded .env from:', rootEnvPath);

