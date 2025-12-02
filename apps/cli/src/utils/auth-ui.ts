/**
 * @fileoverview Shared Auth UI Utilities
 * Provides reusable UI components for authentication flows:
 * - Countdown timer with spinner
 * - MFA code prompting
 *
 * These are presentation-layer concerns that use ora, inquirer, and chalk.
 */

import {
	AUTH_TIMEOUT_MS,
	type AuthCredentials,
	AuthenticationError,
	MFA_MAX_ATTEMPTS,
	type OAuthFlowOptions
} from '@tm/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import open from 'open';
import ora, { type Ora } from 'ora';
import * as ui from './ui.js';

// Re-export constants for convenience
export { AUTH_TIMEOUT_MS, MFA_MAX_ATTEMPTS };

/**
 * Countdown timer state
 */
export interface CountdownState {
	interval: NodeJS.Timeout | null;
	spinner: Ora | null;
}

/**
 * Creates and manages an authentication countdown timer
 * Displays a spinner with remaining time during OAuth flow
 */
export class AuthCountdownTimer {
	private interval: NodeJS.Timeout | null = null;
	private spinner: Ora | null = null;
	private readonly totalMs: number;

	constructor(totalMs: number = AUTH_TIMEOUT_MS) {
		this.totalMs = totalMs;
	}

	/**
	 * Start the countdown timer
	 */
	start(): void {
		const startTime = Date.now();
		const endTime = startTime + this.totalMs;

		const updateCountdown = () => {
			const remaining = Math.max(0, endTime - Date.now());
			const mins = Math.floor(remaining / 60000);
			const secs = Math.floor((remaining % 60000) / 1000);
			const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

			if (this.spinner) {
				this.spinner.text = `Waiting for authentication... ${chalk.cyan(timeStr)} remaining`;
			}

			if (remaining <= 0 && this.interval) {
				clearInterval(this.interval);
			}
		};

		const initialMins = Math.floor(this.totalMs / 60000);
		const initialSecs = Math.floor((this.totalMs % 60000) / 1000);
		const initialTimeStr = `${initialMins}:${initialSecs.toString().padStart(2, '0')}`;

		this.spinner = ora({
			text: `Waiting for authentication... ${chalk.cyan(initialTimeStr)} remaining`,
			spinner: 'dots'
		}).start();

		this.interval = setInterval(updateCountdown, 1000);
	}

	/**
	 * Stop the countdown timer
	 * @param result - 'success', 'failure', or 'mfa' (MFA required, not success/failure)
	 */
	stop(result: 'success' | 'failure' | 'mfa'): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		if (this.spinner) {
			if (result === 'mfa') {
				this.spinner.stop(); // MFA required, not success/failure
			} else if (result === 'success') {
				this.spinner.succeed('Authentication successful!');
			} else {
				this.spinner.fail('Authentication failed');
			}
			this.spinner = null;
		}
	}

	/**
	 * Ensure cleanup even if not explicitly stopped
	 */
	cleanup(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		if (this.spinner) {
			this.spinner.stop();
			this.spinner = null;
		}
	}
}

/**
 * Display MFA required message
 */
export function displayMFARequired(): void {
	console.log(
		chalk.yellow('\n⚠️  Multi-factor authentication is enabled on your account')
	);
	console.log(
		chalk.white('  Please enter the 6-digit code from your authenticator app\n')
	);
}

/**
 * Prompt for MFA code with validation
 * @returns The entered MFA code or throws if cancelled
 */
export async function promptForMFACode(): Promise<string> {
	try {
		const response = await inquirer.prompt([
			{
				type: 'input',
				name: 'mfaCode',
				message: 'Enter your 6-digit MFA code:',
				validate: (input: string) => {
					const trimmed = (input || '').trim();

					if (trimmed.length === 0) {
						return 'MFA code cannot be empty';
					}

					if (!/^\d{6}$/.test(trimmed)) {
						return 'MFA code must be exactly 6 digits (0-9)';
					}

					return true;
				}
			}
		]);

		return response.mfaCode.trim();
	} catch (error: any) {
		// Handle user cancellation (Ctrl+C)
		if (
			error.name === 'ExitPromptError' ||
			error.message?.includes('force closed')
		) {
			ui.displayWarning(' MFA verification cancelled by user');
			throw new AuthenticationError(
				'MFA verification cancelled',
				'MFA_VERIFICATION_FAILED'
			);
		}
		throw error;
	}
}

/**
 * Display MFA verification success
 */
export function displayMFASuccess(): void {
	console.log(chalk.green('\n✓ MFA verification successful!'));
}

/**
 * Display invalid MFA code message
 * @param remaining - Number of attempts remaining
 */
export function displayInvalidMFACode(remaining: number): void {
	if (remaining > 0) {
		ui.displayError(`Invalid MFA code. Please try again.`);
	}
}

/**
 * Display authentication URL and instructions
 * @param authUrl - The OAuth URL to display
 */
export function displayAuthInstructions(authUrl: string): void {
	console.log(chalk.blue.bold('\n[auth] Browser Authentication\n'));
	console.log(chalk.white('  Opening your browser to authenticate...'));
	console.log(chalk.gray("  If the browser doesn't open, visit:"));
	console.log(chalk.cyan.underline(`  ${authUrl}\n`));
}

/**
 * Display waiting for auth message
 */
export function displayWaitingForAuth(): void {
	console.log(
		chalk.dim('  If you signed up, check your email to confirm your account.')
	);
	console.log(
		chalk.dim('  The CLI will automatically detect when you log in.\n')
	);
}

/**
 * MFA verification options for verifyMFAWithRetry
 */
export interface MFAVerificationUIOptions {
	maxAttempts?: number;
	onInvalidCode?: (attempt: number, remaining: number) => void;
}

/**
 * Create standard MFA verification callbacks
 * These can be passed to AuthDomain.verifyMFAWithRetry or AuthManager.verifyMFAWithRetry
 */
export function createMFACallbacks(options: MFAVerificationUIOptions = {}) {
	return {
		promptCallback: promptForMFACode,
		options: {
			maxAttempts: options.maxAttempts ?? MFA_MAX_ATTEMPTS,
			onInvalidCode: options.onInvalidCode ?? displayInvalidMFACode
		}
	};
}

/**
 * Handle complete MFA verification flow
 * @param authDomainOrManager - AuthDomain or AuthManager instance
 * @param factorId - The MFA factor ID
 * @returns AuthCredentials on success
 */
export async function handleMFAFlow(
	verifyMFAWithRetry: (
		factorId: string,
		promptCallback: () => Promise<string>,
		options: {
			maxAttempts: number;
			onInvalidCode: (attempt: number, remaining: number) => void;
		}
	) => Promise<{
		success: boolean;
		credentials?: AuthCredentials;
		attemptsUsed: number;
	}>,
	factorId: string
): Promise<AuthCredentials> {
	displayMFARequired();

	const { promptCallback, options } = createMFACallbacks();

	const result = await verifyMFAWithRetry(factorId, promptCallback, options);

	if (result.success && result.credentials) {
		displayMFASuccess();
		return result.credentials;
	}

	throw new AuthenticationError(
		`MFA verification failed after ${result.attemptsUsed} attempts`,
		'MFA_VERIFICATION_FAILED'
	);
}

/**
 * Authentication provider interface for browser OAuth with MFA
 * Can be satisfied by either AuthManager or AuthDomain
 */
export interface BrowserAuthProvider {
	authenticateWithOAuth(options?: OAuthFlowOptions): Promise<AuthCredentials>;
	verifyMFAWithRetry(
		factorId: string,
		codeProvider: () => Promise<string>,
		options?: {
			maxAttempts?: number;
			onInvalidCode?: (attempt: number, remaining: number) => void;
		}
	): Promise<{
		success: boolean;
		credentials?: AuthCredentials;
		attemptsUsed: number;
	}>;
}

/**
 * Shared browser authentication with MFA support
 *
 * This is the SINGLE implementation of browser-based OAuth login with MFA handling.
 * Used by both the auth login command and any protected commands that trigger login
 * (like parse-prd when "Bring it to Hamster" is selected).
 *
 * @param authProvider - AuthManager or AuthDomain instance
 * @returns AuthCredentials on success
 * @throws AuthenticationError on failure
 *
 * @example
 * ```typescript
 * // From auth command
 * const authManager = AuthManager.getInstance();
 * const credentials = await authenticateWithBrowserMFA(authManager);
 *
 * // From auth-guard (for protected commands)
 * const authDomain = new AuthDomain();
 * const credentials = await authenticateWithBrowserMFA(authDomain);
 * ```
 */
export async function authenticateWithBrowserMFA(
	authProvider: BrowserAuthProvider
): Promise<AuthCredentials> {
	const countdownTimer = new AuthCountdownTimer(AUTH_TIMEOUT_MS);

	try {
		const credentials = await authProvider.authenticateWithOAuth({
			// Callback to handle browser opening
			openBrowser: async (authUrl: string) => {
				await open(authUrl);
			},
			timeout: AUTH_TIMEOUT_MS,

			// Callback when auth URL is ready
			onAuthUrl: (authUrl: string) => {
				displayAuthInstructions(authUrl);
			},

			// Callback when waiting for authentication
			onWaitingForAuth: () => {
				displayWaitingForAuth();
				countdownTimer.start();
			},

			// Callback on success
			onSuccess: () => {
				countdownTimer.stop('success');
			},

			// Don't handle onError here - we need to check error type in catch block
			// to differentiate between MFA_REQUIRED (not a failure) and actual failures
			onError: () => {
				// Timer will be stopped in catch block with appropriate status
			}
		});

		return credentials;
	} catch (error: unknown) {
		// Check if MFA is required BEFORE showing failure message
		if (error instanceof AuthenticationError && error.code === 'MFA_REQUIRED') {
			// Stop spinner without showing failure - MFA is required, not a failure
			countdownTimer.stop('mfa');

			if (!error.mfaChallenge?.factorId) {
				throw new AuthenticationError(
					'MFA challenge information missing',
					'MFA_VERIFICATION_FAILED'
				);
			}

			// Use shared MFA flow handler
			return handleMFAFlow(
				authProvider.verifyMFAWithRetry.bind(authProvider),
				error.mfaChallenge.factorId
			);
		}

		// Only show failure for actual errors, not MFA requirement
		countdownTimer.stop('failure');
		throw error;
	} finally {
		// Ensure cleanup
		countdownTimer.cleanup();
	}
}
