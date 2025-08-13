/**
 * @fileoverview Main entry point for the tm-core package
 * This file exports all public APIs from the core Task Master library
 */

// Re-export types
export type * from './types/index';

// Re-export interfaces
export type * from './interfaces/index';
export * from './interfaces/index';

// Re-export providers
export * from './providers/index';

// Re-export storage
export * from './storage/index';

// Re-export parser
export * from './parser/index';

// Re-export utilities
export * from './utils/index';

// Re-export errors
export * from './errors/index';

// Package metadata
export const version = '1.0.0';
export const name = '@task-master/tm-core';
