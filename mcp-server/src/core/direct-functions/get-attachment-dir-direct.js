/**
 * taskmaster-get-attachment-dir-direct.js
 * Direct function to determine the appropriate directory for downloading Jira attachments.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
// Note: We read process.env directly, CONFIG import might not be needed unless it provides validation
// import { CONFIG } from '../../../../scripts/modules/utils.js';

/**
 * Determines the target directory for downloads based on args, env var, or OS temp.
 * @param {object} args - Arguments object, may contain 'target_dir' and 'issue_key'.
 * @param {object} log - Logger instance provided by MCP.
 * @returns {Promise<object>} - Result object { success, data: { path: string, source: string, basePath: string } | error }.
 */
export async function getAttachmentDirDirect(args, log) {
    const providedBaseDir = args.target_dir;
    const envBaseDir = process.env.ATTACHMENT_DIR;
    const issueKey = args.issue_key;

    // Validate issue_key
    if (!issueKey) {
        log.error('issue_key argument is required but was not provided.');
        return {
            success: false,
            error: { code: 'MISSING_ARGUMENT', message: 'issue_key is required.' }
        };
    }
    // Basic sanitization/validation for issue key as directory name (optional but good practice)
    const safeIssueKey = String(issueKey).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeIssueKey) {
         log.error('Invalid issue_key provided.');
         return {
            success: false,
            error: { code: 'INVALID_ARGUMENT', message: 'Invalid issue_key provided.' }
        };
    }

    log.info(`Determining attachment directory for issue: ${issueKey}...`);
    log.debug(`Provided base dir: ${providedBaseDir}, Env base dir: ${envBaseDir}`);

    let baseAttachmentPath = '';
    let finalTargetPath = '';
    let pathSource = '';

    try {
        // --- Determine Base Path --- 
        if (providedBaseDir) {
            baseAttachmentPath = path.resolve(String(providedBaseDir));
            pathSource = 'Argument (target_dir)';
            log.info(`Using provided base directory: ${baseAttachmentPath}`);
            // Ensure the *base* directory exists or can be created
            try {
                fs.mkdirSync(baseAttachmentPath, { recursive: true });
                log.debug(`Ensured base directory exists: ${baseAttachmentPath}`);
            } catch (mkdirError) {
                log.error(`Failed to access or create provided base directory ${baseAttachmentPath}: ${mkdirError.message}`);
                throw new Error(`Provided base directory (target_dir) is not accessible or cannot be created: ${baseAttachmentPath}.`);
            }
        } else if (envBaseDir) {
            baseAttachmentPath = path.resolve(String(envBaseDir));
            pathSource = 'Environment Variable (ATTACHMENT_DIR)';
            log.info(`Using environment variable ATTACHMENT_DIR as base: ${baseAttachmentPath}`);
            try {
                fs.mkdirSync(baseAttachmentPath, { recursive: true });
                log.debug(`Ensured base directory exists: ${baseAttachmentPath}`);
            } catch (mkdirError) {
                log.error(`Failed to access or create base directory from environment variable ${baseAttachmentPath}: ${mkdirError.message}`);
                throw new Error(`Directory specified in ATTACHMENT_DIR is not accessible or cannot be created: ${baseAttachmentPath}.`);
            }
        } else {
            try {
                const tempDir = os.tmpdir();
                // We still create a unique temp dir first as the base
                baseAttachmentPath = fs.mkdtempSync(path.join(tempDir, 'tm-jira-base-')); 
                pathSource = 'OS Temporary Directory Base';
                log.info(`Using OS temporary directory as base: ${baseAttachmentPath}`);
            } catch (tempError) {
                log.error(`Failed to create temporary base directory: ${tempError.message}`);
                throw new Error('Failed to create a temporary base directory.');
            }
        }

        if (!baseAttachmentPath) {
            throw new Error('Could not determine a valid base directory.');
        }

        // --- Construct and Ensure Final Path --- 
        finalTargetPath = path.join(baseAttachmentPath, safeIssueKey);
        log.info(`Final target directory constructed: ${finalTargetPath}`);

        try {
            fs.mkdirSync(finalTargetPath, { recursive: true });
            log.debug(`Ensured final target directory exists: ${finalTargetPath}`);
        } catch (finalMkdirError) {
             log.error(`Failed to create final target directory ${finalTargetPath}: ${finalMkdirError.message}`);
             throw new Error(`Could not create subdirectory for issue ${issueKey} at ${finalTargetPath}. Check permissions.`);
        }

        // --- Return Success --- 
        log.info(`Determined final attachment directory: ${finalTargetPath} (Source: ${pathSource})`);
        return {
            success: true,
            data: {
                path: finalTargetPath,
                source: pathSource,
                basePath: baseAttachmentPath
            }
        };

    } catch (error) {
        log.error(`Error determining attachment directory: ${error.message}`);
        return {
            success: false,
            error: {
                code: 'GET_ATTACHMENT_DIR_ERROR',
                message: error.message
            }
        };
    }
} 