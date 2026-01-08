/**
 * @fileoverview Loop Progress Service
 * Manages the progress.txt file for loop execution tracking
 */

import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Entry representing a single progress update
 */
export interface ProgressEntry {
	/** ISO timestamp of when the entry was recorded */
	timestamp: string;
	/** Iteration number (1-indexed) */
	iteration: number;
	/** Task ID being worked on (optional) */
	taskId?: string;
	/** Note describing what happened */
	note: string;
}

/**
 * Service for managing loop progress files
 */
export class LoopProgressService {
	private readonly projectRoot: string;

	constructor(projectRoot: string) {
		this.projectRoot = projectRoot;
	}

	/**
	 * Get the default path for the progress file
	 */
	getDefaultProgressPath(): string {
		return path.join(this.projectRoot, '.taskmaster', 'loop-progress.txt');
	}

	/**
	 * Initialize a new progress file with header information
	 * @param progressFile - Path to the progress file
	 * @param config - Configuration options for the progress header
	 */
	async initializeProgressFile(
		progressFile: string,
		config: { preset: string; iterations: number; tag?: string }
	): Promise<void> {
		// Ensure parent directory exists
		const dir = path.dirname(progressFile);
		await mkdir(dir, { recursive: true });

		// Build header with configuration info
		const lines = [
			'# Task Master Loop Progress',
			`# Started: ${new Date().toISOString()}`,
			`# Preset: ${config.preset}`,
			`# Max Iterations: ${config.iterations}`
		];

		if (config.tag) {
			lines.push(`# Tag: ${config.tag}`);
		}

		lines.push('', '---', '');

		const header = lines.join('\n');
		await writeFile(progressFile, header, 'utf-8');
	}

	/**
	 * Append a progress entry to the progress file
	 * @param progressFile - Path to the progress file
	 * @param entry - Progress entry to append
	 */
	async appendProgress(
		progressFile: string,
		entry: ProgressEntry
	): Promise<void> {
		const taskIdPart = entry.taskId ? ` (Task ${entry.taskId})` : '';
		const line = `[${entry.timestamp}] Iteration ${entry.iteration}${taskIdPart}: ${entry.note}\n`;
		await appendFile(progressFile, line, 'utf-8');
	}

	/**
	 * Read the contents of a progress file
	 * @param progressFile - Path to the progress file
	 * @returns File contents or empty string if file doesn't exist
	 */
	async readProgress(progressFile: string): Promise<string> {
		try {
			return await readFile(progressFile, 'utf-8');
		} catch {
			return '';
		}
	}

	/**
	 * Check if a progress file exists and is accessible
	 * @param progressFile - Path to the progress file
	 * @returns True if file exists and is accessible, false otherwise
	 */
	async exists(progressFile: string): Promise<boolean> {
		try {
			await access(progressFile);
			return true;
		} catch {
			return false;
		}
	}
}
