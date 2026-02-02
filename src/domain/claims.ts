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
 * Community Detection Claims for Louvain evaluation.
 * Tests structural decomposition quality on benchmark graphs.
 */
const COMMUNITY_DETECTION_CLAIMS: EvaluationClaim[] = [
	{
		claimId: "louvain-positive-modularity",
		description: "Louvain detects communities with positive modularity on benchmark graphs",
		sut: "louvain-v1.0.0",
		baseline: "random-partition-v1.0.0",
		metric: "modularity",
		direction: "greater",
		scope: "global",
		tags: ["community-detection", "core"],
	},
	{
		claimId: "louvain-fewer-iterations-than-leiden",
		description: "Louvain converges in fewer iterations than Leiden on small graphs",
		sut: "louvain-v1.0.0",
		baseline: "leiden-v1.0.0",
		metric: "iterations",
		direction: "less",
		scope: "caseClass",
		scopeConstraints: { caseClass: "small-world" },
		tags: ["community-detection", "efficiency"],
	},
];

/**
 * K-Core Decomposition Claims.
 * Tests hierarchical structure identification on benchmark graphs.
 */
const KCORE_CLAIMS: EvaluationClaim[] = [
	{
		claimId: "kcore-identifies-hierarchical-structure",
		description: "K-core decomposition produces nested core hierarchy on benchmark graphs",
		sut: "k-core-v1.0.0",
		baseline: "random-partition-v1.0.0",
		metric: "coreCount",
		direction: "greater",
		threshold: 2,
		scope: "global",
		tags: ["decomposition", "core"],
	},
	{
		claimId: "kcore-core-periphery-separation",
		description: "K-core degeneracy separates core literature from peripheral on collaboration networks",
		sut: "k-core-v1.0.0",
		baseline: "random-partition-v1.0.0",
		metric: "degeneracy",
		direction: "greater",
		threshold: 1,
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
		tags: ["decomposition"],
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
		description: "Degree-prioritised expansion discovers more unique intermediate nodes than Standard BFS on collaboration networks",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "unique-paths",
		direction: "greater",
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
		tags: ["core", "diversity"],
	},
	{
		claimId: "dp-higher-diversity-vs-fb",
		description: "Degree-prioritised expansion discovers more unique intermediate nodes than Frontier-Balanced on collaboration networks",
		sut: "degree-prioritised-v1.0.0",
		baseline: "frontier-balanced-v1.0.0",
		metric: "unique-paths",
		direction: "greater",
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
		tags: ["diversity"],
	},
	{
		claimId: "dp-higher-diversity-vs-random",
		description: "Degree-prioritised expansion discovers more unique intermediate nodes than Random Priority on collaboration networks",
		sut: "degree-prioritised-v1.0.0",
		baseline: "random-priority-v1.0.0",
		metric: "unique-paths",
		direction: "greater",
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
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
		description: "Degree-prioritised expansion has lower hub traversal rate than Standard BFS on collaboration networks",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "hub-avoidance-rate",
		direction: "less",
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
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
		description: "Degree-prioritised expansion expands fewer nodes than Standard BFS on medium and large graphs",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "nodes-expanded",
		direction: "less",
		scope: "parameterRange",
		scopeConstraints: { caseClass: ["medium", "large"] },
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
		claimId: "dp-higher-peripheral-ratio",
		description: "Degree-prioritised expansion samples a higher peripheral-to-hub node ratio than Standard BFS",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "peripheral-coverage-ratio",
		direction: "greater",
		scope: "caseClass",
		scopeConstraints: { caseClass: "collaboration" },
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

	// Budget-Constrained Claims
	{
		claimId: "dp-budget-higher-coverage",
		description: "Degree-prioritised achieves higher salience coverage than BFS at 25% node budget",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "salience-coverage-budget",
		direction: "greater",
		scope: "caseClass",
		scopeConstraints: { caseClass: ["citation", "social"] },
		tags: ["core", "budget-constrained"],
	},
	{
		claimId: "dp-budget-lower-jsd",
		description: "Degree-prioritised samples have lower degree distribution JSD than BFS at 25% node budget",
		sut: "degree-prioritised-v1.0.0",
		baseline: "standard-bfs-v1.0.0",
		metric: "degree-distribution-jsd",
		direction: "less",
		scope: "caseClass",
		scopeConstraints: { caseClass: ["citation", "social"] },
		tags: ["budget-constrained", "representativeness"],
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
	...COMMUNITY_DETECTION_CLAIMS,
	...KCORE_CLAIMS,
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

// Re-export claim arrays
export { COMMUNITY_DETECTION_CLAIMS, KCORE_CLAIMS,RANKING_CLAIMS };
