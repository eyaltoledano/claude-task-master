import { log } from '../utils.js';
import { addComplexityToTask } from '../utils.js';

/**
 * Return the next work item:
 *   •  Prefer an eligible SUBTASK that belongs to any parent task
 *      whose own status is `in-progress`.
 *   •  If no such subtask exists, fall back to the best top-level task
 *      (previous behaviour).
 *
 * The function still exports the same name (`findNextTask`) so callers
 * don't need to change.  It now always returns an object with
 *  ─ id            →  number  (task)  or  "parentId.subId"  (subtask)
 *  ─ title         →  string
 *  ─ status        →  string
 *  ─ priority      →  string  ("high" | "medium" | "low")
 *  ─ dependencies  →  array   (all IDs expressed in the same dotted form)
 *  ─ parentId      →  number  (present only when it's a subtask)
 *
 * @param {Object[]} tasks  – full array of top-level tasks, each may contain .subtasks[]
 * @param {Object} [complexityReport=null] - Optional complexity report object
 * @returns {Object|null}   – next work item or null if nothing is eligible
 */
function findNextTask(tasks, complexityReport = null) {
	// ---------- helpers ----------------------------------------------------
	const priorityValues = { high: 3, medium: 2, low: 1 };

	const toFullSubId = (parentId, maybeDotId) => {
		//  "12.3"  ->  "12.3"
		//        4 ->  "12.4"   (numeric / short form)
		if (typeof maybeDotId === 'string' && maybeDotId.includes('.')) {
			return maybeDotId;
		}
		return `${parentId}.${maybeDotId}`;
	};

	// ---------- build completed-ID set (tasks *and* subtasks) --------------
	const completedIds = new Set();
	tasks.forEach((t) => {
		if (t.status === 'done' || t.status === 'completed') {
			completedIds.add(String(t.id));
		}
		if (Array.isArray(t.subtasks)) {
			t.subtasks.forEach((st) => {
				if (st.status === 'done' || st.status === 'completed') {
					completedIds.add(`${t.id}.${st.id}`);
				}
			});
		}
	});

	// ---------- 1) look for eligible subtasks ------------------------------
	const candidateSubtasks = [];

	tasks
		.filter((t) => t.status === 'in-progress' && Array.isArray(t.subtasks))
		.forEach((parent) => {
			parent.subtasks.forEach((st) => {
				const stStatus = (st.status || 'pending').toLowerCase();
				if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

				const fullDeps =
					st.dependencies?.map((d) => toFullSubId(parent.id, d)) ?? [];

				const depsSatisfied =
					fullDeps.length === 0 ||
					fullDeps.every((depId) => completedIds.has(String(depId)));

				if (depsSatisfied) {
					candidateSubtasks.push({
						id: `${parent.id}.${st.id}`,
						title: st.title || `Subtask ${st.id}`,
						status: st.status || 'pending',
						priority: st.priority || parent.priority || 'medium',
						dependencies: fullDeps,
						parentId: parent.id
					});
				}
			});
		});

	if (candidateSubtasks.length > 0) {
		// sort by priority → dep-count → parent-id → sub-id
		candidateSubtasks.sort((a, b) => {
			const pa = priorityValues[a.priority] ?? 2;
			const pb = priorityValues[b.priority] ?? 2;
			if (pb !== pa) return pb - pa;

			if (a.dependencies.length !== b.dependencies.length)
				return a.dependencies.length - b.dependencies.length;

			// compare parent then sub-id numerically
			const [aPar, aSub] = a.id.split('.').map(Number);
			const [bPar, bSub] = b.id.split('.').map(Number);
			if (aPar !== bPar) return aPar - bPar;
			return aSub - bSub;
		});
		const nextTask = candidateSubtasks[0];

		// Add complexity to the task before returning
		if (nextTask && complexityReport) {
			addComplexityToTask(nextTask, complexityReport);
		}

		return nextTask;
	}

	// ---------- 2) fall back to top-level tasks (original logic) ------------
	const eligibleTasks = tasks.filter((task) => {
		const status = (task.status || 'pending').toLowerCase();
		if (status !== 'pending' && status !== 'in-progress') return false;
		const deps = task.dependencies ?? [];
		return deps.every((depId) => completedIds.has(String(depId)));
	});

	if (eligibleTasks.length === 0) return null;

	const nextTask = eligibleTasks.sort((a, b) => {
		const pa = priorityValues[a.priority || 'medium'] ?? 2;
		const pb = priorityValues[b.priority || 'medium'] ?? 2;
		if (pb !== pa) return pb - pa;

		const da = (a.dependencies ?? []).length;
		const db = (b.dependencies ?? []).length;
		if (da !== db) return da - db;

		return a.id - b.id;
	})[0];

	// Add complexity to the task before returning
	if (nextTask && complexityReport) {
		addComplexityToTask(nextTask, complexityReport);
	}

	return nextTask;
}

export default findNextTask;
