import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../../../common/types/database.types.js';
import { DependencyWithDisplayId } from '../../../../common/types/repository-types.js';

/**
 * Handles fetching and processing of task dependencies with display_ids
 */
export class DependencyFetcher {
	constructor(private supabase: SupabaseClient<Database>) {}

	/**
	 * Fetches dependencies for given task IDs with display_ids joined
	 * @param taskIds Array of task IDs to fetch dependencies for
	 * @returns Map of task ID to array of dependency display_ids
	 */
	async fetchDependenciesWithDisplayIds(
		taskIds: string[]
	): Promise<Map<string, string[]>> {
		if (!taskIds || taskIds.length === 0) {
			return new Map();
		}

		const { data, error } = await this.supabase
			.from('task_dependencies')
			.select(`
				task_id,
				depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey (
					display_id
				)
			`)
			.in('task_id', taskIds);

		if (error) {
			throw new Error(`Failed to fetch task dependencies: ${error.message}`);
		}

		return this.processDependencyData(data as DependencyWithDisplayId[]);
	}

	/**
	 * Processes raw dependency data into a map structure
	 */
	private processDependencyData(
		dependencies: DependencyWithDisplayId[]
	): Map<string, string[]> {
		const dependenciesByTaskId = new Map<string, string[]>();

		if (!dependencies) {
			return dependenciesByTaskId;
		}

		for (const dep of dependencies) {
			if (!dep.task_id) continue;

			const currentDeps = dependenciesByTaskId.get(dep.task_id) || [];

			// Extract display_id from the joined object
			const displayId = dep.depends_on_task?.display_id;
			if (displayId) {
				currentDeps.push(displayId);
			}

			dependenciesByTaskId.set(dep.task_id, currentDeps);
		}

		return dependenciesByTaskId;
	}
}
