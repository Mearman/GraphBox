/**
 * Test graph types for unit tests.
 *
 * These types are used by test fixtures to create reproducible graph structures
 * for testing graph algorithms.
 */

/**
 * Test node type for unit tests.
 */
export interface TestNode {
	/** Unique identifier for the test node */
	id: string;
}

/**
 * Test edge type for unit tests.
 */
export interface TestEdge {
	/** Source node ID */
	source: string;
	/** Target node ID */
	target: string;
	/** Edge type/label */
	type?: string;
}

/**
 * Test graph structure for unit tests.
 *
 * Provides nodes and edges arrays for creating test graphs.
 */
export interface TestGraph {
	/** Collection of test nodes */
	nodes: TestNode[];
	/** Collection of test edges */
	edges: TestEdge[];
	/** Graph specification */
	spec: {
		/** Directed/undirected flag */
		directionality: {
			kind: "directed" | "undirected";
		};
	};
}
