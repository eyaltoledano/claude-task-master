/**
 * Watchers Module - Phase 3.1 Index
 * 
 * Central exports for the file watching system components.
 * Provides a unified interface for importing all watcher-related functionality.
 * 
 * @author Task Master Flow
 * @version 3.1.0
 */

// Core watching components
export { 
    UniversalFileWatcher, 
    createFileWatcher, 
    isFileWatchingSupported 
} from './file-watcher.js';

export { 
    ChangeProcessor, 
    createChangeProcessor,
    ChangeTypes,
    ChangePriority 
} from './change-processor.js';

export { 
    BatchProcessor, 
    createBatchProcessor,
    BatchStrategy,
    ResourceLimits 
} from './batch-processor.js';

export { 
    WatchManager, 
    createWatchManager,
    isWatchingSupported,
    CacheStrategy,
    WatchState 
} from './watch-manager.js';

// Convenience factory function for creating a complete watching system
export function createCompleteWatchingSystem(projectPath, options = {}) {
    return createWatchManager(projectPath, options);
}

// Check if the complete watching system is supported
export function isCompleteWatchingSupported() {
    return isFileWatchingSupported() && isWatchingSupported();
}

export default {
    UniversalFileWatcher,
    ChangeProcessor,
    BatchProcessor,
    WatchManager,
    createFileWatcher,
    createChangeProcessor,
    createBatchProcessor,
    createWatchManager,
    createCompleteWatchingSystem,
    isFileWatchingSupported,
    isWatchingSupported,
    isCompleteWatchingSupported,
    ChangeTypes,
    ChangePriority,
    BatchStrategy,
    ResourceLimits,
    CacheStrategy,
    WatchState
};
