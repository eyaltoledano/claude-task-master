/**
 * Auth Domain tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthDomain } from './auth-domain.js';

describe('AuthDomain', () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
		vi.clearAllMocks();
	});

	describe('getBriefCreationUrl', () => {
		it('should return null if no base domain is configured', () => {
			// Clear environment variables
			delete process.env.TM_BASE_DOMAIN;
			delete process.env.TM_PUBLIC_BASE_DOMAIN;

			// Create fresh instance with cleared env
			const domain = new AuthDomain();
			const url = domain.getBriefCreationUrl();

			expect(url).toBeNull();
		});

		it('should return null if org slug is not available in context', () => {
			// Set base domain but context will have no orgSlug
			process.env.TM_BASE_DOMAIN = 'localhost:8080';

			const domain = new AuthDomain();
			// Mock getContext to return null (no context set)
			vi.spyOn(domain, 'getContext').mockReturnValue(null);

			const url = domain.getBriefCreationUrl();

			expect(url).toBeNull();
		});

		it('should construct URL with http protocol for localhost', () => {
			process.env.TM_BASE_DOMAIN = 'localhost:8080';

			// Mock getContext to return a context with orgSlug
			const domain = new AuthDomain();
			vi.spyOn(domain, 'getContext').mockReturnValue({
				orgSlug: 'test-org',
				updatedAt: new Date().toISOString()
			});

			const url = domain.getBriefCreationUrl();

			expect(url).toBe('http://localhost:8080/home/test-org/briefs/create');
		});

		it('should construct URL with https protocol for production domain', () => {
			process.env.TM_BASE_DOMAIN = 'tryhamster.com';

			const domain = new AuthDomain();
			vi.spyOn(domain, 'getContext').mockReturnValue({
				orgSlug: 'acme-corp',
				updatedAt: new Date().toISOString()
			});

			const url = domain.getBriefCreationUrl();

			expect(url).toBe('https://tryhamster.com/home/acme-corp/briefs/create');
		});

		it('should use existing protocol if base domain includes it', () => {
			process.env.TM_BASE_DOMAIN = 'https://staging.hamster.dev';

			const domain = new AuthDomain();
			vi.spyOn(domain, 'getContext').mockReturnValue({
				orgSlug: 'staging-org',
				updatedAt: new Date().toISOString()
			});

			const url = domain.getBriefCreationUrl();

			expect(url).toBe(
				'https://staging.hamster.dev/home/staging-org/briefs/create'
			);
		});

		it('should prefer TM_BASE_DOMAIN over TM_PUBLIC_BASE_DOMAIN', () => {
			process.env.TM_BASE_DOMAIN = 'localhost:8080';
			process.env.TM_PUBLIC_BASE_DOMAIN = 'tryhamster.com';

			const domain = new AuthDomain();
			vi.spyOn(domain, 'getContext').mockReturnValue({
				orgSlug: 'my-org',
				updatedAt: new Date().toISOString()
			});

			const url = domain.getBriefCreationUrl();

			// Should use TM_BASE_DOMAIN (localhost), not TM_PUBLIC_BASE_DOMAIN
			expect(url).toBe('http://localhost:8080/home/my-org/briefs/create');
		});
	});
});
