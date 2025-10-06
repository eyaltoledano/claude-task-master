import { AuthManager } from '../auth/auth-manager.js';

/**
 * Validates and retrieves the current context for task operations
 */
export class ContextValidator {
	private static instance: ContextValidator;
	private authManager: AuthManager;

	private constructor() {
		this.authManager = AuthManager.getInstance();
	}

	static getInstance(): ContextValidator {
		if (!ContextValidator.instance) {
			ContextValidator.instance = new ContextValidator();
		}
		return ContextValidator.instance;
	}

	/**
	 * Gets the current brief ID from context, throwing if not available
	 * @throws {Error} If no brief is selected
	 * @returns The current brief ID
	 */
	getBriefIdOrThrow(): string {
		const context = this.authManager.getContext();

		if (!context || !context.briefId) {
			throw new Error(
				'No brief selected. Please select a brief first using: tm context brief'
			);
		}

		return context.briefId;
	}

	/**
	 * Checks if a brief is currently selected
	 * @returns True if a brief is selected, false otherwise
	 */
	hasBrief(): boolean {
		const context = this.authManager.getContext();
		return !!(context && context.briefId);
	}
}