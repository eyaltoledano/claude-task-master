import { initializeProject } from '../../../../scripts/init.js'; // Import named export
import {
	enableSilentMode,
	disableSilentMode
	// isSilentMode // Not used directly here
} from '../../../../scripts/modules/utils.js';
import { getProjectRootFromSession } from '../../tools/utils.js'; // Adjust path if necessary
import os from 'os'; // Import os module for home directory check

/**
 * Direct function wrapper for initializing a project.
 * Derives target directory from session, sets CWD, and calls core init logic.
 * @param {object} args - Arguments containing project details and options (projectName, projectDescription, yes, etc.)
 * @param {object} log - The FastMCP logger instance.
 * @param {object} context - The context object, must contain { session }.
 * @returns {Promise<{success: boolean, data?: any, error?: {code: string, message: string}}>} - Standard result object.
 */
export async function initializeProjectDirect(args, log, context = {}) {
	const { session } = context;
	const homeDir = os.homedir();
	let targetDirectory = null;

	log.info(
		`CONTEXT received in direct function: ${context ? JSON.stringify(Object.keys(context)) : 'MISSING or Falsy'}`
	);
	log.info(
		`SESSION extracted in direct function: ${session ? 'Exists' : 'MISSING or Falsy'}`
	);
	log.info(`Args received in direct function: ${JSON.stringify(args)}`);

	// --- Determine Target Directory ---
	// 1. Prioritize projectRoot passed directly in args
	// Ensure it's not null, '/', or the home directory
	if (
		args.projectRoot &&
		args.projectRoot !== '/' &&
		args.projectRoot !== homeDir
	) {
		log.info(`Using projectRoot directly from args: ${args.projectRoot}`);
		targetDirectory = args.projectRoot;
	} else {
		// 2. If args.projectRoot is missing or invalid, THEN try session (as a fallback)
		log.warn(
			`args.projectRoot ('${args.projectRoot}') is missing or invalid. Attempting to derive from session.`
		);
		const sessionDerivedPath = getProjectRootFromSession(session, log);
		// Validate the session-derived path as well
		if (
			sessionDerivedPath &&
			sessionDerivedPath !== '/' &&
			sessionDerivedPath !== homeDir
		) {
			log.info(
				`Using project root derived from session: ${sessionDerivedPath}`
			);
			targetDirectory = sessionDerivedPath;
		} else {
			log.error(
				`Could not determine a valid project root. args.projectRoot='${args.projectRoot}', sessionDerivedPath='${sessionDerivedPath}'`
			);
		}
	}

	// 3. Validate the final targetDirectory
	if (!targetDirectory) {
		// This error now covers cases where neither args.projectRoot nor session provided a valid path
		return {
			success: false,
			error: {
				code: 'INVALID_TARGET_DIRECTORY',
				message: `Cannot initialize project: Could not determine a valid target directory. Please ensure a workspace/folder is open or specify projectRoot.`,
				details: `Attempted args.projectRoot: ${args.projectRoot}`
			},
			fromCache: false
		};
	}

	// --- Proceed with validated targetDirectory ---
	log.info(`Validated target directory for initialization: ${targetDirectory}`);

	const originalCwd = process.cwd();
	let resultData;
	let success = false;
	let errorResult = null;

	log.info(
		`Target directory determined: ${targetDirectory}. Proceeding without changing CWD.`
	);
	// process.chdir(targetDirectory); // DO NOT Change CWD

	// --- Create the Log Wrapper --- 
	const logWrapper = {
		// Map standard levels directly
		info: (message, ...args) => log.info(message, ...args),
		warn: (message, ...args) => log.warn(message, ...args),
		error: (message, ...args) => log.error(message, ...args),
		// Handle debug potentially not existing on FastMCP log
		debug: (message, ...args) => log.debug ? log.debug(message, ...args) : log.info(`[DEBUG] ${message}`, ...args),
		// Map success to info as core scripts might use it
		success: (message, ...args) => log.info(`[SUCCESS] ${message}`, ...args) 
	};
	// --- End Log Wrapper ---

	enableSilentMode(); // Enable silent mode BEFORE calling the core function
	try {
		// Always force yes: true when called via MCP to avoid interactive prompts
		const options = {
			projectName: args.projectName,
			projectDescription: args.projectDescription,
			projectVersion: args.projectVersion,
			authorName: args.authorName,
			skipInstall: args.skipInstall,
			addAliases: args.addAliases,
			projectType: args.projectType,
			providerType: args.providerType,
			targetDirectory: targetDirectory, // Pass the validated target directory
			yes: true // Force yes mode
		};

		log.info(`[initializeProjectDirect] Calling core initializeProject with options: ${JSON.stringify(options)}`);
		const initSucceeded = await initializeProject(options, logWrapper); // Call core logic

		if (!initSucceeded) {
			// If core function returned false, treat it as a specific kind of failure
			// We won't have a stack trace here, as the error was likely caught internally
			// But we already added logging within the core function's catch block
			throw new Error('Core initializeProject function returned false, indicating caught failure within createProjectStructure.');
		}

		// If initSucceeded is true, format success result
		resultData = {
			message: 'Project initialized successfully.',
			next_step:
				'Now that the project is initialized, the next step is to create the tasks by parsing a PRD. This will create the tasks folder and the initial task files (tasks folder will be created when parse-prd is run). The parse-prd tool will require a prd.txt file as input (typically found in the project root directory, scripts/ directory). You can create a prd.txt file by asking the user about their idea, and then using the scripts/example_prd.txt file as a template to genrate a prd.txt file in scripts/. You may skip all of this if the user already has a prd.txt file. You can THEN use the parse-prd tool to create the tasks. So: step 1 after initialization is to create a prd.txt file in scripts/prd.txt or confirm the user already has one. Step 2 is to use the parse-prd tool to create the tasks. Do not bother looking for tasks after initialization, just use the parse-prd tool to create the tasks after creating a prd.txt from which to parse the tasks. You do NOT need to reinitialize the project to parse-prd.',
		};
		success = true;
		log.info(
			`Project initialization completed successfully in ${targetDirectory}.`
		);
	} catch (error) {
		// Log the error directly here using the MCP logger
		log.error(`Error caught during direct project initialization call: ${error.message}`);
		log.error(`Stack Trace:
${error.stack}`);

		errorResult = {
			code: 'INITIALIZATION_FAILED',
			message: `Project initialization failed: ${error.message}`,
			details: error.stack // Include stack in response details too
		};
		success = false;
	} finally {
		disableSilentMode(); // ALWAYS disable silent mode in finally
		log.info(`Initialization attempt finished. Original CWD was not changed: ${originalCwd}`);
		// process.chdir(originalCwd); // No need to change back CWD
	}

	// Return in format expected by handleApiResult
	if (success) {
		return { success: true, data: resultData, fromCache: false };
	} else {
		return { success: false, error: errorResult, fromCache: false };
	}
}
