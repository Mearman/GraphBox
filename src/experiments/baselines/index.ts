/**
 * Baseline expansion algorithms for comparison with degree-prioritised expansion.
 *
 * These baselines provide controlled comparisons:
 * - StandardBfsExpansion: No prioritisation (FIFO queue)
 * - FrontierBalancedExpansion: Cerf et al. balancing (smallest frontier first)
 * - RandomPriorityExpansion: Null hypothesis (random selection)
 * - DelayedTerminationExpansion: BFS with delayed termination after overlap
 * - DegreeSurpriseExpansion: Local structural anomaly prioritisation
 * - EnsembleExpansion: Union of BFS, DFS, and degree-priority
 * - CrossSeedAffinityExpansion: Frontier-aware degree prioritisation
 * - retroactivePathEnumeration: Post-process any expansion for exhaustive paths
 */

export {
	CrossSeedAffinityExpansion,
	type CrossSeedAffinityResult,
	type CrossSeedAffinityStats,
} from "./cross-seed-affinity";
export {
	DegreeSurpriseExpansion,
	type DegreeSurpriseResult,
	type DegreeSurpriseStats,
} from "./degree-surprise";
export {
	type DelayedTerminationConfig,
	DelayedTerminationExpansion,
	type DelayedTerminationResult,
	type DelayedTerminationStats,
} from "./delayed-termination";
export {
	EnsembleExpansion,
	type EnsembleExpansionResult,
	type EnsembleExpansionStats,
} from "./ensemble-expansion";
export {
	FrontierBalancedExpansion,
	type FrontierBalancedResult,
	type FrontierBalancedStats,
} from "./frontier-balanced";
export {
	RandomPriorityExpansion,
	type RandomPriorityResult,
	type RandomPriorityStats,
} from "./random-priority";
export {
	type ExpansionResult,
	retroactivePathEnumeration,
	type RetroactivePathEnumerationResult,
	type RetroactivePathEnumerationStats,
} from "./retroactive-path-enum";
export { type BfsExpansionStats,StandardBfsExpansion, type StandardBfsResult } from "./standard-bfs";

// Path ranking baselines for comparison with Path Salience Ranking
export { type BetweennessConfig, betweennessRanking, computeBetweennessCentrality } from "./betweenness-ranking";
export { type DegreeRankingConfig, degreeSumRanking } from "./degree-sum-ranking";
export { jaccardArithmeticRanking, type JaccardRankingConfig } from "./jaccard-arithmetic-ranking";
export { computePageRank, type PageRankRankingConfig, pageRankSumRanking } from "./pagerank-sum-ranking";
export { type RandomPathConfig,randomPathRanking } from "./random-path-ranking";
export { type ShortestPathConfig,shortestPathRanking } from "./shortest-path-ranking";
