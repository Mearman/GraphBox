/**
 * Type converters between GraphJson, AnalyzerGraph, and TestGraph.
 *
 * Handles conversions needed for CLI commands:
 * - GraphJson → AnalyzerGraph (for analyze command)
 * - GraphJson → TestGraph (for validate command)
 * - TestGraph → GraphJson (for generate command output)
 */

import type { AnalyzerEdge, AnalyzerGraph, AnalyzerVertex } from "../analyzer/types";
import type { GraphEdge, GraphJson, GraphMeta, GraphNode } from "../formats/gml/types";
import type { TestEdge, TestGraph, TestNode } from "../generation/generators/types";
import type { GraphSpec } from "../generation/spec";

/**
 * Convert GraphJson to AnalyzerGraph for analysis.
 * @param json
 */
export const graphJsonToAnalyzer = (json: GraphJson): AnalyzerGraph => {
	const vertices: AnalyzerVertex[] = json.nodes.map(node => ({
		id: node.id,
		label: node.label,
		attrs: Object.fromEntries(Object.entries(node)
			.filter(([key]) => key !== "id" && key !== "label")
			.map(( [key, value]) => [key, value])),
	}));

	const edges: AnalyzerEdge[] = json.edges.map((edge, index) => ({
		id: `e${index}`,
		endpoints: [edge.source, edge.target],
		directed: edge.directed ?? json.meta.directed,
		weight: edge.weight,
		label: typeof edge.label === "string" ? edge.label : undefined,
		attrs: Object.fromEntries(Object.entries(edge)
			.filter(([key]) => !["source", "target", "directed", "weight", "label"].includes(key))
			.map(( [key, value]) => [key, value])),
	}));

	return { vertices, edges };
};

/**
 * Convert GraphJson to TestGraph for validation.
 * Requires a GraphSpec to be provided.
 * @param json
 * @param spec
 */
export const graphJsonToTest = (json: GraphJson, spec: GraphSpec): TestGraph => {
	const nodes: TestNode[] = json.nodes.map(node => {
		const testNode: TestNode = { id: node.id };

		// Preserve type if present
		if (typeof node.type === "string") {
			testNode.type = node.type;
		}

		// Preserve partition if present (for bipartite graphs)
		if (node.partition === "left" || node.partition === "right") {
			testNode.partition = node.partition;
		}

		// Preserve all other attributes in data
		const data: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(node)) {
			if (!["id", "label", "type", "partition"].includes(key)) {
				data[key] = value;
			}
		}
		if (Object.keys(data).length > 0) {
			testNode.data = data;
		}

		return testNode;
	});

	const edges: TestEdge[] = json.edges.map(edge => {
		const testEdge: TestEdge = {
			source: edge.source,
			target: edge.target,
		};

		if (edge.weight !== undefined) {
			testEdge.weight = edge.weight;
		}

		if (typeof edge.type === "string") {
			testEdge.type = edge.type;
		}

		return testEdge;
	});

	return { nodes, edges, spec };
};

/**
 * Convert TestGraph to GraphJson for output.
 * Creates minimal metadata.
 * @param graph
 * @param metaOverrides
 */
export const testGraphToJson = (
	graph: TestGraph,
	metaOverrides?: Partial<GraphMeta>
): GraphJson => {
	const nodes: GraphNode[] = graph.nodes.map(node => {
		const jsonNode: GraphNode = { id: node.id };

		if (node.type !== undefined) {
			jsonNode.type = node.type;
		}

		if (node.partition !== undefined) {
			jsonNode.partition = node.partition;
		}

		// Merge data attributes
		if (node.data) {
			for (const [key, value] of Object.entries(node.data)) {
				jsonNode[key] = value;
			}
		}

		return jsonNode;
	});

	const edges: GraphEdge[] = graph.edges.map(edge => {
		const jsonEdge: GraphEdge = {
			source: edge.source,
			target: edge.target,
		};

		if (edge.weight !== undefined) {
			jsonEdge.weight = edge.weight;
		}

		if (edge.type !== undefined) {
			jsonEdge.type = edge.type;
		}

		return jsonEdge;
	});

	// Determine directionality from spec
	const directed = graph.spec.directionality.kind === "directed";

	// Create minimal metadata
	const meta: GraphMeta = {
		name: metaOverrides?.name ?? "Generated Graph",
		description: metaOverrides?.description ?? "Graph generated from specification",
		source: metaOverrides?.source ?? "graphbox",
		url: metaOverrides?.url ?? "",
		citation: metaOverrides?.citation ?? {
			authors: ["graphbox"],
			title: "Generated Graph",
			year: new Date().getFullYear(),
		},
		retrieved: new Date().toISOString(),
		directed,
		...metaOverrides,
	};

	return { meta, nodes, edges };
};

/**
 * Convert AnalyzerGraph to GraphJson for output.
 * Creates minimal metadata.
 * @param graph
 * @param directed
 * @param metaOverrides
 */
export const analyzerGraphToJson = (
	graph: AnalyzerGraph,
	directed: boolean,
	metaOverrides?: Partial<GraphMeta>
): GraphJson => {
	const nodes: GraphNode[] = graph.vertices.map(vertex => {
		const node: GraphNode = { id: vertex.id };

		if (vertex.label !== undefined) {
			node.label = vertex.label;
		}

		// Merge attributes
		if (vertex.attrs) {
			for (const [key, value] of Object.entries(vertex.attrs)) {
				node[key] = value;
			}
		}

		return node;
	});

	const edges: GraphEdge[] = graph.edges.map(edge => {
		// Only support binary edges for now
		if (edge.endpoints.length !== 2) {
			throw new Error(`Cannot convert hyperedge (${edge.endpoints.length} endpoints) to GraphJson`);
		}

		const graphEdge: GraphEdge = {
			source: edge.endpoints[0],
			target: edge.endpoints[1],
		};

		if (edge.weight !== undefined) {
			graphEdge.weight = edge.weight;
		}

		if (edge.label !== undefined) {
			graphEdge.label = edge.label;
		}

		// Merge attributes
		if (edge.attrs) {
			for (const [key, value] of Object.entries(edge.attrs)) {
				graphEdge[key] = value;
			}
		}

		return graphEdge;
	});

	// Create minimal metadata
	const meta: GraphMeta = {
		name: metaOverrides?.name ?? "Analyzed Graph",
		description: metaOverrides?.description ?? "Graph analyzed by graphbox",
		source: metaOverrides?.source ?? "graphbox",
		url: metaOverrides?.url ?? "",
		citation: metaOverrides?.citation ?? {
			authors: ["graphbox"],
			title: "Analyzed Graph",
			year: new Date().getFullYear(),
		},
		retrieved: new Date().toISOString(),
		directed,
		...metaOverrides,
	};

	return { meta, nodes, edges };
};
