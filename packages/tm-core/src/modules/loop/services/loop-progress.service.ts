/**
 * @fileoverview Loop Progress Service
 * Manages the progress.txt file for loop execution tracking
 */

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
}
