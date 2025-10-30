/**
 * Shared utilities for MCP tools
 */

import type { ContentResult } from 'fastmcp';
import path from 'node:path';
import fs from 'node:fs';
import packageJson from '../../../../package.json' with { type: 'json' };

/**
 * Get version information
 */
export function getVersionInfo() {
	return {
		version: packageJson.version || 'unknown',
		name: packageJson.name || 'task-master-ai'
	};
}

/**
 * Get current tag for a project root
 */
export function getCurrentTag(projectRoot: string): string | null {
	try {
		// Try to read current tag from state.json
		const stateJsonPath = path.join(projectRoot, '.taskmaster', 'state.json');

		if (fs.existsSync(stateJsonPath)) {
			const stateData = JSON.parse(fs.readFileSync(stateJsonPath, 'utf-8'));
			return stateData.currentTag || 'master';
		}

		return 'master';
	} catch {
		return null;
	}
}

/**
 * Handle API result with standardized error handling and response formatting
 * This provides a consistent response structure for all MCP tools
 */
export async function handleApiResult<T>(options: {
	result: { success: boolean; data?: T; error?: { message: string } };
	log?: any;
	errorPrefix?: string;
	projectRoot?: string;
	tag?: string; // Optional tag/brief to use instead of reading from state.json
}): Promise<ContentResult> {
	const {
		result,
		log,
		errorPrefix = 'API error',
		projectRoot,
		tag: providedTag
	} = options;

	// Get version info for every response
	const versionInfo = getVersionInfo();

	// Use provided tag if available, otherwise get from state.json
	// Note: For API storage, tm-core returns the brief name as the tag
	const currentTag =
		providedTag !== undefined
			? providedTag
			: projectRoot
				? getCurrentTag(projectRoot)
				: null;

	if (!result.success) {
		const errorMsg = result.error?.message || `Unknown ${errorPrefix}`;
		log?.error?.(`${errorPrefix}: ${errorMsg}`);

		let errorText = `Error: ${errorMsg}\nVersion: ${versionInfo.version}\nName: ${versionInfo.name}`;

		if (currentTag) {
			errorText += `\nCurrent Tag: ${currentTag}`;
		}

		return {
			content: [
				{
					type: 'text',
					text: errorText
				}
			],
			isError: true
		};
	}

	log?.info?.('Successfully completed operation');

	// Create the response payload including version info and tag
	const responsePayload: any = {
		data: result.data,
		version: versionInfo
	};

	// Add current tag if available
	if (currentTag) {
		responsePayload.tag = currentTag;
	}

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(responsePayload, null, 2)
			}
		]
	};
}

/**
 * Normalize project root path (handles URI encoding, file:// protocol, Windows paths)
 */
export function normalizeProjectRoot(rawPath: string): string {
	if (!rawPath) return process.cwd();

	try {
		let pathString = rawPath;

		// Decode URI encoding
		try {
			pathString = decodeURIComponent(pathString);
		} catch {
			// If decoding fails, use as-is
		}

		// Strip file:// prefix
		if (pathString.startsWith('file:///')) {
			pathString = pathString.slice(7);
		} else if (pathString.startsWith('file://')) {
			pathString = pathString.slice(7);
		}

		// Handle Windows drive letter after stripping prefix (e.g., /C:/...)
		if (
			pathString.startsWith('/') &&
			/[A-Za-z]:/.test(pathString.substring(1, 3))
		) {
			pathString = pathString.substring(1);
		}

		// Normalize backslashes to forward slashes
		pathString = pathString.replace(/\\/g, '/');

		// Resolve to absolute path
		return path.resolve(pathString);
	} catch {
		return path.resolve(rawPath);
	}
}

/**
 * Get project root from session object
 */
function getProjectRootFromSession(session: any): string | null {
	try {
		// Check primary location
		if (session?.roots?.[0]?.uri) {
			return normalizeProjectRoot(session.roots[0].uri);
		}
		// Check alternate location
		else if (session?.roots?.roots?.[0]?.uri) {
			return normalizeProjectRoot(session.roots.roots[0].uri);
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Wrapper to normalize project root in args with proper precedence order
 *
 * PRECEDENCE ORDER:
 * 1. TASK_MASTER_PROJECT_ROOT environment variable (from process.env or session)
 * 2. args.projectRoot (explicitly provided)
 * 3. Session-based project root resolution
 * 4. Current directory fallback
 */
export function withNormalizedProjectRoot<T extends { projectRoot?: string }>(
	fn: (
		args: T & { projectRoot: string },
		context: any
	) => Promise<ContentResult>
): (args: T, context: any) => Promise<ContentResult> {
	return async (args: T, context: any): Promise<ContentResult> => {
		const { log, session } = context;
		let normalizedRoot: string | null = null;
		let rootSource = 'unknown';

		try {
			// 1. Check for TASK_MASTER_PROJECT_ROOT environment variable first
			if (process.env.TASK_MASTER_PROJECT_ROOT) {
				const envRoot = process.env.TASK_MASTER_PROJECT_ROOT;
				normalizedRoot = path.isAbsolute(envRoot)
					? envRoot
					: path.resolve(process.cwd(), envRoot);
				rootSource = 'TASK_MASTER_PROJECT_ROOT environment variable';
				log?.info?.(`Using project root from ${rootSource}: ${normalizedRoot}`);
			}
			// Also check session environment variables for TASK_MASTER_PROJECT_ROOT
			else if (session?.env?.TASK_MASTER_PROJECT_ROOT) {
				const envRoot = session.env.TASK_MASTER_PROJECT_ROOT;
				normalizedRoot = path.isAbsolute(envRoot)
					? envRoot
					: path.resolve(process.cwd(), envRoot);
				rootSource = 'TASK_MASTER_PROJECT_ROOT session environment variable';
				log?.info?.(`Using project root from ${rootSource}: ${normalizedRoot}`);
			}
			// 2. If no environment variable, try args.projectRoot
			else if (args.projectRoot) {
				normalizedRoot = normalizeProjectRoot(args.projectRoot);
				rootSource = 'args.projectRoot';
				log?.info?.(`Using project root from ${rootSource}: ${normalizedRoot}`);
			}
			// 3. If no args.projectRoot, try session-based resolution
			else {
				const sessionRoot = getProjectRootFromSession(session);
				if (sessionRoot) {
					normalizedRoot = sessionRoot;
					rootSource = 'session';
					log?.info?.(
						`Using project root from ${rootSource}: ${normalizedRoot}`
					);
				}
			}

			if (!normalizedRoot) {
				log?.error?.(
					'Could not determine project root from environment, args, or session.'
				);
				return handleApiResult({
					result: {
						success: false,
						error: {
							message:
								'Could not determine project root. Please provide projectRoot argument or ensure TASK_MASTER_PROJECT_ROOT environment variable is set.'
						}
					}
				});
			}

			// Inject the normalized root back into args
			const updatedArgs = { ...args, projectRoot: normalizedRoot } as T & {
				projectRoot: string;
			};

			// Execute the original function with normalized root in args
			return await fn(updatedArgs, context);
		} catch (error: any) {
			log?.error?.(
				`Error within withNormalizedProjectRoot HOF (Normalized Root: ${normalizedRoot}): ${error.message}`
			);
			if (error.stack && log?.debug) {
				log.debug(error.stack);
			}
			return handleApiResult({
				result: {
					success: false,
					error: {
						message: `Operation failed: ${error.message}`
					}
				}
			});
		}
	};
}
