/**
 * Helper functions for integration tests
 */

import type { AnalyzerEdge, AnalyzerGraph, AnalyzerVertex } from "../../analyzer/types";
import type { TestGraph } from "../../generation/generator";

/**
 * Convert a TestGraph to an AnalyzerGraph for classification.
 * @param testGraph
 */
export const toAnalyzerGraph = (testGraph: TestGraph): AnalyzerGraph => {
	const vertices: AnalyzerVertex[] = testGraph.nodes.map(node => ({
		id: node.id,
		label: node.type,
		attrs: node.data,
	}));

	const isDirected = testGraph.spec.directionality.kind === "directed";

	const edges: AnalyzerEdge[] = testGraph.edges.map((edge, index) => ({
		id: `e${index}`,
		endpoints: [edge.source, edge.target] as const,
		directed: isDirected,
		weight: edge.weight,
	}));

	return { vertices, edges };
};
