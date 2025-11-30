/**
 * Tests for SupabaseAuthClient
 */

import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger
const mockLogger = {
	warn: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
	error: vi.fn()
};

vi.mock('../../../common/logger/index.js', () => ({
	getLogger: () => mockLogger
}));

// Mock SupabaseSessionStorage
vi.mock('../../auth/services/supabase-session-storage.js', () => ({
	SupabaseSessionStorage: class {
		clear() {}
		getItem() {
			return null;
		}
		setItem() {}
		removeItem() {}
	}
}));

import { AuthenticationError } from '../../auth/types.js';
// Import after mocking (synchronous imports)
import { SupabaseAuthClient } from './supabase-client.js';

describe('SupabaseAuthClient', () => {
	let authClient: SupabaseAuthClient;
	let mockSupabaseClient: any;

	// Store original env values for cleanup
	let originalSupabaseUrl: string | undefined;
	let originalSupabaseAnonKey: string | undefined;

	beforeEach(() => {
		// Reset singleton before each test
		SupabaseAuthClient.resetInstance();

		// Store original values
		originalSupabaseUrl = process.env.TM_SUPABASE_URL;
		originalSupabaseAnonKey = process.env.TM_SUPABASE_ANON_KEY;

		// Set required environment variables
		process.env.TM_SUPABASE_URL = 'https://test.supabase.co';
		process.env.TM_SUPABASE_ANON_KEY = 'test-anon-key';

		// Use getInstance() instead of new
		authClient = SupabaseAuthClient.getInstance();

		// Create mock Supabase client
		mockSupabaseClient = {
			auth: {
				getSession: vi.fn(),
				setSession: vi.fn(),
				signOut: vi.fn(),
				refreshSession: vi.fn(),
				getUser: vi.fn(),
				signInWithOAuth: vi.fn(),
				exchangeCodeForSession: vi.fn(),
				verifyOtp: vi.fn(),
				mfa: {
					challenge: vi.fn(),
					verify: vi.fn(),
					getAuthenticatorAssuranceLevel: vi.fn(),
					listFactors: vi.fn()
				}
			}
		};

		vi.clearAllMocks();
	});

	afterEach(() => {
		// Reset singleton after each test
		SupabaseAuthClient.resetInstance();

		// Restore original env values
		if (originalSupabaseUrl === undefined) {
			delete process.env.TM_SUPABASE_URL;
		} else {
			process.env.TM_SUPABASE_URL = originalSupabaseUrl;
		}

		if (originalSupabaseAnonKey === undefined) {
			delete process.env.TM_SUPABASE_ANON_KEY;
		} else {
			process.env.TM_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
		}
	});

	describe('Singleton Pattern', () => {
		it('should return the same instance on multiple getInstance() calls', () => {
			const instance1 = SupabaseAuthClient.getInstance();
			const instance2 = SupabaseAuthClient.getInstance();

			expect(instance1).toBe(instance2);
		});

		it('should return a new instance after resetInstance()', () => {
			const instance1 = SupabaseAuthClient.getInstance();
			SupabaseAuthClient.resetInstance();
			const instance2 = SupabaseAuthClient.getInstance();

			expect(instance1).not.toBe(instance2);
		});
	});

	describe('verifyMFA', () => {
		it('should verify MFA and refresh session to upgrade to AAL2', async () => {
			// Mock the challenge response
			const mockChallenge = {
				data: { id: 'challenge-123' },
				error: null
			};

			// Mock the MFA verification response
			const mockVerifyResponse = {
				data: {
					access_token: 'temp-token',
					refresh_token: 'temp-refresh'
				},
				error: null
			};

			// Mock the refreshed session with AAL2
			const mockSession: Session = {
				access_token: 'new-access-token',
				refresh_token: 'new-refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockRefreshSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			// Setup mocks
			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			mockSupabaseClient.auth.mfa.verify.mockResolvedValue(mockVerifyResponse);
			mockSupabaseClient.auth.refreshSession.mockResolvedValue(
				mockRefreshSessionResponse
			);

			// Override getClient to return our mock
			(authClient as any).client = mockSupabaseClient;

			// Execute
			const result = await authClient.verifyMFA('factor-123', '123456');

			// Verify refreshSession was called after MFA verification
			expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();

			// Verify the returned session
			expect(result).toEqual(mockSession);
		});

		it('should throw AuthenticationError when MFA challenge fails', async () => {
			const mockChallenge = {
				data: null,
				error: { message: 'Challenge failed' }
			};

			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			(authClient as any).client = mockSupabaseClient;

			const error = await authClient
				.verifyMFA('factor-123', '123456')
				.catch((e) => e);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.code).toBe('MFA_VERIFICATION_FAILED');
		});

		it('should throw AuthenticationError when MFA verification fails', async () => {
			const mockChallenge = {
				data: { id: 'challenge-123' },
				error: null
			};

			const mockVerifyResponse = {
				data: null,
				error: { message: 'Invalid code' }
			};

			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			mockSupabaseClient.auth.mfa.verify.mockResolvedValue(mockVerifyResponse);
			(authClient as any).client = mockSupabaseClient;

			const error = await authClient
				.verifyMFA('factor-123', '123456')
				.catch((e) => e);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.code).toBe('INVALID_MFA_CODE');
		});

		it('should throw AuthenticationError when refreshSession fails', async () => {
			const mockChallenge = {
				data: { id: 'challenge-123' },
				error: null
			};

			const mockVerifyResponse = {
				data: {
					access_token: 'temp-token',
					refresh_token: 'temp-refresh'
				},
				error: null
			};

			const mockRefreshSessionResponse = {
				data: { session: null },
				error: { message: 'Refresh failed' }
			};

			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			mockSupabaseClient.auth.mfa.verify.mockResolvedValue(mockVerifyResponse);
			mockSupabaseClient.auth.refreshSession.mockResolvedValue(
				mockRefreshSessionResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const error = await authClient
				.verifyMFA('factor-123', '123456')
				.catch((e) => e);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.code).toBe('REFRESH_FAILED');
		});

		it('should throw AuthenticationError when refreshSession returns no session', async () => {
			const mockChallenge = {
				data: { id: 'challenge-123' },
				error: null
			};

			const mockVerifyResponse = {
				data: {
					access_token: 'temp-token',
					refresh_token: 'temp-refresh'
				},
				error: null
			};

			const mockRefreshSessionResponse = {
				data: { session: null },
				error: null
			};

			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			mockSupabaseClient.auth.mfa.verify.mockResolvedValue(mockVerifyResponse);
			mockSupabaseClient.auth.refreshSession.mockResolvedValue(
				mockRefreshSessionResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const error = await authClient
				.verifyMFA('factor-123', '123456')
				.catch((e) => e);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe(
				'Failed to refresh session after MFA: No session returned'
			);
		});

		it('should throw AuthenticationError when MFA verification returns no data', async () => {
			const mockChallenge = {
				data: { id: 'challenge-123' },
				error: null
			};

			const mockVerifyResponse = {
				data: null,
				error: null
			};

			mockSupabaseClient.auth.mfa.challenge.mockResolvedValue(mockChallenge);
			mockSupabaseClient.auth.mfa.verify.mockResolvedValue(mockVerifyResponse);
			(authClient as any).client = mockSupabaseClient;

			const error = await authClient
				.verifyMFA('factor-123', '123456')
				.catch((e) => e);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.code).toBe('INVALID_RESPONSE');
			expect(error.message).toBe('No data returned from MFA verification');
		});
	});

	describe('checkMFARequired', () => {
		it('should return required: true when user has verified MFA factors but is at AAL1', async () => {
			const mockSession: Session = {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockGetSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			const mockAALResponse = {
				data: { currentLevel: 'aal1', nextLevel: 'aal2' },
				error: null
			};

			const mockFactorsResponse = {
				data: {
					totp: [
						{
							id: 'factor-123',
							status: 'verified',
							factor_type: 'totp'
						}
					]
				},
				error: null
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			mockSupabaseClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(
				mockAALResponse
			);
			mockSupabaseClient.auth.mfa.listFactors.mockResolvedValue(
				mockFactorsResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({
				required: true,
				factorId: 'factor-123',
				factorType: 'totp'
			});
		});

		it('should return required: false when session is already at AAL2', async () => {
			const mockSession: Session = {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockGetSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			const mockAALResponse = {
				data: { currentLevel: 'aal2' },
				error: null
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			mockSupabaseClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(
				mockAALResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({ required: false });
		});

		it('should return required: false when user has no verified MFA factors', async () => {
			const mockSession: Session = {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockGetSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			const mockAALResponse = {
				data: { currentLevel: 'aal1' },
				error: null
			};

			const mockFactorsResponse = {
				data: { totp: [] },
				error: null
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			mockSupabaseClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(
				mockAALResponse
			);
			mockSupabaseClient.auth.mfa.listFactors.mockResolvedValue(
				mockFactorsResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({ required: false });
		});

		it('should return required: false when getSession fails', async () => {
			const mockGetSessionResponse = {
				data: { session: null },
				error: { message: 'Session error' }
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({ required: false });
		});

		it('should return required: false when getAuthenticatorAssuranceLevel fails', async () => {
			const mockSession: Session = {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockGetSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			const mockAALResponse = {
				data: null,
				error: { message: 'AAL error' }
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			mockSupabaseClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(
				mockAALResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({ required: false });
		});

		it('should return required: false when listFactors fails', async () => {
			const mockSession: Session = {
				access_token: 'access-token',
				refresh_token: 'refresh-token',
				expires_in: 3600,
				expires_at: Date.now() + 3600,
				token_type: 'bearer',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					app_metadata: {},
					user_metadata: {},
					aud: 'authenticated',
					created_at: new Date().toISOString()
				}
			};

			const mockGetSessionResponse = {
				data: { session: mockSession },
				error: null
			};

			const mockAALResponse = {
				data: { currentLevel: 'aal1', nextLevel: 'aal2' },
				error: null
			};

			const mockFactorsResponse = {
				data: null,
				error: { message: 'Factors error' }
			};

			mockSupabaseClient.auth.getSession.mockResolvedValue(
				mockGetSessionResponse
			);
			mockSupabaseClient.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue(
				mockAALResponse
			);
			mockSupabaseClient.auth.mfa.listFactors.mockResolvedValue(
				mockFactorsResponse
			);
			(authClient as any).client = mockSupabaseClient;

			const result = await authClient.checkMFARequired();

			expect(result).toEqual({ required: false });
		});
	});

	describe('signOut', () => {
		it('should sign out with local scope', async () => {
			const mockSignOutResponse = {
				error: null
			};

			mockSupabaseClient.auth.signOut.mockResolvedValue(mockSignOutResponse);
			(authClient as any).client = mockSupabaseClient;

			await authClient.signOut();

			expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledWith({
				scope: 'local'
			});
		});

		it('should handle signOut errors gracefully', async () => {
			const mockSignOutResponse = {
				error: { message: 'Sign out failed' }
			};

			mockSupabaseClient.auth.signOut.mockResolvedValue(mockSignOutResponse);
			(authClient as any).client = mockSupabaseClient;

			// signOut should not throw errors - it handles them gracefully
			await expect(authClient.signOut()).resolves.not.toThrow();

			// Verify signOut was still called
			expect(mockSupabaseClient.auth.signOut).toHaveBeenCalledWith({
				scope: 'local'
			});
		});
	});
});
