import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Copy configuration files from main project to test directory
 * @param {string} testDir - The test directory path
 */
export function copyConfigFiles(testDir) {
    // Copy .env file if it exists
    const mainEnvPath = join(process.cwd(), '.env');
    const testEnvPath = join(testDir, '.env');
    if (existsSync(mainEnvPath)) {
        const envContent = readFileSync(mainEnvPath, 'utf8');
        writeFileSync(testEnvPath, envContent);
    }

    // Copy config.json file if it exists
    const mainConfigPath = join(process.cwd(), '.taskmaster/config.json');
    const testConfigDir = join(testDir, '.taskmaster');
    const testConfigPath = join(testConfigDir, 'config.json');
    if (existsSync(mainConfigPath)) {
        if (!existsSync(testConfigDir)) {
            mkdirSync(testConfigDir, { recursive: true });
        }
        const configContent = readFileSync(mainConfigPath, 'utf8');
        writeFileSync(testConfigPath, configContent);
    }
}