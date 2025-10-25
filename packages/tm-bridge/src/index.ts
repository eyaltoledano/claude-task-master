/**
 * @tm/bridge - Temporary bridge package for legacy code migration
 *
 * ⚠️ THIS PACKAGE IS TEMPORARY AND WILL BE DELETED ⚠️
 *
 * This package exists solely to provide shared bridge logic between
 * legacy scripts and the new tm-core architecture during migration.
 *
 * DELETE THIS PACKAGE when legacy scripts are removed.
 */

export {
	tryUpdateViaRemote,
	type UpdateBridgeParams,
	type RemoteUpdateResult
} from './update-bridge.js';
