/**
 * Path-Level Scoring
 *
 * Computes path-level scores from node-level centrality measures using
 * geometric mean aggregation. Enables meaningful comparison between
 * centrality-based baselines and MI-based path ranking.
 */

/**
 * Compute the geometric mean of node-level scores along a path.
 *
 * Returns 0 if any node has a non-positive score (geometric mean
 * is undefined for non-positive values) or if the path is empty.
 *
 * @param nodeScores - Map of node ID to score (e.g., betweenness, PageRank, degree)
 * @param pathNodes - Ordered array of node IDs forming the path
 * @returns Geometric mean of node scores, or 0 if undefined
 */
export const geometricMeanPathScore = (
	nodeScores: Map<string, number>,
	pathNodes: string[],
): number => {
	if (pathNodes.length === 0) return 0;

	let logSum = 0;
	for (const node of pathNodes) {
		const score = nodeScores.get(node) ?? 0;
		if (score <= 0) return 0;
		logSum += Math.log(score);
	}

	return Math.exp(logSum / pathNodes.length);
};
