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
import { getLogger } from '../../../common/logger/index.js';
import { getWorkspaceContextPath } from '../../../common/utils/workspace-path.js';
import { AuthenticationError, UserContext } from '../types.js';

const GLOBAL_CONTEXT_FILE = path.join(
	process.env.HOME || process.env.USERPROFILE || '~',
	'.taskmaster',
	'context.json'
);

export interface ContextStoreOptions {
	/** Project root for workspace-scoped context. If omitted, uses global path. */
	projectRoot?: string;
	/** Explicit context file path (overrides projectRoot). For testing. */
	contextPath?: string;
}

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

	private constructor(options: ContextStoreOptions = {}) {
		if (options.contextPath) {
			this.contextPath = options.contextPath;
		} else if (options.projectRoot) {
			this.contextPath = getWorkspaceContextPath(options.projectRoot);
		} else {
			this.contextPath = GLOBAL_CONTEXT_FILE;
		}
	}

	/**
	 * Get singleton instance
	 *
	 * @param options - Configuration options. projectRoot scopes context
	 *   to a workspace directory (~/.taskmaster/{projectId}/context.json).
	 *   Without projectRoot, falls back to global ~/.taskmaster/context.json.
	 */
	static getInstance(options?: ContextStoreOptions | string): ContextStore {
		// Backwards compat: accept a string as contextPath
		const opts: ContextStoreOptions =
			typeof options === 'string' ? { contextPath: options } : options ?? {};

		if (!ContextStore.instance) {
			ContextStore.instance = new ContextStore(opts);
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
	 * Atomically write data to the context file.
	 * Ensures directory exists and uses temp-file + rename for crash safety.
	 */
	private writeContextFile(data: StoredContext): void {
		const dir = path.dirname(this.contextPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		}

		const tempFile = `${this.contextPath}.tmp`;
		fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), {
			mode: 0o600
		});
		fs.renameSync(tempFile, this.contextPath);
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
	 * Save context (merges with existing data on disk)
	 */
	saveContext(context: Partial<StoredContext>): void {
		try {
			const existing = this.getContext() || {};
			const updated: StoredContext = {
				...existing,
				...context,
				lastUpdated: new Date().toISOString()
			};
			this.writeContextFile(updated);
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
	 * Clear user context (org/brief selection)
	 *
	 * Writes directly via writeContextFile instead of saveContext(),
	 * which re-merges with existing data and would restore selectedContext.
	 */
	clearUserContext(): void {
		const existing = this.getContext();
		if (existing) {
			const { selectedContext, ...rest } = existing;
			this.writeContextFile({
				...rest,
				lastUpdated: new Date().toISOString()
			} as StoredContext);
			this.logger.debug('Cleared user context from disk');
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
	 * Scope context storage to a specific workspace.
	 * Call this before any read/write to ensure context is workspace-isolated.
	 * Safe to call multiple times — only updates if path actually changes.
	 */
	setProjectRoot(projectRoot: string): void {
		const scopedPath = getWorkspaceContextPath(projectRoot);
		if (this.contextPath !== scopedPath) {
			this.logger.debug(
				`Scoping context to workspace: ${scopedPath}`
			);
			this.contextPath = scopedPath;
		}
	}

	/**
	 * Get context file path
	 */
	getContextPath(): string {
		return this.contextPath;
	}
}
