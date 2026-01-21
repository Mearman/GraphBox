/**
 * Evaluation Case Type Definitions
 *
 * A case represents a single evaluation scenario with:
 * - Deterministic inputs (graph, seeds, etc.)
 * - Expected behavior or ground truth (if applicable)
 * - Grouping metadata for aggregation
 */

/**
 * Primitive types allowed in case summaries.
 */
export type Primitive = string | number | boolean | null;

/**
 * Reference to an external artefact (graph file, path set, etc.).
 */
export interface ArtefactReference {
	/** Type of artefact */
	type: "graph" | "path-set" | "subgraph" | "embedding" | "other";

	/** URI or path to artefact */
	uri: string;

	/** Content hash for integrity verification */
	hash?: string;

	/** Optional metadata */
	metadata?: Record<string, Primitive>;
}

/**
 * Input specification for an evaluation case.
 */
export interface CaseInputs {
	/** Scalar summary values (e.g., { nodes: 100, seeds: ["a", "b"] }) */
	summary?: Record<string, Primitive | Primitive[]>;

	/** References to external artefacts */
	artefacts?: ArtefactReference[];
}

/**
 * A single evaluation case.
 *
 * The caseId should be a deterministic hash of the canonical inputs
 * to ensure reproducibility across runs.
 */
export interface EvaluationCase {
	/** Deterministic ID (SHA-256 of canonical inputs) */
	caseId: string;

	/** Human-readable name */
	name?: string;

	/** Grouping label for aggregation (e.g., "scale-free", "bidirectional") */
	caseClass?: string;

	/** Input specification */
	inputs: CaseInputs;

	/** Optional expected output for oracle-based evaluation */
	expectedOutput?: {
		/** Expected summary values */
		summary?: Record<string, Primitive | Primitive[]>;

		/** Expected labels */
		labels?: Record<string, Primitive>;

		/** Expected ranking (for ranking tasks) */
		ranking?: Array<{ itemId: string; score: number }>;
	};

	/** Version of this case definition */
	version?: string;

	/** Tags for filtering */
	tags?: readonly string[];
}

/**
 * Factory function for creating graph expanders from cases.
 * This allows cases to be portable across different graph implementations.
 */
export type CaseExpanderFactory<TExpander> = (
	caseInputs: CaseInputs
) => Promise<TExpander>;

/**
 * Complete case definition with factory.
 */
export interface CaseDefinition<TExpander = unknown> {
	/** The case specification */
	case: EvaluationCase;

	/** Factory for creating the graph expander */
	createExpander: CaseExpanderFactory<TExpander>;

	/** Factory for getting seed nodes */
	getSeeds: (caseInputs: CaseInputs) => string[];
}
