/**
 * Credential storage and management
 */

import fs from 'fs';
import path from 'path';
import { AuthCredentials, AuthenticationError, AuthConfig } from './types.js';
import { getAuthConfig } from './config.js';
import { getLogger } from '../logger/index.js';

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

			// Parse expiration time for validation (expects ISO string format)
			let expiresAtMs: number | undefined;
			
			if (authData.expiresAt) {
				expiresAtMs = Date.parse(authData.expiresAt);
				if (isNaN(expiresAtMs)) {
					// Invalid date string - treat as expired
					this.logger.error(`Invalid expiresAt format: ${authData.expiresAt}`);
					return null;
				}
			}

			// Check if token is expired (API keys never expire)
			const isApiKey = authData.tokenType === 'api_key';
			if (
				!isApiKey &&
				expiresAtMs &&
				expiresAtMs < Date.now() &&
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

			// Quarantine corrupt file to prevent repeated errors
			try {
				if (fs.existsSync(this.config.configFile)) {
					const corruptFile = `${this.config.configFile}.corrupt-${Date.now()}`;
					fs.renameSync(this.config.configFile, corruptFile);
					this.logger.warn(`Quarantined corrupt auth file to: ${corruptFile}`);
				}
			} catch (quarantineError) {
				// If we can't quarantine, log but don't throw
				this.logger.debug(
					`Could not quarantine corrupt file: ${(quarantineError as Error).message}`
				);
			}

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
			
			// Validate expiresAt is a valid ISO string if present
			if (authData.expiresAt) {
				const ms = Date.parse(authData.expiresAt);
				if (isNaN(ms)) {
					throw new AuthenticationError(
						`Invalid expiresAt format: ${authData.expiresAt}`,
						'SAVE_FAILED'
					);
				}
			}

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

	/**
	 * Clean up old corrupt auth files
	 * Removes corrupt files older than the specified age
	 */
	cleanupCorruptFiles(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
		try {
			const dir = path.dirname(this.config.configFile);
			const baseName = path.basename(this.config.configFile);
			const corruptPattern = new RegExp(`^${baseName}\\.corrupt-\\d+$`);

			if (!fs.existsSync(dir)) {
				return;
			}

			const files = fs.readdirSync(dir);
			const now = Date.now();

			for (const file of files) {
				if (corruptPattern.test(file)) {
					const filePath = path.join(dir, file);
					try {
						const stats = fs.statSync(filePath);
						const age = now - stats.mtimeMs;

						if (age > maxAgeMs) {
							fs.unlinkSync(filePath);
							this.logger.debug(`Cleaned up old corrupt file: ${file}`);
						}
					} catch (error) {
						// Ignore errors for individual file cleanup
						this.logger.debug(
							`Could not clean up corrupt file ${file}: ${(error as Error).message}`
						);
					}
				}
			}
		} catch (error) {
			// Log but don't throw - this is a cleanup operation
			this.logger.debug(
				`Error during corrupt file cleanup: ${(error as Error).message}`
			);
		}
	}
}
