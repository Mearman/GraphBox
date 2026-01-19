/**
 * Priority Calculation for Thesis-Aligned Degree-Prioritised Expansion
 *
 * Implements the priority function from Equation 4.106:
 * $$\pi(v) = \frac{\deg^{+}(v) + \deg^{-}(v)}{w_V(v) + \epsilon}$$
 *
 * @module traversal/priority-calculator
 */

/**
 * Default epsilon value for division-by-zero prevention.
 */
export const DEFAULT_EPSILON = 1e-10;

/**
 * Default node weight (unweighted nodes).
 */
export const DEFAULT_NODE_WEIGHT = 1;

/**
 * Options for weighted priority calculation.
 */
export interface PriorityOptions {
	/**
	 * Node weight for normalization (w_V(v) in thesis formula).
	 * Higher values decrease priority (node is considered more important/central).
	 * Default: 1 (unweighted nodes).
	 */
	nodeWeight?: number;

	/**
	 * Small constant to prevent division by zero.
	 * Default: 1e-10.
	 */
	epsilon?: number;

	/**
	 * Whether to use simple degree count (legacy behavior) or weighted formula.
	 * Default: false (use weighted formula).
	 */
	useSimpleDegree?: boolean;
}

/**
 * Calculate thesis-aligned priority for a node.
 *
 * Priority determines visitation order: lower priority = visited earlier.
 * This implements Equation 4.106 from the thesis.
 *
 * @param outDegree - Weighted out-degree (sum of outgoing edge weights)
 * @param inDegree - Weighted in-degree (sum of incoming edge weights)
 * @param options - Configuration options
 * @returns Priority value (lower = higher priority)
 *
 * @example
 * ```typescript
 * // Unweighted node with 10 total connections
 * const priority = calculatePriority(5, 5, {});
 * // Returns: (5 + 5) / (1 + 1e-10) ≈ 10
 *
 * // Weighted node with high importance (weight = 5)
 * const priority = calculatePriority(50, 50, { nodeWeight: 5 });
 * // Returns: (50 + 50) / (5 + 1e-10) ≈ 20
 *
 * // Low-degree peripheral node
 * const priority = calculatePriority(2, 1, {});
 * // Returns: (2 + 1) / (1 + 1e-10) ≈ 3
 * ```
 */
export const calculatePriority = (outDegree: number, inDegree: number, options: PriorityOptions = {}): number => {
	const {
		nodeWeight = DEFAULT_NODE_WEIGHT,
		epsilon = DEFAULT_EPSILON,
		useSimpleDegree = false,
	} = options;

	// Legacy behavior: simple degree count without weighting
	if (useSimpleDegree) {
		return outDegree + inDegree;
	}

	// Thesis formula: (deg⁺(v) + deg⁻(v)) / (w_V(v) + ε)
	const weightedDegree = outDegree + inDegree;
	const denominator = nodeWeight + epsilon;

	return weightedDegree / denominator;
};

/**
 * Calculate thesis-aligned priority from neighbor lists.
 *
 * This helper function calculates priority when you have arrays of
 * incoming and outgoing neighbors with their weights.
 *
 * @param outNeighbors - Array of (targetId, weight) tuples for outgoing edges
 * @param inNeighbors - Array of (sourceId, weight) tuples for incoming edges
 * @param options - Configuration options
 * @returns Priority value (lower = higher priority)
 *
 * @example
 * ```typescript
 * const outNeighbors = [
 *   { targetId: 'B', weight: 1 },
 *   { targetId: 'C', weight: 2 },
 * ];
 * const inNeighbors = [
 *   { sourceId: 'A', weight: 1 },
 *   { sourceId: 'D', weight: 3 },
 * ];
 * const priority = calculatePriorityFromNeighbors(outNeighbors, inNeighbors);
 * // Returns: (1 + 2 + 1 + 3) / 1 = 7
 * ```
 */
export const calculatePriorityFromNeighbors = (outNeighbors: Array<{ targetId: string; weight?: number }>, inNeighbors: Array<{ sourceId: string; weight?: number }>, options: PriorityOptions = {}): number => {
	const outDegree = outNeighbors.reduce((sum, edge) => sum + (edge.weight ?? 1), 0);
	const inDegree = inNeighbors.reduce((sum, edge) => sum + (edge.weight ?? 1), 0);

	return calculatePriority(outDegree, inDegree, options);
};

/**
 * Create a priority calculator bound to specific options.
 *
 * Useful for creating multiple calculators with different configurations.
 *
 * @param options - Configuration options (will be merged with defaults)
 * @returns Function that calculates priority given out/in degrees
 *
 * @example
 * ```typescript
 * // Calculator for importance-weighted nodes
 * const weightedCalculator = createPriorityCalculator({ nodeWeight: 5 });
 * const priority = weightedCalculator(10, 20);
 * // Returns: (10 + 20) / (5 + 1e-10) ≈ 6
 *
 * // Calculator for unweighted nodes
 * const simpleCalculator = createPriorityCalculator({});
 * const priority = simpleCalculator(10, 20);
 * // Returns: (10 + 20) / (1 + 1e-10) ≈ 30
 * ```
 */
export const createPriorityCalculator = (options: PriorityOptions = {}): (outDegree: number, inDegree: number) => number => {
	const mergedOptions = {
		nodeWeight: DEFAULT_NODE_WEIGHT,
		epsilon: DEFAULT_EPSILON,
		useSimpleDegree: false,
		...options,
	};

	return (outDegree: number, inDegree: number) =>
		calculatePriority(outDegree, inDegree, mergedOptions);
};

/**
 * Calculate priority using simple degree count (legacy behavior).
 *
 * This is provided for backward compatibility with implementations
 * that use raw degree counts without weighting.
 *
 * @param totalDegree - Total degree (in + out, unweighted)
 * @returns The same degree value (identity function)
 *
 * @example
 * ```typescript
 * const priority = legacyCalculatePriority(42);
 * // Returns: 42
 * ```
 */
export const legacyCalculatePriority = (totalDegree: number): number => totalDegree;
