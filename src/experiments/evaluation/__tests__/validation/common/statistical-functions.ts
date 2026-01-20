/**
 * Statistical Test Utilities
 *
 * Collection of statistical functions for hypothesis testing,
 * effect size calculation, and confidence intervals.
 */

/**
 * Mann-Whitney U test for comparing two independent samples.
 * Tests whether two populations have the same distribution.
 *
 * H0: Both populations have the same distribution
 * H1: Populations have different distributions
 *
 * Returns p-value (smaller = more significant difference)
 * @param sampleA
 * @param sampleB
 */
export const mannWhitneyUTest = (sampleA: number[], sampleB: number[]): {
	u: number;
	pValue: number;
	significant: boolean;
} => {
	// Rank all values combined
	const combined = [...sampleA, ...sampleB];
	const sorted = [...combined].sort((a, b) => a - b);

	// Assign ranks (handle ties)
	const ranks = new Map<number, number[]>();
	for (const [index, value] of sorted.entries()) {
		if (!ranks.has(value)) {
			ranks.set(value, []);
		}
		ranks.get(value)!.push(index + 1);
	}

	// Average rank for tied values
	const avgRanks = new Map<number, number>();
	for (const [value, positions] of ranks) {
		avgRanks.set(value, positions.reduce((a, b) => a + b, 0) / positions.length);
	}

	// Sum ranks for each sample
	const rankSumA = sampleA.reduce((sum, value) => sum + (avgRanks.get(value) ?? 0), 0);
	const rankSumB = sampleB.reduce((sum, value) => sum + (avgRanks.get(value) ?? 0), 0);

	// Calculate U statistics
	const n1 = sampleA.length;
	const n2 = sampleB.length;
	const u1 = rankSumA - (n1 * (n1 + 1)) / 2;
	const u2 = rankSumB - (n2 * (n2 + 1)) / 2;
	const u = Math.min(u1, u2);

	// Calculate z-score for large samples
	const meanU = (n1 * n2) / 2;
	const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
	const z = stdU > 0 ? (u - meanU) / stdU : 0;

	// Two-tailed p-value from z-score (approximation)
	const pValue = 2 * (1 - normalCDF(Math.abs(z)));

	return {
		u,
		pValue,
		significant: pValue < 0.05, // 95% confidence level
	};
};

/**
 * Standard normal cumulative distribution function.
 * @param z
 */
export const normalCDF = (z: number): number => {
	// Abramowitz and Stegun approximation
	const sign = z < 0 ? -1 : 1;
	z = Math.abs(z) / Math.sqrt(2);
	const a1 = 0.254_829_592;
	const a2 = -0.284_496_736;
	const a3 = 1.421_413_741;
	const a4 = -1.453_152_027;
	const a5 = 1.061_405_429;
	const p = 0.327_591_1;

	const t = 1 / (1 + p * z);
	const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
	return 0.5 * (1 + sign * y);
};

/**
 * Calculate Cohen's d effect size.
 * Measures the standardized difference between two means.
 *
 * Interpretation:
 * - 0.2: Small effect
 * - 0.5: Medium effect
 * - 0.8: Large effect
 * @param sampleA
 * @param sampleB
 */
export const cohensD = (sampleA: number[], sampleB: number[]): number => {
	const n1 = sampleA.length;
	const n2 = sampleB.length;

	const mean1 = sampleA.reduce((a, b) => a + b, 0) / n1;
	const mean2 = sampleB.reduce((a, b) => a + b, 0) / n2;

	const variable1 = sampleA.reduce((sum, value) => sum + (value - mean1) ** 2, 0) / (n1 - 1);
	const variable2 = sampleB.reduce((sum, value) => sum + (value - mean2) ** 2, 0) / (n2 - 1);

	const pooledStd = Math.sqrt(((n1 - 1) * variable1 + (n2 - 1) * variable2) / (n1 + n2 - 2));

	return pooledStd > 0 ? Math.abs(mean1 - mean2) / pooledStd : 0;
};

/**
 * Calculate confidence interval for a mean.
 * @param values
 * @param confidence
 */
export const confidenceInterval = (values: number[], confidence = 0.95): { lower: number; upper: number } => {
	const n = values.length;
	const mean = values.reduce((a, b) => a + b, 0) / n;
	const std = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1));
	const se = std / Math.sqrt(n);
	const t = 1.96; // Approximation for large samples (95% CI)

	const margin = t * se;
	return {
		lower: mean - margin,
		upper: mean + margin,
	};
};

/**
 * Calculate Jaccard similarity between two sets.
 * @param setA
 * @param setB
 */
export const jaccardSimilarity = <T>(setA: Set<T>, setB: Set<T>): number => {
	const intersection = new Set([...setA].filter((x) => setB.has(x)));
	const union = new Set([...setA, ...setB]);
	return union.size === 0 ? 1 : intersection.size / union.size;
};

/**
 * Calculate path diversity (entropy of path lengths).
 * @param paths
 */
export const pathDiversity = (paths: Array<{ nodes: string[] }>): number => {
	if (paths.length === 0) return 0;

	const lengths = paths.map((p) => p.nodes.length);
	const counts = new Map<number, number>();

	for (const length of lengths) {
		counts.set(length, (counts.get(length) ?? 0) + 1);
	}

	// Calculate Shannon entropy
	let entropy = 0;
	const total = lengths.length;

	for (const count of counts.values()) {
		const p = count / total;
		entropy -= p * Math.log2(p);
	}

	// Normalize by max possible entropy
	const maxEntropy = Math.log2(counts.size);
	return maxEntropy > 0 ? entropy / maxEntropy : 0;
};

/**
 * Coverage metric for systematic literature review.
 * Measures how well the sampled subgraph covers different topical regions.
 * @param sampledNodes
 * @param graph
 * @param graph.getDegree
 * @param graph.getAllNodeIds
 */
export const calculateTopicCoverage = (sampledNodes: Set<string>, graph: { getDegree(nodeId: string): number; getAllNodeIds(): string[] }): {
	coverage: number;
	avgDegree: number;
	hubRatio: number;
} => {
	let totalDegree = 0;
	let hubCount = 0;

	for (const nodeId of sampledNodes) {
		const degree = graph.getDegree(nodeId);
		totalDegree += degree;
		if (degree >= 10) hubCount++; // "Hub" threshold for citation networks
	}

	const avgDegree = sampledNodes.size > 0 ? totalDegree / sampledNodes.size : 0;
	const hubRatio = sampledNodes.size > 0 ? hubCount / sampledNodes.size : 0;

	// Coverage: proportion of high-degree nodes included
	const allNodes = graph.getAllNodeIds();
	const allHubs = allNodes.filter((id) => graph.getDegree(id) >= 10);
	const sampledHubs = [...sampledNodes].filter((id) => graph.getDegree(id) >= 10);

	const coverage = allHubs.length > 0 ? sampledHubs.length / allHubs.length : 0;

	return { coverage, avgDegree, hubRatio };
};
