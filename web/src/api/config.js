/**
 * API Configuration
 *
 * Base configuration and utilities for API calls
 */

// Base API URL - will be proxied by Vite in development
export const API_BASE_URL = '/api';

/**
 * Create API URL with base path
 * @param {string} path - API endpoint path
 * @returns {string} Full API URL
 */
export const createApiUrl = (path) => {
	return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Default fetch options for API calls
 */
export const defaultFetchOptions = {
	headers: {
		'Content-Type': 'application/json'
	}
};

/**
 * Enhanced fetch wrapper with error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise} API response
 */
export const apiFetch = async (url, options = {}) => {
	const response = await fetch(url, {
		...defaultFetchOptions,
		...options,
		headers: {
			...defaultFetchOptions.headers,
			...options.headers
		}
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({
			error: 'Unknown error',
			message: `HTTP ${response.status}: ${response.statusText}`
		}));

		throw new Error(errorData.message || `API call failed: ${response.status}`);
	}

	return response.json();
};
