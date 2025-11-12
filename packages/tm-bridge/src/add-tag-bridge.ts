import { ui } from '@tm/cli';
import type { BaseBridgeParams } from './bridge-types.js';
import { checkStorageType } from './bridge-utils.js';

/**
 * Parameters for the add-tag bridge function
 */
export interface AddTagBridgeParams extends BaseBridgeParams {
	/** Tag name to create */
	tagName: string;
}

/**
 * Result returned when API storage redirects to web UI
 */
export interface RemoteAddTagResult {
	success: boolean;
	message: string;
	redirectUrl: string;
}

/**
 * Shared bridge function for add-tag command.
 * Checks if using API storage and redirects to web UI if so.
 *
 * For API storage, tags are called "briefs" and must be created
 * through the Hamster web interface.
 *
 * @param params - Bridge parameters
 * @returns Result object if API storage handled it, null if should fall through to file storage
 */
export async function tryAddTagViaRemote(
	params: AddTagBridgeParams
): Promise<RemoteAddTagResult | null> {
	const {
		tagName,
		projectRoot,
		isMCP = false,
		outputFormat = 'text',
		report
	} = params;

	// Check storage type using shared utility
	const { isApiStorage, tmCore } = await checkStorageType(
		projectRoot,
		report,
		'falling back to file-based tag creation'
	);

	if (!isApiStorage || !tmCore) {
		// Not API storage - signal caller to fall through to file-based logic
		return null;
	}

	// Get the brief creation URL from tmCore
	const redirectUrl = tmCore.auth.getBriefCreationUrl();

	if (!redirectUrl) {
		report(
			'error',
			'Could not generate brief creation URL. Please ensure you have selected an organization using "tm context org"'
		);
		return {
			success: false,
			message:
				'Failed to generate brief creation URL. Please ensure an organization is selected.',
			redirectUrl: ''
		};
	}

	// Show CLI output if not MCP
	if (!isMCP && outputFormat === 'text') {
		console.log(
			ui.displayCardBox({
				header: '# Create a Brief in Hamster Studio',
				body: [
					'Your tags are separate task lists. When connected to Hamster,\ntask lists are attached to briefs.',
					'Create a new brief and its task list will automatically be\navailable when generated.'
				],
				callToAction: {
					label: 'Visit:',
					action: redirectUrl
				},
				footer:
					'To access tasks for a specific brief, use:\n' +
					'  • tm briefs select <brief-name>\n' +
					'  • tm briefs select <brief-id>\n' +
					'  • tm briefs select (interactive)'
			})
		);
	}

	// Return success result with redirect URL
	return {
		success: true,
		message: `API storage detected. Please create tag "${tagName}" at: ${redirectUrl}`,
		redirectUrl
	};
}
