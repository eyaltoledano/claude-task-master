/**
 * GitHub Authentication Service for Flow TUI
 * Implements GitHub Device Flow for seamless CLI authentication
 * Based on Task Master research recommendations
 */

import { GitHub } from 'arctic';
import open from 'open';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class GitHubAuthService {
	constructor(options = {}) {
		this.clientId = options.clientId || process.env.GITHUB_CLIENT_ID;
		this.clientSecret =
			options.clientSecret || process.env.GITHUB_CLIENT_SECRET;
		this.scopes = options.scopes || ['repo', 'user:email'];

		if (!this.clientId || !this.clientSecret) {
			throw new Error(
				'GitHub Client ID and Secret are required. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.'
			);
		}

		this.github = new GitHub(this.clientId, this.clientSecret);
		this.tokenPath = path.join(
			os.homedir(),
			'.taskmaster',
			'github-token.json'
		);
	}

	/**
	 * Start GitHub Device Flow authentication
	 * Returns user code and verification URL for CLI display
	 */
	async startDeviceFlow() {
		const spinner = ora('Requesting GitHub device code...').start();

		try {
			// Step 1: Request device code from GitHub
			const deviceCodeResponse = await this.requestDeviceCode();

			spinner.succeed('Device code received');

			return {
				success: true,
				userCode: deviceCodeResponse.user_code,
				verificationUri: deviceCodeResponse.verification_uri,
				verificationUriComplete: deviceCodeResponse.verification_uri_complete,
				deviceCode: deviceCodeResponse.device_code,
				interval: deviceCodeResponse.interval || 5,
				expiresIn: deviceCodeResponse.expires_in || 900
			};
		} catch (error) {
			spinner.fail('Failed to get device code');
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Poll for access token after user authorization
	 */
	async pollForToken(deviceCode, interval = 5) {
		const spinner = ora('Waiting for GitHub authorization...').start();

		return new Promise((resolve, reject) => {
			const pollInterval = setInterval(async () => {
				try {
					const tokenResponse =
						await this.exchangeDeviceCodeForToken(deviceCode);

					if (tokenResponse.access_token) {
						clearInterval(pollInterval);
						spinner.succeed('GitHub authentication successful!');

						// Store token securely
						await this.storeToken(tokenResponse);

						resolve({
							success: true,
							accessToken: tokenResponse.access_token,
							tokenType: tokenResponse.token_type,
							scope: tokenResponse.scope
						});
					}
				} catch (error) {
					if (error.message.includes('authorization_pending')) {
						// Continue polling
						spinner.text = 'Waiting for authorization... (check your browser)';
					} else if (error.message.includes('slow_down')) {
						// GitHub wants us to slow down
						clearInterval(pollInterval);
						setTimeout(() => {
							this.pollForToken(deviceCode, interval + 5)
								.then(resolve)
								.catch(reject);
						}, 5000);
					} else if (error.message.includes('expired_token')) {
						clearInterval(pollInterval);
						spinner.fail('Device code expired. Please try again.');
						reject(new Error('Device code expired'));
					} else if (error.message.includes('access_denied')) {
						clearInterval(pollInterval);
						spinner.fail('Authorization denied by user.');
						reject(new Error('User denied authorization'));
					} else {
						clearInterval(pollInterval);
						spinner.fail('Authentication failed');
						reject(error);
					}
				}
			}, interval * 1000);
		});
	}

	/**
	 * Complete authentication flow with user interaction
	 */
	async authenticate(options = {}) {
		const { openBrowser = true, showInstructions = true } = options;

		try {
			// Start device flow
			const deviceFlow = await this.startDeviceFlow();

			if (!deviceFlow.success) {
				throw new Error(deviceFlow.error);
			}

			// Display instructions to user
			if (showInstructions) {
				console.log('\n🔐 GitHub Authentication Required');
				console.log('═══════════════════════════════════');
				console.log(`📋 User Code: ${deviceFlow.userCode}`);
				console.log(`🌐 Verification URL: ${deviceFlow.verificationUri}`);

				if (deviceFlow.verificationUriComplete) {
					console.log(`🚀 Direct Link: ${deviceFlow.verificationUriComplete}`);
				}

				console.log('\n📝 Instructions:');
				console.log('1. Visit the verification URL in your browser');
				console.log('2. Enter the user code when prompted');
				console.log('3. Authorize Task Master Flow TUI');
				console.log('4. Return to this terminal\n');
			}

			// Optionally open browser
			if (openBrowser) {
				try {
					const urlToOpen =
						deviceFlow.verificationUriComplete || deviceFlow.verificationUri;
					await open(urlToOpen);
					console.log('🌐 Browser opened automatically\n');
				} catch (error) {
					console.log(
						'⚠️  Could not open browser automatically. Please visit the URL manually.\n'
					);
				}
			}

			// Poll for token
			const tokenResult = await this.pollForToken(
				deviceFlow.deviceCode,
				deviceFlow.interval
			);

			return tokenResult;
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}

	/**
	 * Get stored token if available
	 */
	async getStoredToken() {
		try {
			const tokenData = await fs.readFile(this.tokenPath, 'utf8');
			const parsed = JSON.parse(tokenData);

			// Check if token is still valid (basic check)
			if (parsed.access_token && parsed.stored_at) {
				const storedAt = new Date(parsed.stored_at);
				const now = new Date();
				const hoursSinceStored = (now - storedAt) / (1000 * 60 * 60);

				// GitHub tokens don't expire, but check if it's very old (>30 days)
				if (hoursSinceStored < 24 * 30) {
					return {
						success: true,
						accessToken: parsed.access_token,
						tokenType: parsed.token_type || 'bearer',
						scope: parsed.scope,
						storedAt: parsed.stored_at
					};
				}
			}

			return { success: false, error: 'No valid token found' };
		} catch (error) {
			return { success: false, error: 'No stored token found' };
		}
	}

	/**
	 * Verify token is still valid with GitHub
	 */
	async verifyToken(accessToken) {
		try {
			const response = await fetch('https://api.github.com/user', {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: 'application/vnd.github.v3+json',
					'User-Agent': 'TaskMaster-Flow-TUI'
				}
			});

			if (response.ok) {
				const userData = await response.json();
				return {
					success: true,
					user: {
						login: userData.login,
						name: userData.name,
						email: userData.email,
						avatar_url: userData.avatar_url
					}
				};
			} else {
				return { success: false, error: 'Token verification failed' };
			}
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Logout - remove stored token
	 */
	async logout() {
		try {
			await fs.unlink(this.tokenPath);
			return { success: true, message: 'Logged out successfully' };
		} catch (error) {
			if (error.code === 'ENOENT') {
				return { success: true, message: 'Already logged out' };
			}
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get authentication status
	 */
	async getAuthStatus() {
		const storedToken = await this.getStoredToken();

		if (!storedToken.success) {
			return {
				authenticated: false,
				user: null,
				token: null
			};
		}

		const verification = await this.verifyToken(storedToken.accessToken);

		return {
			authenticated: verification.success,
			user: verification.success ? verification.user : null,
			token: storedToken.success ? storedToken.accessToken : null,
			error: verification.success ? null : verification.error
		};
	}

	// Private methods

	/**
	 * Request device code from GitHub
	 */
	async requestDeviceCode() {
		const response = await fetch('https://github.com/login/device/code', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_id: this.clientId,
				scope: this.scopes.join(' ')
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to request device code: ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Exchange device code for access token
	 */
	async exchangeDeviceCodeForToken(deviceCode) {
		const response = await fetch(
			'https://github.com/login/oauth/access_token',
			{
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					client_id: this.clientId,
					client_secret: this.clientSecret,
					device_code: deviceCode,
					grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
				})
			}
		);

		const data = await response.json();

		if (data.error) {
			throw new Error(data.error);
		}

		return data;
	}

	/**
	 * Store token securely
	 */
	async storeToken(tokenData) {
		try {
			// Ensure directory exists
			const tokenDir = path.dirname(this.tokenPath);
			await fs.mkdir(tokenDir, { recursive: true });

			// Store token with metadata
			const dataToStore = {
				access_token: tokenData.access_token,
				token_type: tokenData.token_type,
				scope: tokenData.scope,
				stored_at: new Date().toISOString()
			};

			await fs.writeFile(this.tokenPath, JSON.stringify(dataToStore, null, 2), {
				mode: 0o600 // Read/write for owner only
			});
		} catch (error) {
			throw new Error(`Failed to store token: ${error.message}`);
		}
	}
}
