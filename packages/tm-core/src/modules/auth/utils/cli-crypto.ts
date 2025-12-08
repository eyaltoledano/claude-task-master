/**
 * E2E Encryption Utilities for CLI Authentication
 *
 * Uses hybrid encryption (RSA + AES-256-GCM):
 * - CLI generates RSA keypair
 * - Server encrypts tokens with AES, then encrypts AES key with CLI's public key
 * - CLI decrypts AES key with private key, then decrypts tokens
 */

import crypto from 'crypto';
import { AuthenticationError } from '../types.js';

/**
 * Encrypted token payload from server
 */
export interface EncryptedTokenPayload {
	encrypted_key: string; // AES key encrypted with RSA (base64)
	encrypted_data: string; // Tokens encrypted with AES-256-GCM (base64)
	iv: string; // AES-GCM initialization vector (base64)
	auth_tag: string; // AES-GCM authentication tag (base64)
}

/**
 * Decrypted token data
 */
export interface DecryptedTokens {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	user_id: string;
	email?: string;
}

/**
 * RSA keypair for E2E encryption
 */
export interface AuthKeyPair {
	publicKey: string; // PEM format
	privateKey: string; // PEM format
}

/**
 * Generate RSA keypair for E2E encryption
 * Uses 2048-bit keys which is the minimum secure size
 */
export function generateKeyPair(): AuthKeyPair {
	const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: 'spki',
			format: 'pem'
		},
		privateKeyEncoding: {
			type: 'pkcs8',
			format: 'pem'
		}
	});

	return { publicKey, privateKey };
}

/**
 * Decrypt tokens received from server
 *
 * @param payload - Encrypted payload from server
 * @param privateKeyPem - CLI's private key in PEM format
 * @returns Decrypted token data
 */
export function decryptTokens(
	payload: EncryptedTokenPayload,
	privateKeyPem: string
): DecryptedTokens {
	try {
		// Decode base64 values
		const encryptedKey = Buffer.from(payload.encrypted_key, 'base64');
		const encryptedData = Buffer.from(payload.encrypted_data, 'base64');
		const iv = Buffer.from(payload.iv, 'base64');
		const authTag = Buffer.from(payload.auth_tag, 'base64');

		// Decrypt AES key using RSA private key
		const aesKey = crypto.privateDecrypt(
			{
				key: privateKeyPem,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: 'sha256'
			},
			encryptedKey
		);

		// Decrypt tokens using AES-256-GCM
		const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([
			decipher.update(encryptedData),
			decipher.final()
		]);

		return JSON.parse(decrypted.toString('utf8')) as DecryptedTokens;
	} catch (error) {
		throw new AuthenticationError(
			`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			'DECRYPTION_FAILED',
			error
		);
	}
}
