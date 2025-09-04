/**
 * Credential storage and management
 */

import fs from 'fs';
import { AuthCredentials, AuthenticationError, AuthConfig } from './types';
import { getAuthConfig } from './config';
import { getLogger } from '../logger';

export class CredentialStore {
	private logger = getLogger('CredentialStore');
	private config: AuthConfig;

	constructor(config?: Partial<AuthConfig>) {
		this.config = getAuthConfig(config);
	}

	/**
	 * Get stored authentication credentials
	 */
	getCredentials(options?: { allowExpired?: boolean }): AuthCredentials | null {
		try {
			if (!fs.existsSync(this.config.configFile)) {
				return null;
			}

			const authData = JSON.parse(
				fs.readFileSync(this.config.configFile, 'utf-8')
			) as AuthCredentials;

			// Check if token is expired
			if (
				authData.expiresAt &&
				new Date(authData.expiresAt) < new Date() &&
				!options?.allowExpired
			) {
				this.logger.warn('Authentication token has expired');
				return null;
			}

			return authData;
		} catch (error) {
			this.logger.error(
				`Failed to read auth credentials: ${(error as Error).message}`
			);
			return null;
		}
	}

	/**
	 * Save authentication credentials
	 */
	saveCredentials(authData: AuthCredentials): void {
		try {
			// Ensure directory exists
			if (!fs.existsSync(this.config.configDir)) {
				fs.mkdirSync(this.config.configDir, { recursive: true, mode: 0o700 });
			}

			// Add timestamp
			authData.savedAt = new Date().toISOString();

			// Save credentials atomically with secure permissions
			const tempFile = `${this.config.configFile}.tmp`;
			fs.writeFileSync(tempFile, JSON.stringify(authData, null, 2), {
				mode: 0o600
			});
			fs.renameSync(tempFile, this.config.configFile);
		} catch (error) {
			throw new AuthenticationError(
				`Failed to save auth credentials: ${(error as Error).message}`,
				'SAVE_FAILED',
				error
			);
		}
	}

	/**
	 * Clear stored credentials
	 */
	clearCredentials(): void {
		try {
			if (fs.existsSync(this.config.configFile)) {
				fs.unlinkSync(this.config.configFile);
			}
		} catch (error) {
			throw new AuthenticationError(
				`Failed to clear credentials: ${(error as Error).message}`,
				'CLEAR_FAILED',
				error
			);
		}
	}

	/**
	 * Check if credentials exist and are valid
	 */
	hasValidCredentials(): boolean {
		const credentials = this.getCredentials({ allowExpired: false });
		return credentials !== null;
	}

	/**
	 * Get configuration
	 */
	getConfig(): AuthConfig {
		return { ...this.config };
	}
}
