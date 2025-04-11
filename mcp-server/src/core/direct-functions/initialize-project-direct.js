import { initializeProject } from '../../../../scripts/init.js'; // Import core function and its logger if needed separately
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
		`Temporarily changing CWD to ${targetDirectory} for initialization.`
	);
	process.chdir(targetDirectory); // Change CWD to the *validated* targetDirectory

	enableSilentMode(); // Enable silent mode BEFORE calling the core function
	try {
		// Always force yes: true when called via MCP to avoid interactive prompts
		const options = {
			name: args.projectName,
			description: args.projectDescription,
			version: args.projectVersion,
			author: args.authorName,
			skipInstall: args.skipInstall,
			aliases: args.addAliases,
			yes: true // Force yes mode
		};

		log.info(`Initializing project with options: ${JSON.stringify(options)}`);
		const result = await initializeProject(options); // Call core logic

		// Format success result for handleApiResult
		resultData = {
			message: 'Project initialized successfully.',
			next_step:
				'Now that the project is initialized, the next step is to create the tasks by parsing a PRD. This will create the tasks folder and the initial task files (tasks folder will be created when parse-prd is run). The parse-prd tool will require a prd.txt file as input (typically found in the project root directory, scripts/ directory). You can create a prd.txt file by asking the user about their idea, and then using the scripts/example_prd.txt file as a template to genrate a prd.txt file in scripts/. You may skip all of this if the user already has a prd.txt file. You can THEN use the parse-prd tool to create the tasks. So: step 1 after initialization is to create a prd.txt file in scripts/prd.txt or confirm the user already has one. Step 2 is to use the parse-prd tool to create the tasks. Do not bother looking for tasks after initialization, just use the parse-prd tool to create the tasks after creating a prd.txt from which to parse the tasks. You do NOT need to reinitialize the project to parse-prd.',
			...result // Include details returned by initializeProject
		};
		success = true;
		log.info(
			`Project initialization completed successfully in ${targetDirectory}.`
		);
	} catch (error) {
		log.error(`Core initializeProject failed: ${error.message}`);
		errorResult = {
			code: 'INITIALIZATION_FAILED',
			message: `Core project initialization failed: ${error.message}`,
			details: error.stack
		};
		success = false;
	} finally {
		disableSilentMode(); // ALWAYS disable silent mode in finally
		log.info(`Restoring original CWD: ${originalCwd}`);
		process.chdir(originalCwd); // Change back to original CWD
	}

	// Return in format expected by handleApiResult
	if (success) {
		return { success: true, data: resultData, fromCache: false };
	} else {
		return { success: false, error: errorResult, fromCache: false };
	}
}
