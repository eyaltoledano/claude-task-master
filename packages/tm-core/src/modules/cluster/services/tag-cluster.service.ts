/**
 * @fileoverview Tag-level cluster detection service
 * Groups tags into dependency levels using topological sort.
 * Tags with no inter-tag dependencies land at level 0 (parallel).
 * Tags depending on level-N tags land at level N+1.
 */

/**
 * Input: a tag name with its declared inter-tag dependencies
 */
export interface TagDependency {
	readonly tag: string;
	readonly dependencies: readonly string[];
}

/**
 * A group of tags that share the same dependency level
 */
export interface TagCluster {
	/** Topological level (0 = roots, no dependencies) */
	readonly level: number;
	/** Tag names in this cluster (sorted alphabetically) */
	readonly tags: readonly string[];
	/** Levels this cluster depends on */
	readonly dependsOn: readonly number[];
}

/**
 * Result of tag-level cluster detection
 */
export interface TagClusterResult {
	readonly clusters: readonly TagCluster[];
	readonly totalTags: number;
	readonly totalClusters: number;
}

export class TagClusterService {
	/**
	 * Cluster tags by dependency level.
	 *
	 * Algorithm:
	 * 1. Build a dependency map (filtering out references to unknown tags)
	 * 2. For each tag, recursively compute its level:
	 *    - 0 if it has no dependencies
	 *    - max(dependency levels) + 1 otherwise
	 * 3. Group tags by level, sort alphabetically within each group
	 */
	clusterTags(tagDeps: readonly TagDependency[]): TagClusterResult {
		const tagSet = new Set(tagDeps.map((t) => t.tag));
		const depMap = new Map(
			tagDeps.map((t) => [
				t.tag,
				t.dependencies.filter((d) => tagSet.has(d))
			])
		);
		const levelMap = new Map<string, number>();

		const getLevel = (tag: string, visited: Set<string>): number => {
			if (levelMap.has(tag)) return levelMap.get(tag)!;
			if (visited.has(tag)) return 0; // cycle guard
			visited.add(tag);

			const deps = depMap.get(tag) || [];
			const level =
				deps.length === 0
					? 0
					: Math.max(...deps.map((d) => getLevel(d, visited))) + 1;

			levelMap.set(tag, level);
			return level;
		};

		for (const { tag } of tagDeps) {
			getLevel(tag, new Set());
		}

		// Group tags by level
		const grouped = new Map<number, string[]>();
		for (const [tag, level] of levelMap) {
			const list = grouped.get(level) || [];
			list.push(tag);
			grouped.set(level, list);
		}

		const sortedLevels = [...grouped.keys()].sort((a, b) => a - b);
		const clusters: TagCluster[] = sortedLevels.map((level) => ({
			level,
			tags: grouped.get(level)!.sort(),
			dependsOn: level === 0 ? [] : [level - 1]
		}));

		return {
			clusters,
			totalTags: tagDeps.length,
			totalClusters: clusters.length
		};
	}
}
