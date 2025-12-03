/**
 * TOON Integration for AI Services
 * 
 * This module provides TOON integration hooks for the existing ai-services-unified.js
 * without requiring major modifications to the existing codebase.
 */

import { ToonProviderFactory } from '../ai-providers/toon-enhanced-provider.js';
import { enableToon, disableToon, getToonConfig } from './index.js';
import { log } from '../../scripts/modules/utils.js';

/**
 * Enhance providers with TOON support when they are retrieved
 * This is a monkey-patch style integration that can be easily removed
 */
let originalGetProvider = null;
let toonIntegrationEnabled = false;

/**
 * Enable TOON integration globally for all AI services
 * @param {object} config - TOON configuration options
 */
export function enableToonForAIServices(config = {}) {
	if (toonIntegrationEnabled) {
		log('warn', 'TOON integration for AI services is already enabled');
		return;
	}
	
	try {
		// Enable TOON serialization
		enableToon(config);
		
		// Dynamically modify ai-services-unified.js to use TOON-enhanced providers
		const aiServices = await import('../../scripts/modules/ai-services-unified.js');
		
		// Store reference to original _getProvider if it exists and we haven't patched it
		if (aiServices._getProvider && !originalGetProvider) {
			originalGetProvider = aiServices._getProvider;
			
			// Patch the _getProvider function
			aiServices._getProvider = function(providerName) {
				const provider = originalGetProvider(providerName);
				if (provider) {
					return ToonProviderFactory.getEnhancedProvider(providerName, provider);
				}
				return provider;
			};
		}
		
		toonIntegrationEnabled = true;
		log('info', 'TOON integration enabled for all AI services');
		
		// Log current configuration
		const currentConfig = getToonConfig();
		log('debug', `TOON configuration: ${JSON.stringify(currentConfig)}`);
		
	} catch (error) {
		log('error', `Failed to enable TOON integration: ${error.message}`);
		throw error;
	}
}

/**
 * Disable TOON integration for AI services
 */
export function disableToonForAIServices() {
	if (!toonIntegrationEnabled) {
		log('warn', 'TOON integration for AI services is not currently enabled');
		return;
	}
	
	try {
		// Disable TOON serialization
		disableToon();
		
		// Restore original _getProvider function if we have a reference
		if (originalGetProvider) {
			const aiServices = await import('../../scripts/modules/ai-services-unified.js');
			aiServices._getProvider = originalGetProvider;
			originalGetProvider = null;
		}
		
		// Clear provider cache
		ToonProviderFactory.clearCache();
		
		toonIntegrationEnabled = false;
		log('info', 'TOON integration disabled for AI services');
		
	} catch (error) {
		log('error', `Failed to disable TOON integration: ${error.message}`);
		throw error;
	}
}

/**
 * Check if TOON integration is currently enabled
 * @returns {boolean} Whether TOON integration is enabled
 */
export function isToonIntegrationEnabled() {
	return toonIntegrationEnabled;
}

/**
 * Get TOON integration statistics
 * @returns {object} Statistics about TOON usage
 */
export function getToonIntegrationStats() {
	const providerStats = ToonProviderFactory.getStats();
	const config = getToonConfig();
	
	return {
		enabled: toonIntegrationEnabled,
		config,
		...providerStats,
		totalEnhancedProviders: providerStats.enhancedProviders
	};
}

/**
 * Test TOON integration with sample task data
 * This function tests TOON with data structures commonly used in task management
 */
export async function testToonWithTaskData() {
	if (!toonIntegrationEnabled) {
		throw new Error('TOON integration must be enabled first');
	}
	
	// Sample task management data similar to what Task Master uses
	const sampleTaskData = {
		tasks: [
			{
				id: 'task-1',
				title: 'Implement user authentication system',
				description: 'Create a secure authentication system with JWT tokens, password hashing, and session management',
				status: 'in-progress',
				priority: 'high',
				assignee: {
					id: 'user-123',
					name: 'John Developer',
					email: 'john@taskmaster.dev'
				},
				subtasks: [
					{
						id: 'subtask-1-1',
						title: 'Set up JWT token generation',
						status: 'done',
						estimatedHours: 4,
						actualHours: 3.5
					},
					{
						id: 'subtask-1-2',
						title: 'Implement password hashing with bcrypt',
						status: 'in-progress',
						estimatedHours: 2,
						actualHours: null
					}
				],
				tags: ['authentication', 'security', 'backend'],
				dependencies: ['task-setup-database'],
				metadata: {
					created: '2024-12-03T10:00:00Z',
					updated: '2024-12-03T12:30:00Z',
					estimatedCompleteDate: '2024-12-05T17:00:00Z'
				}
			},
			{
				id: 'task-2',
				title: 'Create user dashboard',
				description: 'Build a responsive user dashboard with task overview, progress tracking, and recent activity',
				status: 'pending',
				priority: 'medium',
				assignee: {
					id: 'user-456',
					name: 'Jane Frontend',
					email: 'jane@taskmaster.dev'
				},
				subtasks: [],
				tags: ['frontend', 'dashboard', 'ui'],
				dependencies: ['task-1'],
				metadata: {
					created: '2024-12-03T11:00:00Z',
					updated: '2024-12-03T11:00:00Z',
					estimatedCompleteDate: '2024-12-07T17:00:00Z'
				}
			}
		],
		project: {
			id: 'proj-taskmaster',
			name: 'Task Master Enhancement',
			description: 'Enhance Task Master with new features and optimizations'
		},
		requestedBy: {
			id: 'user-789',
			name: 'Project Manager',
			role: 'pm'
		}
	};
	
	// Import suitability analysis
	const { analyzeToonSuitability, estimateTokenSavings } = await import('./index.js');
	
	const suitability = analyzeToonSuitability(sampleTaskData);
	const savings = estimateTokenSavings(sampleTaskData);
	
	log('info', 'TOON test results for task data:');
	log('info', `  Suitable: ${suitability.suitable}`);
	log('info', `  Reason: ${suitability.reason}`);
	if (savings) {
		log('info', `  Character savings: ${savings.characterSavings} (${savings.savingsPercentage}%)`);
		log('info', `  Estimated token savings: ${savings.estimatedTokenSavings} (${savings.estimatedTokenSavingsPercentage}%)`);
	}
	
	return {
		sampleData: sampleTaskData,
		suitability,
		savings,
		testSuccessful: true
	};
}