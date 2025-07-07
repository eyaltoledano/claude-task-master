/**
 * Task Master Flow - Effect Runtime
 * Phase 0: Foundation & Setup
 *
 * Provides the basic Effect runtime infrastructure for the Flow module.
 * This runtime will be extended in future phases.
 */

import { Effect, Runtime, Layer, Logger } from 'effect';
import { NodeRuntime } from '@effect/platform-node';

/**
 * Basic Flow Runtime for Phase 0
 *
 * This runtime provides platform-aware Effect infrastructure following
 * current Effect ecosystem best practices with Node.js integration.
 *
 * Note: Starting with simplified runtime for Phase 0, will enhance in later phases.
 */
export const FlowRuntime = Runtime.defaultRuntime;

/**
 * Convenience function to run Effect programs
 *
 * @param {Effect} effect - The Effect to run
 * @returns {Promise} Promise that resolves to the Effect result
 */
export const runFlowEffect = (effect) => {
	return Runtime.runPromise(FlowRuntime)(effect);
};

/**
 * Run Effect programs synchronously (for simple effects)
 *
 * @param {Effect} effect - The Effect to run
 * @returns {*} The Effect result
 */
export const runFlowEffectSync = (effect) => {
	return Runtime.runSync(FlowRuntime)(effect);
};

/**
 * Create a scoped runtime for resource management
 *
 * @param {Layer} layer - Additional layer to add to runtime
 * @returns {Runtime} Scoped runtime
 */
export const createScopedFlowRuntime = (layer) => {
	return Runtime.make(
		Layer.mergeAll(NodeRuntime.layer, Logger.minimumLogLevel('Info'), layer)
	);
};

/**
 * Runtime configuration
 */
export const RUNTIME_CONFIG = {
	logLevel: 'Info',
	enableTelemetry: false, // Will be enabled in later phases
	enableMetrics: false, // Will be enabled in later phases
	defaultTimeout: 30000 // 30 seconds
};
