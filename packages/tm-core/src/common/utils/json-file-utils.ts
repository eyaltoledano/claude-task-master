/**
 * @fileoverview Simple JSON file utilities for reading and writing JSON files
 * Provides atomic writes without cross-process locking (simpler than FileOperations)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getLogger } from '../logger/index.js';

const log = getLogger('json-file-utils');

/**
 * Read and parse a JSON file.
 * Returns null on any failure (ENOENT, invalid JSON, permission errors, etc.)
 * and logs the error details.
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON data, or null on failure
 */
export async function readJSON<T = any>(filePath: string): Promise<T | null> {
	const resolved = path.resolve(filePath);
	try {
		const content = await fs.readFile(resolved, 'utf-8');
		return JSON.parse(content) as T;
	} catch (error: any) {
		if (error.code === 'ENOENT') {
			log.debug('File not found', { filePath: resolved });
		} else if (error instanceof SyntaxError) {
			log.error('Invalid JSON in file', {
				filePath: resolved,
				error: error.message
			});
		} else {
			log.error('Failed to read file', {
				filePath: resolved,
				error: error.message
			});
		}
		return null;
	}
}

/**
 * Write data to a JSON file with atomic operation (temp file + rename).
 * Returns true on success, false on failure. Cleans up temp file on error.
 * @param filePath - Path to the JSON file
 * @param data - Data to write (will be JSON.stringify'd)
 * @returns true if write succeeded, false otherwise
 */
export async function writeJSON(filePath: string, data: any): Promise<boolean> {
	const tempPath = `${filePath}.tmp`;
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
		await fs.rename(tempPath, filePath);
		return true;
	} catch (error: any) {
		log.error('Failed to write JSON file', {
			filePath,
			error: error.message
		});
		// Best-effort cleanup of temp file
		try {
			await fs.unlink(tempPath);
		} catch {
			// Temp file may not exist, ignore
		}
		return false;
	}
}
