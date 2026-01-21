/**
 * System Under Test (SUT) Type Definitions
 *
 * SUTs represent the algorithms being evaluated. Each SUT has a role that
 * determines how its results are interpreted during evaluation:
 *
 * - primary: The algorithm being proposed/evaluated (e.g., Degree-Prioritised)
 * - baseline: Comparison algorithms (e.g., Standard BFS, Frontier-Balanced)
 * - oracle: Ground truth provider for correctness validation
 */

/**
 * Role of the SUT in evaluation.
 *
 * - `primary`: The algorithm being proposed/evaluated
 * - `baseline`: Comparison algorithm for relative evaluation
 * - `oracle`: Ground truth provider for correctness validation
 */
export type SutRole = "primary" | "baseline" | "oracle";

/**
 * Registration information for a System Under Test.
 */
export interface SutRegistration {
	/** Unique identifier (e.g., "degree-prioritised-v1.0.0") */
	id: string;

	/** Human-readable name (e.g., "Degree-Prioritised Expansion") */
	name: string;

	/** Version string for reproducibility */
	version: string;

	/** Role in evaluation */
	role: SutRole;

	/** Configuration parameters (immutable) */
	config: Readonly<Record<string, unknown>>;

	/** Searchable tags for filtering */
	tags: readonly string[];

	/** Optional description for documentation */
	description?: string;
}

/**
 * Factory function type for instantiating SUTs.
 * SUTs are created lazily with case-specific parameters.
 *
 * @template TExpander - The graph expander type
 * @template TResult - The algorithm result type
 */
export type SutFactory<TExpander, TResult> = (
	expander: TExpander,
	seeds: readonly string[],
	config?: Record<string, unknown>
) => SutInstance<TResult>;

/**
 * Runtime instance of a SUT ready for execution.
 */
export interface SutInstance<TResult> {
	/** Execute the algorithm and return results */
	run(): Promise<TResult>;
}

/**
 * Complete SUT definition including factory and metadata.
 */
export interface SutDefinition<TExpander = unknown, TResult = unknown> {
	/** Registration metadata */
	registration: SutRegistration;

	/** Factory for creating instances */
	factory: SutFactory<TExpander, TResult>;
}
