/**
 * @fileoverview Auth Domain Facade
 * Public API for authentication and authorization
 */

import path from 'node:path';
import { AuthManager } from './managers/auth-manager.js';
import type {
	AuthCredentials,
	OAuthFlowOptions,
	UserContext
} from './types.js';
import type {
	Organization,
	Brief,
	RemoteTask
} from './services/organization.service.js';
import type { StorageType } from '../../common/types/index.js';

/**
 * Display information for storage context
 */
export interface StorageDisplayInfo {
	storageType: Exclude<StorageType, 'auto'>;
	briefInfo?: {
		briefId: string;
		briefName: string;
		orgSlug?: string;
		webAppUrl?: string;
	};
	filePath?: string;
}

/**
 * Auth Domain - Unified API for authentication operations
 */
export class AuthDomain {
	private authManager: AuthManager;

	constructor() {
		this.authManager = AuthManager.getInstance();
	}

	// ========== Authentication ==========

	/**
	 * Check if valid Supabase session exists
	 */
	async hasValidSession(): Promise<boolean> {
		return this.authManager.hasValidSession();
	}

	/**
	 * Get the current Supabase session with full details
	 */
	async getSession() {
		return this.authManager.getSession();
	}

	/**
	 * Get stored user context (userId, email)
	 */
	getStoredContext() {
		return this.authManager.getStoredContext();
	}

	/**
	 * Get stored credentials
	 */
	async getCredentials(): Promise<AuthCredentials | null> {
		return this.authManager.getAuthCredentials();
	}

	/**
	 * Get access token from current session
	 */
	async getAccessToken(): Promise<string | null> {
		return this.authManager.getAccessToken();
	}

	/**
	 * Authenticate with OAuth flow
	 */
	async authenticateWithOAuth(
		options?: OAuthFlowOptions
	): Promise<AuthCredentials> {
		return this.authManager.authenticateWithOAuth(options);
	}

	/**
	 * Authenticate using a one-time token
	 * Useful for CLI authentication in SSH/remote environments
	 */
	async authenticateWithCode(token: string): Promise<AuthCredentials> {
		return this.authManager.authenticateWithCode(token);
	}

	/**
	 * Get OAuth authorization URL
	 */
	getAuthorizationUrl(): string | null {
		return this.authManager.getAuthorizationUrl();
	}

	/**
	 * Refresh authentication token
	 */
	async refreshToken(): Promise<AuthCredentials> {
		return this.authManager.refreshToken();
	}

	/**
	 * Logout current user
	 */
	async logout(): Promise<void> {
		return this.authManager.logout();
	}

	// ========== User Context Management ==========

	/**
	 * Get current user context (org/brief selection)
	 */
	getContext(): UserContext | null {
		return this.authManager.getContext();
	}

	/**
	 * Update user context
	 */
	async updateContext(context: Partial<UserContext>): Promise<void> {
		return this.authManager.updateContext(context);
	}

	/**
	 * Clear user context
	 */
	async clearContext(): Promise<void> {
		return this.authManager.clearContext();
	}

	// ========== Organization Management ==========

	/**
	 * Get all organizations for the authenticated user
	 */
	async getOrganizations(): Promise<Organization[]> {
		return this.authManager.getOrganizations();
	}

	/**
	 * Get a specific organization by ID
	 */
	async getOrganization(orgId: string): Promise<Organization | null> {
		return this.authManager.getOrganization(orgId);
	}

	/**
	 * Get all briefs for a specific organization
	 */
	async getBriefs(orgId: string): Promise<Brief[]> {
		return this.authManager.getBriefs(orgId);
	}

	/**
	 * Get a specific brief by ID
	 */
	async getBrief(briefId: string): Promise<Brief | null> {
		return this.authManager.getBrief(briefId);
	}

	/**
	 * Get all tasks for a specific brief
	 */
	async getTasks(briefId: string): Promise<RemoteTask[]> {
		return this.authManager.getTasks(briefId);
	}

	// ========== Display Information ==========

	/**
	 * Get storage display information for UI presentation
	 * Includes brief info for API storage, file path for file storage
	 *
	 * @param resolvedStorageType - The actual storage type being used at runtime.
	 *                              Get this from tmCore.tasks.getStorageType()
	 */
	getStorageDisplayInfo(
		resolvedStorageType: 'file' | 'api'
	): StorageDisplayInfo {
		if (resolvedStorageType === 'api') {
			const context = this.getContext();
			if (context?.briefId && context?.briefName) {
				return {
					storageType: 'api',
					briefInfo: {
						briefId: context.briefId,
						briefName: context.briefName,
						orgSlug: context.orgSlug,
						webAppUrl: this.getWebAppUrl()
					}
				};
			}
		}

		// Default to file storage display
		return {
			storageType: 'file',
			filePath: path.join('.taskmaster', 'tasks', 'tasks.json')
		};
	}

	/**
	 * Get web app base URL from environment configuration
	 * @private
	 */
	private getWebAppUrl(): string | undefined {
		const baseDomain =
			process.env.TM_BASE_DOMAIN || process.env.TM_PUBLIC_BASE_DOMAIN;

		if (!baseDomain) {
			return undefined;
		}

		// If it already includes protocol, use as-is
		if (baseDomain.startsWith('http://') || baseDomain.startsWith('https://')) {
			return baseDomain;
		}

		// Otherwise, add protocol based on domain
		if (baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1')) {
			return `http://${baseDomain}`;
		}

		return `https://${baseDomain}`;
	}
}
