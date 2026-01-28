/**
 * Thesis Evaluation Claims
 *
 * Defines PPEF evaluation claims for validating PhD thesis contributions.
 * Claims are organized into traversal (T1-T8) and ranking (R1-R3) categories.
 *
 * Each claim specifies:
 * - A primary SUT (System Under Test) being evaluated
 * - A baseline SUT for comparison
 * - The metric being compared
 * - Expected direction of difference (greater/less)
 * - Scope of validity (global/caseClass)
 */

import type { EvaluationClaim } from "ppef/types/claims";

// =============================================================================
// TRAVERSAL CLAIMS (T1-T8)
// =============================================================================

/**
 * T1: Hub Deferral Claim
 *
 * Degree-prioritised expansion defers hub nodes to later in the expansion
 * compared to standard BFS.
 */
export const CLAIM_T1_HUB_DEFERRAL: EvaluationClaim = {
	claimId: "T1",
	description:
		"Degree-prioritised expansion defers hub nodes to later positions in expansion order compared to standard BFS",
	sut: "degree-prioritised-v1.0.0",
	baseline: "standard-bfs-v1.0.0",
	metric: "hubExpansionPosition",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "hub-avoidance", "degree-prioritised"],
	citation: "Thesis Chapter 4",
};

/**
 * T2: Path Diversity Claim
 *
 * Degree-prioritised expansion discovers more diverse paths (measured by
 * unique node coverage) than standard BFS.
 */
export const CLAIM_T2_PATH_DIVERSITY: EvaluationClaim = {
	claimId: "T2",
	description:
		"Degree-prioritised expansion discovers paths with higher node diversity than standard BFS",
	sut: "degree-prioritised-v1.0.0",
	baseline: "standard-bfs-v1.0.0",
	metric: "pathDiversity",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "path-diversity", "degree-prioritised"],
	citation: "Thesis Chapter 4",
};

/**
 * T3: Entropy Ordering Claim
 *
 * Entropy-guided expansion (EGE) achieves stronger correlation between
 * expansion order and neighbourhood entropy than degree-prioritised.
 */
export const CLAIM_T3_ENTROPY_ORDERING: EvaluationClaim = {
	claimId: "T3",
	description:
		"Entropy-guided expansion orders nodes more strongly by neighbourhood entropy than degree-prioritised",
	sut: "entropy-guided-v1.0.0",
	baseline: "degree-prioritised-v1.0.0",
	metric: "entropyCorrelation",
	direction: "greater",
	scope: "caseClass",
	scopeConstraints: { caseClass: ["heterogeneous", "multi-domain"] },
	significanceLevel: 0.05,
	minEffectSize: 0.3,
	tags: ["traversal", "entropy", "ege"],
	citation: "Thesis Chapter 4",
};

/**
 * T4: Path Discovery Rate Claim
 *
 * Path-preserving multi-frontier expansion (PPME) discovers paths faster
 * (more paths per node expanded) than degree-prioritised.
 */
export const CLAIM_T4_PATH_DISCOVERY: EvaluationClaim = {
	claimId: "T4",
	description:
		"Path-preserving expansion discovers paths at a higher rate (paths/nodes) than degree-prioritised",
	sut: "path-preserving-v1.0.0",
	baseline: "degree-prioritised-v1.0.0",
	metric: "pathDiscoveryRate",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "path-preserving", "efficiency"],
	citation: "Thesis Chapter 4",
};

/**
 * T5: Adaptation Claim
 *
 * Retrospective salience-guided expansion (RSGE) improves path quality
 * over time through its adaptive two-phase mechanism.
 */
export const CLAIM_T5_ADAPTATION: EvaluationClaim = {
	claimId: "T5",
	description:
		"Retrospective salience expansion achieves quality improvement in Phase 2 relative to Phase 1",
	sut: "retrospective-salience-v1.0.0",
	baseline: "degree-prioritised-v1.0.0",
	metric: "qualityImprovement",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "adaptive", "rsge"],
	citation: "Thesis Chapter 4",
};

/**
 * T6: Cross-Domain Path Claim
 *
 * Heterogeneity-aware expansion (HABE) discovers a higher proportion of
 * paths crossing domain boundaries than entropy-guided expansion.
 */
export const CLAIM_T6_CROSS_DOMAIN: EvaluationClaim = {
	claimId: "T6",
	description:
		"Heterogeneity-aware expansion discovers more cross-domain paths than entropy-guided",
	sut: "heterogeneity-aware-v1.0.0",
	baseline: "entropy-guided-v1.0.0",
	metric: "crossDomainPathRatio",
	direction: "greater",
	scope: "caseClass",
	scopeConstraints: { caseClass: ["heterogeneous", "multi-domain"] },
	significanceLevel: 0.05,
	minEffectSize: 0.3,
	tags: ["traversal", "heterogeneity", "habe", "cross-domain"],
	citation: "Thesis Chapter 4",
};

/**
 * T7: Salience Improvement Claim
 *
 * Multi-frontier adaptive salience-feedback (MFASF) achieves higher mean
 * path salience than path-preserving expansion.
 */
export const CLAIM_T7_SALIENCE_IMPROVEMENT: EvaluationClaim = {
	claimId: "T7",
	description:
		"Multi-frontier adaptive expansion achieves higher mean path salience than path-preserving",
	sut: "multi-frontier-adaptive-v1.0.0",
	baseline: "path-preserving-v1.0.0",
	metric: "meanPathSalience",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "salience", "mfasf", "adaptive"],
	citation: "Thesis Chapter 4",
};

/**
 * T8: Termination Efficiency Claim
 *
 * MFASF requires fewer nodes per salient path (higher efficiency) than
 * degree-prioritised expansion due to adaptive termination.
 */
export const CLAIM_T8_TERMINATION_EFFICIENCY: EvaluationClaim = {
	claimId: "T8",
	description:
		"Multi-frontier adaptive expansion requires fewer nodes per salient path than degree-prioritised",
	sut: "multi-frontier-adaptive-v1.0.0",
	baseline: "degree-prioritised-v1.0.0",
	metric: "nodesPerSalientPath",
	direction: "less",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.2,
	tags: ["traversal", "efficiency", "mfasf", "termination"],
	citation: "Thesis Chapter 4",
};

// =============================================================================
// RANKING CLAIMS (R1-R3)
// =============================================================================

/**
 * R1: MI Sensitivity Claim
 *
 * Path salience ranking produces higher top-path MI than shortest-path ranking.
 */
export const CLAIM_R1_MI_SENSITIVITY: EvaluationClaim = {
	claimId: "R1",
	description:
		"Path salience ranking selects paths with higher MI than shortest-path ranking",
	sut: "path-salience-v1.0.0",
	baseline: "shortest-ranking-v1.0.0",
	metric: "topPathMI",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.3,
	tags: ["ranking", "mi", "path-salience", "information-theoretic"],
	citation: "Thesis Chapter 5",
};

/**
 * R2: Length Independence Claim
 *
 * Path salience ranking shows low correlation between path length and rank,
 * unlike shortest-path ranking.
 */
export const CLAIM_R2_LENGTH_INDEPENDENCE: EvaluationClaim = {
	claimId: "R2",
	description:
		"Path salience ranking has lower length-rank correlation than shortest-path ranking",
	sut: "path-salience-v1.0.0",
	baseline: "shortest-ranking-v1.0.0",
	metric: "lengthCorrelation",
	direction: "less",
	threshold: 0.3, // Correlation should be < 0.3 for independence
	scope: "global",
	significanceLevel: 0.05,
	tags: ["ranking", "length-independence", "path-salience"],
	citation: "Thesis Chapter 5",
};

/**
 * R3: Weak-Link Dominance Claim
 *
 * Path salience ranking is more sensitive to weak links (low-MI edges) than
 * random ranking, correctly penalizing paths with bottlenecks.
 */
export const CLAIM_R3_WEAK_LINK: EvaluationClaim = {
	claimId: "R3",
	description:
		"Path salience ranking shows greater sensitivity to weak links than random ranking",
	sut: "path-salience-v1.0.0",
	baseline: "random-ranking-v1.0.0",
	metric: "weakLinkSensitivity",
	direction: "greater",
	scope: "global",
	significanceLevel: 0.05,
	minEffectSize: 0.5, // Strong effect expected
	tags: ["ranking", "weak-link", "path-salience", "geometric-mean"],
	citation: "Thesis Chapter 5",
};

// =============================================================================
// CLAIM COLLECTIONS
// =============================================================================

/**
 * All traversal claims (T1-T8).
 */
export const TRAVERSAL_CLAIMS: EvaluationClaim[] = [
	CLAIM_T1_HUB_DEFERRAL,
	CLAIM_T2_PATH_DIVERSITY,
	CLAIM_T3_ENTROPY_ORDERING,
	CLAIM_T4_PATH_DISCOVERY,
	CLAIM_T5_ADAPTATION,
	CLAIM_T6_CROSS_DOMAIN,
	CLAIM_T7_SALIENCE_IMPROVEMENT,
	CLAIM_T8_TERMINATION_EFFICIENCY,
];

/**
 * All ranking claims (R1-R3).
 */
export const RANKING_CLAIMS: EvaluationClaim[] = [
	CLAIM_R1_MI_SENSITIVITY,
	CLAIM_R2_LENGTH_INDEPENDENCE,
	CLAIM_R3_WEAK_LINK,
];

/**
 * All thesis claims (T1-T8 + R1-R3).
 */
export const THESIS_CLAIMS: EvaluationClaim[] = [
	...TRAVERSAL_CLAIMS,
	...RANKING_CLAIMS,
];

/**
 * Claims by category.
 */
export const CLAIMS_BY_CATEGORY = {
	traversal: TRAVERSAL_CLAIMS,
	ranking: RANKING_CLAIMS,
} as const;

/**
 * Get claims by tag.
 *
 * @param tag - Tag to filter by
 * @returns Claims with the specified tag
 */
export const getClaimsByTag = (tag: string): EvaluationClaim[] => {
	return THESIS_CLAIMS.filter((claim) => claim.tags?.includes(tag));
};

/**
 * Get claims involving a specific SUT.
 *
 * @param sutId - SUT ID to filter by
 * @returns Claims where the SUT is primary or baseline
 */
export const getClaimsBySut = (sutId: string): EvaluationClaim[] => {
	return THESIS_CLAIMS.filter(
		(claim) => claim.sut === sutId || claim.baseline === sutId
	);
};
