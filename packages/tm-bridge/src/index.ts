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

// Shared types and utilities
export type {
	LogLevel,
	ReportFunction,
	OutputFormat,
	BaseBridgeParams,
	StorageCheckResult
} from './bridge-types.js';

export { checkStorageType } from './bridge-utils.js';

// Bridge functions
export {
	tryUpdateViaRemote,
	type UpdateBridgeParams,
	type RemoteUpdateResult
} from './update-bridge.js';

export {
	tryExpandViaRemote,
	type ExpandBridgeParams,
	type RemoteExpandResult
} from './expand-bridge.js';

export {
	tryListTagsViaRemote,
	type TagsBridgeParams,
	type RemoteTagsResult,
	type TagInfo
} from './tags-bridge.js';

export {
	tryUseTagViaRemote,
	type UseTagBridgeParams,
	type RemoteUseTagResult
} from './use-tag-bridge.js';

export {
	tryAddTagViaRemote,
	type AddTagBridgeParams,
	type RemoteAddTagResult
} from './add-tag-bridge.js';
