/**
 * Context storage for app-specific user preferences
 *
 * This store manages user preferences and context separate from auth tokens.
 * - selectedContext (org/brief selection)
 * - userId and email (for convenience)
 * - Any other app-specific data
 *
 * Stored at: ~/.taskmaster/context.json
 */

import fs from 'fs';
import path from 'path';
import { UserContext, AuthenticationError } from '../types.js';
import { getLogger } from '../../../common/logger/index.js';

const DEFAULT_CONTEXT_FILE = path.join(
	process.env.HOME || process.env.USERPROFILE || '~',
	'.taskmaster',
	'context.json'
);

export interface StoredContext {
	userId?: string;
	email?: string;
	selectedContext?: UserContext;
	lastUpdated: string;
}

export class ContextStore {
	private static instance: ContextStore | null = null;
	private logger = getLogger('ContextStore');
	private contextPath: string;

	private constructor(contextPath: string = DEFAULT_CONTEXT_FILE) {
		this.contextPath = contextPath;
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(contextPath?: string): ContextStore {
		if (!ContextStore.instance) {
			ContextStore.instance = new ContextStore(contextPath);
		}
		return ContextStore.instance;
	}

	/**
	 * Reset singleton (for testing)
	 */
	static resetInstance(): void {
		ContextStore.instance = null;
	}

	/**
	 * Get stored context
	 */
	getContext(): StoredContext | null {
		try {
			if (!fs.existsSync(this.contextPath)) {
				return null;
			}

			const data = JSON.parse(fs.readFileSync(this.contextPath, 'utf8'));
			this.logger.debug('Loaded context from disk');
			return data;
		} catch (error) {
			this.logger.error('Failed to read context:', error);
			return null;
		}
	}

	/**
	 * Save context
	 */
	saveContext(context: Partial<StoredContext>): void {
		try {
			// Load existing context
			const existing = this.getContext() || {};

			// Merge with new data
			const updated: StoredContext = {
				...existing,
				...context,
				lastUpdated: new Date().toISOString()
			};

			// Ensure directory exists
			const dir = path.dirname(this.contextPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
			}

			// Write atomically
			const tempFile = `${this.contextPath}.tmp`;
			fs.writeFileSync(tempFile, JSON.stringify(updated, null, 2), {
				mode: 0o600
			});
			fs.renameSync(tempFile, this.contextPath);

			this.logger.debug('Saved context to disk');
		} catch (error) {
			throw new AuthenticationError(
				`Failed to save context: ${(error as Error).message}`,
				'SAVE_FAILED',
				error
			);
		}
	}

	/**
	 * Update user context (org/brief selection)
	 */
	updateUserContext(userContext: Partial<UserContext>): void {
		const existing = this.getContext();
		const currentUserContext = existing?.selectedContext || {};

		const updated: UserContext = {
			...currentUserContext,
			...userContext,
			updatedAt: new Date().toISOString()
		};

		this.saveContext({
			...existing,
			selectedContext: updated
		});
	}

	/**
	 * Get user context (org/brief selection)
	 */
	getUserContext(): UserContext | null {
		const context = this.getContext();
		return context?.selectedContext || null;
	}

	/**
	 * Clear user context
	 */
	clearUserContext(): void {
		const existing = this.getContext();
		if (existing) {
			const { selectedContext, ...rest } = existing;
			this.saveContext(rest);
		}
	}

	/**
	 * Clear all context
	 */
	clearContext(): void {
		try {
			if (fs.existsSync(this.contextPath)) {
				fs.unlinkSync(this.contextPath);
				this.logger.debug('Cleared context from disk');
			}
		} catch (error) {
			throw new AuthenticationError(
				`Failed to clear context: ${(error as Error).message}`,
				'CLEAR_FAILED',
				error
			);
		}
	}

	/**
	 * Check if context exists
	 */
	hasContext(): boolean {
		return this.getContext() !== null;
	}

	/**
	 * Get context file path
	 */
	getContextPath(): string {
		return this.contextPath;
	}
}
