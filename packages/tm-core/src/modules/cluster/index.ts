/**
 * @fileoverview Cluster Execution Module
 * Provides cluster detection, parallel execution, and orchestration services
 */

// Types
export * from './types.js';

// Services
export { ClusterDetectionService } from './services/cluster-detection.service.js';
export {
	ParallelExecutorService,
	type ResourceConstraints,
	type TaskExecutor
} from './services/parallel-executor.service.js';
export {
	ClusterSequencerService,
	type ClusterExecutionOptions,
	type ClusterSequencerResult
} from './services/cluster-sequencer.service.js';
export {
	ProgressTrackerService,
	type ExecutionProgress
} from './services/progress-tracker.service.js';
export {
	TagOrchestratorService,
	type TagExecutionOptions,
	type TagExecutionResult
} from './services/tag-orchestrator.service.js';
export {
	ProjectOrchestratorService,
	type ProjectExecutionOptions,
	type ProjectExecutionResult,
	type TagWithDependencies
} from './services/project-orchestrator.service.js';
export {
	TagClusterService,
	type TagDependency,
	type TagCluster,
	type TagClusterResult
} from './services/tag-cluster.service.js';
