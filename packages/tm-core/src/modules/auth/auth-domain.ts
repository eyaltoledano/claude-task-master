/**
 * @fileoverview Auth Domain Facade
 * Public API for authentication and authorization
 */

import { AuthManager } from './managers/auth-manager.js';
import type {
	AuthCredentials,
	OAuthFlowOptions,
	UserContext
} from './types.js';
import type { Organization, Brief, RemoteTask } from './services/organization.service.js';

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
	 * Check if user is authenticated
	 */
	isAuthenticated(): boolean {
		return this.authManager.isAuthenticated();
	}

	/**
	 * Get stored credentials
	 */
	getCredentials(): AuthCredentials | null {
		return this.authManager.getCredentials();
	}

	/**
	 * Authenticate with OAuth flow
	 */
	async authenticateWithOAuth(options?: OAuthFlowOptions): Promise<AuthCredentials> {
		return this.authManager.authenticateWithOAuth(options);
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
	updateContext(context: Partial<UserContext>): void {
		return this.authManager.updateContext(context);
	}

	/**
	 * Clear user context
	 */
	clearContext(): void {
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
}
