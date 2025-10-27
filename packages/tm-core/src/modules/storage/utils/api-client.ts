/**
 * Lightweight API client utility for Hamster backend
 * Centralizes error handling, auth, and request/response logic
 */

import {
	TaskMasterError,
	ERROR_CODES
} from '../../../common/errors/task-master-error.js';
import type { AuthManager } from '../../auth/managers/auth-manager.js';

export interface ApiClientOptions {
	baseUrl: string;
	authManager: AuthManager;
	accountId?: string;
}

export interface ApiErrorResponse {
	message: string;
	error?: string;
	statusCode?: number;
}

export class ApiClient {
	constructor(private options: ApiClientOptions) {}

	/**
	 * Make a typed API request with automatic error handling
	 */
	async request<T = any>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const { baseUrl, authManager, accountId } = this.options;

		// Get auth session
		const session = await authManager.supabaseClient.getSession();
		if (!session) {
			throw new TaskMasterError(
				'Not authenticated',
				ERROR_CODES.AUTHENTICATION_ERROR,
				{ operation: 'api-request', endpoint }
			);
		}

		// Build full URL
		const url = `${baseUrl}${endpoint}`;

		// Build headers
		const headers: RequestInit['headers'] = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${session.access_token}`,
			...(accountId ? { 'x-account-id': accountId } : {}),
			...options.headers
		};

		try {
			// Make request
			const response = await fetch(url, {
				...options,
				headers
			});

			// Handle non-2xx responses
			if (!response.ok) {
				await this.handleErrorResponse(response, endpoint);
			}

			// Parse successful response
			return (await response.json()) as T;
		} catch (error) {
			// If it's already a TaskMasterError, re-throw
			if (error instanceof TaskMasterError) {
				throw error;
			}

			// Wrap other errors
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			throw new TaskMasterError(
				errorMessage,
				ERROR_CODES.API_ERROR,
				{ operation: 'api-request', endpoint },
				error as Error
			);
		}
	}

	/**
	 * Extract and throw a clean error from API response
	 */
	private async handleErrorResponse(
		response: Response,
		endpoint: string
	): Promise<never> {
		let errorMessage: string;

		try {
			// API returns: { message: "...", error: "...", statusCode: 404 }
			const errorBody = (await response.json()) as ApiErrorResponse;
			errorMessage =
				errorBody.message || errorBody.error || 'Unknown API error';
		} catch {
			// Fallback if response isn't JSON
			errorMessage = (await response.text()) || response.statusText;
		}

		throw new TaskMasterError(errorMessage, ERROR_CODES.API_ERROR, {
			operation: 'api-request',
			endpoint,
			statusCode: response.status
		});
	}

	/**
	 * Convenience methods for common HTTP verbs
	 */
	async get<T = any>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, { method: 'GET' });
	}

	async post<T = any>(endpoint: string, body?: any): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	async patch<T = any>(endpoint: string, body?: any): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'PATCH',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	async put<T = any>(endpoint: string, body?: any): Promise<T> {
		return this.request<T>(endpoint, {
			method: 'PUT',
			body: body ? JSON.stringify(body) : undefined
		});
	}

	async delete<T = any>(endpoint: string): Promise<T> {
		return this.request<T>(endpoint, { method: 'DELETE' });
	}
}
