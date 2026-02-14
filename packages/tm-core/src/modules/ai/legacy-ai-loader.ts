/**
 * @fileoverview Loader for the legacy AI services module (scripts/modules/ai-services-unified.js)
 *
 * Centralizes the dynamic import of generateObjectService from the legacy module
 * so that consuming packages (CLI, MCP, etc.) don't need fragile relative paths.
 *
 * This is a temporary bridge until the legacy AI services are fully migrated into @tm/core.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { GenerateObjectServiceFn } from './structured-generation/structured-generator.js';

/**
 * Path from this file to the monorepo root's scripts/modules directory.
 *
 * Layout:
 *   packages/tm-core/src/modules/ai/legacy-ai-loader.ts  (this file)
 *   scripts/modules/ai-services-unified.js                (target)
 *
 * Relative: ../../../../../scripts/modules/ai-services-unified.js
 */
const LEGACY_AI_MODULE_RELATIVE_PATH =
	'../../../../../scripts/modules/ai-services-unified.js';

/**
 * Dynamically loads `generateObjectService` from the legacy AI services module.
 *
 * @returns The `generateObjectService` function typed as `GenerateObjectServiceFn`
 * @throws {Error} If the legacy module cannot be loaded
 *
 * @example
 * ```typescript
 * import { loadGenerateObjectService } from '@tm/core';
 *
 * const generateObjectService = await loadGenerateObjectService();
 * const analyzer = new BridgedTagSemanticAnalyzer(generateObjectService);
 * ```
 */
export async function loadGenerateObjectService(): Promise<GenerateObjectServiceFn> {
	const currentDir = path.dirname(fileURLToPath(import.meta.url));
	const modulePath = path.resolve(currentDir, LEGACY_AI_MODULE_RELATIVE_PATH);

	try {
		const aiModule = await import(
			/* webpackIgnore: true */
			modulePath
		);

		if (typeof aiModule.generateObjectService !== 'function') {
			throw new Error(
				`Expected generateObjectService to be a function, got ${typeof aiModule.generateObjectService}`
			);
		}

		return aiModule.generateObjectService as GenerateObjectServiceFn;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to load legacy AI services module at "${modulePath}": ${message}`
		);
	}
}
