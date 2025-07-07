/**
 * Task Master Flow - Health Check Effect
 * Phase 0: Foundation & Setup
 * 
 * Provides basic health check functionality using Effect to verify
 * the Effect integration is working correctly.
 */

import { Effect, Schedule, Logger, Clock } from "effect";
import { PHASE_0_CONFIG, FlowConfig } from "../config.js";

/**
 * Basic health check effect
 * 
 * This effect verifies that the Effect integration is working
 * and provides basic system information.
 */
export const healthCheck = Effect.gen(function* () {
  // Get current timestamp using platform Clock
  const timestamp = yield* Clock.currentTimeMillis;
  
  // Simulate some async work using proper scheduling
  yield* Effect.sleep("100 millis");
  
  // Create health check result
  const result = {
    status: "ok",
    module: "task-master-flow-effect",
    version: PHASE_0_CONFIG.version,
    phase: PHASE_0_CONFIG.phase,
    timestamp: new Date(timestamp).toISOString(),
    features: PHASE_0_CONFIG.features,
    runtime: {
      nodejs: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      effectPlatform: "simplified-for-phase-0"
    },
    effect: {
      available: true,
      version: "3.16.12", // Updated to current version
      platform: "@effect/platform packages available"
    }
  };
  
  return result;
});

/**
 * Extended health check with system diagnostics
 * 
 * Performs additional checks and diagnostics for debugging.
 */
export const extendedHealthCheck = Effect.gen(function* () {
  // Run basic health check first
  const basicHealth = yield* healthCheck;
  
  // Add extended diagnostics
  
  // Check environment variables
  const envCheck = {
    flowEffectEnabled: process.env.FLOW_EFFECT_ENABLED || "not set",
    flowLogLevel: process.env.FLOW_EFFECT_LOG_LEVEL || "not set",
    nodeEnv: process.env.NODE_ENV || "not set"
  };
  
  // Check file system access
  const fsCheck = yield* Effect.tryPromise({
    try: () => import('fs').then(fs => fs.promises.access('.', fs.constants.R_OK)),
    catch: (error) => new Error(`File system check failed: ${error.message}`)
  }).pipe(
    Effect.map(() => ({ accessible: true })),
    Effect.catchAll((error) => Effect.succeed({ accessible: false, error: error.message }))
  );
  
  return {
    ...basicHealth,
    extended: {
      environment: envCheck,
      fileSystem: fsCheck,
      checkedAt: new Date().toISOString()
    }
  };
});

/**
 * Quick health check (no logging)
 * 
 * Returns basic status without console output.
 */
export const quickHealthCheck = Effect.succeed({
  status: "ok",
  module: "task-master-flow-effect",
  timestamp: new Date().toISOString(),
  quick: true
});

/**
 * Health check with custom message
 * 
 * @param {string} message - Custom message to include
 */
export const healthCheckWithMessage = (message) => Effect.gen(function* () {
  const basicResult = yield* healthCheck;
  
  return {
    ...basicResult,
    customMessage: message
  };
}); 