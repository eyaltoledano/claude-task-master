/**
 * Shared utilities for MCP tools
 */

import fs from 'node:fs';
import path from 'node:path';
import {
	LOCAL_ONLY_COMMANDS,
	type LocalOnlyCommand,
	createTmCore
} from '@tm/core';
import type { ContentResult, Context } from 'fastmcp';
import packageJson from '../../../../package.json' with { type: 'json' };
import type { ToolContext } from './types.js';

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
 * Creates a content response for MCP tools
 * FastMCP requires text type, so we format objects as JSON strings
 */
export function createContentResponse(content: any): ContentResult {
	return {
		content: [
			{
				type: 'text',
				text:
					typeof content === 'object'
						? // Format JSON nicely with indentation
							JSON.stringify(content, null, 2)
						: // Keep other content types as-is
							String(content)
			}
		]
	};
}

/**
 * Creates an error response for MCP tools
 */
export function createErrorResponse(
	errorMessage: string,
	versionInfo?: { version: string; name: string },
	tagInfo?: { currentTag: string }
): ContentResult {
	// Provide fallback version info if not provided
	if (!versionInfo) {
		versionInfo = getVersionInfo();
	}

	let responseText = `Error: ${errorMessage}
Version: ${versionInfo.version}
Name: ${versionInfo.name}`;

	// Add tag information if available
	if (tagInfo) {
		responseText += `
Current Tag: ${tagInfo.currentTag}`;
	}

	return {
		content: [
			{
				type: 'text',
				text: responseText
			}
		],
		isError: true
	};
}

/**
 * Function signature for progress reporting
 */
export type ReportProgressFn = (progress: number, total?: number) => void;

/**
 * Validate that reportProgress is available for long-running operations
 */
export function checkProgressCapability(
	reportProgress: any,
	log: any
): ReportProgressFn | undefined {
	if (typeof reportProgress !== 'function') {
		log?.debug?.(
			'reportProgress not available - operation will run without progress updates'
		);
		return undefined;
	}

	return reportProgress;
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
		context: Context<undefined>
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

/**
 * Tool execution function signature with tmCore provided
 */
export type ToolExecuteFn<TArgs = any, TResult = any> = (
	args: TArgs,
	context: ToolContext
) => Promise<TResult>;

/**
 * Higher-order function that wraps MCP tool execution with:
 * - Normalized project root (via withNormalizedProjectRoot)
 * - TmCore instance creation
 * - Command guard check (for local-only commands)
 *
 * Use this for ALL MCP tools to provide consistent context and auth checking.
 *
 * @param commandName - Name of the command (used for guard check)
 * @param executeFn - Tool execution function that receives args and enhanced context
 * @returns Wrapped execute function
 *
 * @example
 * ```ts
 * export function registerAddDependencyTool(server: FastMCP) {
 *   server.addTool({
 *     name: 'add_dependency',
 *     parameters: AddDependencySchema,
 *     execute: withToolContext('add-dependency', async (args, context) => {
 *       // context.tmCore is already available
 *       // Auth guard already checked
 *       // Just implement the tool logic!
 *     })
 *   });
 * }
 * ```
 */
export function withToolContext<TArgs extends { projectRoot?: string }>(
	commandName: string,
	executeFn: ToolExecuteFn<TArgs & { projectRoot: string }, ContentResult>
) {
	return withNormalizedProjectRoot(
		async (
			args: TArgs & { projectRoot: string },
			context: Context<undefined>
		) => {
			// Create tmCore instance
			const tmCore = await createTmCore({
				projectPath: args.projectRoot,
				loggerConfig: { mcpMode: true, logCallback: context.log }
			});

			// Check if this is a local-only command that needs auth guard
			if (LOCAL_ONLY_COMMANDS.includes(commandName as LocalOnlyCommand)) {
				const authResult = await tmCore.auth.guardCommand(
					commandName,
					tmCore.tasks.getStorageType()
				);

				if (authResult.isBlocked) {
					const errorMsg = `You're working on the ${authResult.briefName} Brief in Hamster so this command is managed for you. This command is only available for local file storage. Log out with 'tm auth logout' to use local commands.`;
					context.log.info(errorMsg);
					return handleApiResult({
						result: {
							success: false,
							error: { message: errorMsg }
						},
						log: context.log,
						projectRoot: args.projectRoot
					});
				}
			}

			// Create enhanced context with tmCore
			const enhancedContext: ToolContext = {
				log: context.log,
				session: context.session,
				tmCore
			};

			// Execute the actual tool logic with enhanced context
			return executeFn(args, enhancedContext);
		}
	);
}
