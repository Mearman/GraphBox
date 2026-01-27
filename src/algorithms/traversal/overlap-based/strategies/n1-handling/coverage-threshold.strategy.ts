import type { FrontierState } from "../../frontier-state.js";
import type { N1HandlingStrategy } from "./n1-handling-strategy.js";

/**
 * Configuration for CoverageThresholdStrategy.
 */
export interface CoverageThresholdConfig {
	/**
	 * Coverage percentage threshold for termination (0-100).
	 * Default: 80 (terminate when 80% of graph is visited)
	 */
	coverageThreshold?: number;

	/**
	 * Minimum iterations before allowing coverage-based termination.
	 * Default: 10 (prevents premature termination on tiny graphs)
	 */
	minIterations?: number;
}

/**
 * Coverage Threshold N=1 Handling Strategy
 *
 * Terminates single-seed expansion when a percentage of the graph has been visited.
 * This provides a principled stopping criterion for the N=1 case where overlap
 * with other seeds is impossible.
 *
 * **Algorithm**: Terminate when (visited_nodes / total_nodes) >= threshold,
 * subject to a minimum iteration count to prevent premature termination.
 *
 * **Complexity**: O(1) per iteration check
 *
 * **Thesis Alignment**: This strategy provides a coverage-based termination
 * criterion for ego-network sampling, ensuring sufficient exploration while
 * avoiding exhaustive traversal of large graphs.
 */
export class CoverageThresholdStrategy implements N1HandlingStrategy {
	/** Strategy identifier for naming SUT variants */
	readonly id = "coverage-threshold";

	/** Coverage percentage threshold (0-100) */
	private readonly threshold: number;

	/** Minimum iterations before termination allowed */
	private readonly minIterations: number;

	/**
	 * Create a CoverageThreshold strategy.
	 *
	 * @param config - Strategy configuration
	 */
	constructor(config: CoverageThresholdConfig = {}) {
		this.threshold = config.coverageThreshold ?? 80;
		this.minIterations = config.minIterations ?? 10;
	}

	/**
	 * Check if single-seed expansion should terminate.
	 *
	 * @param frontier - The sole frontier's state
	 * @param totalNodes - Total nodes in graph (for coverage calculation)
	 * @param iteration - Current iteration count
	 * @returns true if should terminate
	 */
	shouldTerminate(
		frontier: FrontierState,
		totalNodes?: number,
		iteration?: number
	): boolean {
		// Require minimum iterations before allowing termination
		if (iteration !== undefined && iteration < this.minIterations) {
			return false;
		}

		// If total nodes not provided, cannot calculate coverage
		if (totalNodes === undefined) {
			return false;
		}

		// Calculate coverage percentage
		const visitedCount = frontier.visited.size;
		const coverage = (visitedCount / totalNodes) * 100;

		// Terminate if coverage threshold reached
		return coverage >= this.threshold;
	}
}
