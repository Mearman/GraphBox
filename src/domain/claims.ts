/**
 * Thesis Claims Registry
 *
 * Defines the explicit hypotheses (claims) to be tested by the evaluation framework.
 * These claims map directly to thesis statements about algorithm performance.
 */

import type { EvaluationClaim } from "ppef/types/claims";

/**
 * Ranking Claims for Path Salience evaluation.
 * Tests whether information-theoretic ranking outperforms baseline methods.
 */
const RANKING_CLAIMS: EvaluationClaim[] = [
	{
		claimId: "mi-higher-quality-than-random",
		description: "Path Salience achieves higher mean MI than random ranking",
		sut: "path-salience-v1.0.0",
		baseline: "random-ranking-v1.0.0",
		metric: "meanMI",
		direction: "greater",
		scope: "global",
		tags: ["ranking", "core"],
	},
	{
		claimId: "mi-higher-quality-than-shortest",
		description: "Path Salience achieves higher mean MI than shortest-path ranking",
		sut: "path-salience-v1.0.0",
		baseline: "shortest-ranking-v1.0.0",
		metric: "meanMI",
		direction: "greater",
		scope: "global",
		tags: ["ranking", "core"],
	},
	{
		claimId: "better-node-coverage-than-random",
		description: "Path Salience achieves higher node coverage than random ranking",
		sut: "path-salience-v1.0.0",
		baseline: "random-ranking-v1.0.0",
		metric: "nodeCoverage",
		direction: "greater",
		scope: "global",
		tags: ["ranking"],
	},
	{
		claimId: "better-path-diversity-than-shortest",
		description: "Path Salience achieves higher path diversity than shortest-path ranking",
		sut: "path-salience-v1.0.0",
		baseline: "shortest-ranking-v1.0.0",
		metric: "pathDiversity",
		direction: "greater",
		scope: "global",
		tags: ["ranking"],
	},
];

/**
 * Thesis claims for GraphBox evaluation.
 *
 * Each claim represents a testable hypothesis about algorithm performance.
 */
export const THESIS_CLAIMS: EvaluationClaim[] = [
	// Path Diversity Claims
	{
		claimId: "dp-higher-diversity",
		description: "Degree-prioritised expansion achieves higher path diversity than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "path-diversity",
		direction: "greater",
		scope: "global",
		tags: ["core", "diversity"],
	},
	{
		claimId: "dp-higher-diversity-vs-fb",
		description: "Degree-prioritised expansion achieves higher path diversity than Frontier-Balanced",
		sut: "degree-prioritised-v1.0.0",
		baseline: "frontier-balanced-v1.0.0",
		metric: "path-diversity",
		direction: "greater",
		scope: "global",
		tags: ["diversity"],
	},
	{
		claimId: "dp-higher-diversity-vs-random",
		description: "Degree-prioritised expansion achieves higher path diversity than Random Priority",
		sut: "degree-prioritised-v1.0.0",
		baseline: "random-priority-v1.0.0",
		metric: "path-diversity",
		direction: "greater",
		scope: "global",
		tags: ["diversity", "null-hypothesis"],
	},

	// Hub Avoidance Claims
	{
		claimId: "dp-lower-hub-traversal",
		description: "Degree-prioritised expansion visits fewer hub nodes than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "hub-traversal",
		direction: "less",
		scope: "caseClass",
		scopeConstraints: { caseClass: "scale-free" },
		tags: ["core", "hub-avoidance"],
	},
	{
		claimId: "dp-lower-hub-avoidance-rate",
		description: "Degree-prioritised expansion has lower hub traversal rate than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "hub-avoidance-rate",
		direction: "less",
		scope: "global",
		tags: ["core", "hub-avoidance"],
	},
	{
		claimId: "dp-higher-peripheral-coverage",
		description: "Degree-prioritised expansion achieves higher peripheral coverage ratio than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "peripheral-coverage-ratio",
		direction: "greater",
		scope: "global",
		tags: ["hub-avoidance"],
	},
	{
		claimId: "dp-lower-hub-ratio",
		description: "Degree-prioritised expansion has lower hub expansion ratio",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "hub-avoidance-rate",
		direction: "less",
		scope: "global",
		tags: ["hub-avoidance"],
	},

	// Efficiency Claims
	{
		claimId: "dp-faster-large-graphs",
		description: "Degree-prioritised expansion speedup increases with graph size",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "speedup",
		direction: "greater",
		threshold: 1, // Must be at least 1x (not slower)
		scope: "parameterRange",
		scopeConstraints: { caseClass: ["medium", "large"] },
		tags: ["efficiency", "scalability"],
	},
	{
		claimId: "dp-fewer-nodes-expanded",
		description: "Degree-prioritised expansion expands fewer nodes than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "nodes-expanded",
		direction: "less",
		scope: "global",
		tags: ["efficiency"],
	},

	// Representativeness Claims
	{
		claimId: "dp-better-coverage",
		description: "Degree-prioritised samples better reflect graph topology",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "structural-coverage",
		direction: "greater",
		scope: "global",
		tags: ["representativeness"],
	},
	{
		claimId: "dp-better-bucket-coverage",
		description: "Degree-prioritised samples cover more degree buckets",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "bucket-coverage",
		direction: "greater",
		scope: "global",
		tags: ["representativeness"],
	},

	// Statistical Significance Claims
	{
		claimId: "dp-significant-improvement",
		description: "Degree-prioritised improvement is statistically significant",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "path-diversity",
		direction: "greater",
		scope: "global",
		significanceLevel: 0.05,
		minEffectSize: 0.5, // Medium effect size
		tags: ["core", "statistical"],
	},

	// Robustness Claims
	{
		claimId: "dp-robust-edge-removal",
		description: "Degree-prioritised maintains diversity under edge removal",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "variance-under-perturbation",
		direction: "less",
		scope: "global",
		tags: ["robustness"],
	},

	// Ranking Claims (Path Salience)
	{
		claimId: "mi-better-coverage",
		description: "MI ranking covers more nodes than random ranking",
		sut: "path-salience-v1.0.0",
		baseline: "random-ranking-v1.0.0",
		metric: "node-coverage",
		direction: "greater",
		threshold: 0.2, // 20% improvement
		scope: "global",
		tags: ["ranking"],
	},
	...RANKING_CLAIMS,
];

/**
 * Get claims by tag.
 *
 * @param tag - Tag to filter by
 * @returns Matching claims
 */
export const getClaimsByTag = (tag: string): EvaluationClaim[] => THESIS_CLAIMS.filter((c) => c.tags?.includes(tag));

/**
 * Get core claims (most important for thesis).
 */
export const getCoreClaims = (): EvaluationClaim[] => getClaimsByTag("core");

/**
 * Get claims for a specific SUT.
 *
 * @param sutId - SUT identifier
 * @returns Claims where SUT is primary
 */
export const getClaimsBySut = (sutId: string): EvaluationClaim[] => THESIS_CLAIMS.filter((c) => c.sut === sutId);

/**
 * Get claims for a specific baseline.
 *
 * @param baselineId - Baseline SUT identifier
 * @returns Claims comparing against this baseline
 */
export const getClaimsByBaseline = (baselineId: string): EvaluationClaim[] => THESIS_CLAIMS.filter((c) => c.baseline === baselineId);

/**
 * Get claim by ID.
 *
 * @param claimId - Claim identifier
 * @returns Claim or undefined
 */
export const getClaim = (claimId: string): EvaluationClaim | undefined => THESIS_CLAIMS.find((c) => c.claimId === claimId);

// Re-export RANKING_CLAIMS for backwards compatibility
export { RANKING_CLAIMS };
