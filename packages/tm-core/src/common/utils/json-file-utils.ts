/**
 * @fileoverview Simple JSON file utilities for reading and writing JSON files
 * Provides atomic writes without cross-process locking (simpler than FileOperations)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Read and parse a JSON file
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON data
 * @throws Error if file doesn't exist (ENOENT) or has invalid JSON
 */
export async function readJSON<T = any>(filePath: string): Promise<T> {
	try {
		const content = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(content) as T;
	} catch (error: any) {
		if (error.code === 'ENOENT') {
			throw error; // Re-throw ENOENT for caller to handle
		}
		if (error instanceof SyntaxError) {
			throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
		}
		throw new Error(`Failed to read file ${filePath}: ${error.message}`);
	}
}

/**
 * Write data to a JSON file with atomic operation (temp file + rename)
 * @param filePath - Path to the JSON file
 * @param data - Data to write (will be JSON.stringify'd)
 */
export async function writeJSON(filePath: string, data: any): Promise<void> {
	// Ensure directory exists
	await fs.mkdir(path.dirname(filePath), { recursive: true });

	// Atomic write: temp file + rename
	const tempPath = `${filePath}.tmp`;
	await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
	await fs.rename(tempPath, filePath);
}
