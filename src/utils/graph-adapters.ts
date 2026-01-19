/**
 * Graph Type Adapters
 *
 * Converts between CoreGraph and legacy graph types (AnalyzerGraph, TestGraph, GraphJson).
 * These adapters enable backward compatibility while migrating to unified CoreGraph types.
 *
 * @module utils/graph-adapters
 */

import type {
	AnalyzerEdge,
	AnalyzerGraph,
	AnalyzerVertex,
} from "../analyzer/types.js";
// Re-export GML types with namespacing to avoid conflicts
import type {
	GraphEdge as GmlGraphEdge,
	GraphJson,
	GraphMeta as GmlGraphMeta,
	GraphNode as GmlGraphNode,
} from "../formats/gml/types.js";
import type {
	TestEdge,
	TestGraph,
	TestNode,
} from "../generation/generators/types.js";
import type { GraphSpec } from "../generation/spec.js";
import type {
	CoreGraph,
	DocumentedGraph,
	GraphEdge as CoreGraphEdge,
	GraphMeta as CoreGraphMeta,
	GraphNode as CoreGraphNode,
	SpecifiedGraph,
} from "../types/graph-core.js";

// ============================================================================
// Analyzer Graph Adapters
// ============================================================================

/**
 * Convert CoreGraph to AnalyzerGraph format.
 *
 * Note: Hyperedges are not supported by CoreGraph, so all edges become binary edges.
 * The `directed` property is taken from the graph-level default or per-edge override.
 *
 * @param core - CoreGraph to convert
 * @returns AnalyzerGraph representation
 */
export const toAnalyzerGraph = (core: CoreGraph): AnalyzerGraph => {
	const defaultDirected = core.directed ?? false;

	const vertices: AnalyzerVertex[] = core.nodes.map((node) => ({
		id: node.id,
		label: node.label,
		attrs: extractNodeAttributes(node),
	}));

	const edges: AnalyzerEdge[] = core.edges.map((edge, index) => {
		const directed = edge.directed ?? defaultDirected;
		return {
			id: `e${index}`,
			endpoints: [edge.source, edge.target],
			directed,
			weight: edge.weight,
			label: typeof edge.type === "string" ? edge.type : undefined,
			attrs: extractEdgeAttributes(edge),
		};
	});

	return { vertices, edges };
};

/**
 * Convert AnalyzerGraph to CoreGraph format.
 *
 * Only binary edges (length === 2) are converted. Hyperedges are dropped with a warning.
 * Mixed directionality is preserved via per-edge `directed` flags.
 *
 * @param analyzer - AnalyzerGraph to convert
 * @returns CoreGraph representation
 */
export const fromAnalyzerGraph = (analyzer: AnalyzerGraph): CoreGraph => {
	const nodes: CoreGraphNode[] = analyzer.vertices.map((v) => ({
		id: v.id,
		label: v.label,
		...v.attrs,
	}));

	// Determine if graph is predominantly directed
	const directedCount = analyzer.edges.filter((e) => e.directed).length;
	const defaultDirected = directedCount > analyzer.edges.length / 2;

	const edges: CoreGraphEdge[] = [];
	for (const e of analyzer.edges) {
		// Skip hyperedges
		if (e.endpoints.length !== 2) {
			console.warn(
				`Hyperedge with ${e.endpoints.length} endpoints dropped during conversion`
			);
			continue;
		}

		edges.push({
			source: e.endpoints[0],
			target: e.endpoints[1],
			directed: e.directed === defaultDirected ? undefined : e.directed,
			weight: e.weight,
			type: e.label,
			...e.attrs,
		});
	}

	return { nodes, edges, directed: defaultDirected };
};

// ============================================================================
// Test Graph Adapters
// ============================================================================

/**
 * Convert CoreGraph to TestGraph by adding a spec.
 *
 * @param core - CoreGraph to convert
 * @param spec - GraphSpec to attach
 * @returns TestGraph representation
 */
export const toTestGraph = (core: CoreGraph, spec: GraphSpec): TestGraph => {
	const nodes: TestNode[] = core.nodes.map((node) => ({
		id: node.id,
		type: node.type,
		partition: node.partition,
		data: extractNodeAttributes(node),
	}));

	const edges: TestEdge[] = core.edges.map((edge) => ({
		source: edge.source,
		target: edge.target,
		weight: edge.weight,
		type: edge.type,
	}));

	return { nodes, edges, spec };
};

/**
 * Convert TestGraph to CoreGraph.
 *
 * @param test - TestGraph to convert
 * @returns CoreGraph representation
 */
export const fromTestGraph = (test: TestGraph): CoreGraph => {
	const nodes: CoreGraphNode[] = test.nodes.map((node) => ({
		id: node.id,
		type: node.type,
		partition: node.partition,
		...node.data,
	}));

	const edges: CoreGraphEdge[] = test.edges.map((edge) => ({
		source: edge.source,
		target: edge.target,
		weight: edge.weight,
		type: edge.type,
	}));

	// Infer directionality from spec if available
	const directed =
		test.spec.directionality.kind === "directed"
			? true
			: (test.spec.directionality.kind === "undirected"
				? false
				: undefined);

	return { nodes, edges, directed };
};

/**
 * Wrap CoreGraph with a GraphSpec to create SpecifiedGraph.
 *
 * @param core - CoreGraph to wrap
 * @param spec - GraphSpec to attach
 * @returns SpecifiedGraph
 */
export const toSpecifiedGraph = (core: CoreGraph, spec: GraphSpec): SpecifiedGraph => ({ ...core, spec });

/**
 * Extract CoreGraph from SpecifiedGraph (removes spec).
 *
 * @param specified - SpecifiedGraph to unwrap
 * @returns CoreGraph without spec
 */
export const fromSpecifiedGraph = (specified: SpecifiedGraph): CoreGraph => {

	const { spec: _spec, ...core } = specified;
	return core;
};

// ============================================================================
// Documented Graph Adapters (File I/O)
// ============================================================================

/**
 * Wrap CoreGraph with metadata to create DocumentedGraph.
 *
 * @param core - CoreGraph to wrap
 * @param meta - Metadata to attach
 * @returns DocumentedGraph
 */
export const toDocumentedGraph = (core: CoreGraph, meta: CoreGraphMeta): DocumentedGraph => ({ ...core, meta });

/**
 * Extract CoreGraph from DocumentedGraph (removes metadata).
 *
 * @param doc - DocumentedGraph to unwrap
 * @param document
 * @returns CoreGraph without metadata
 */
export const fromDocumentedGraph = (document: DocumentedGraph): CoreGraph => {

	const { meta: _meta, ...core } = document;
	return core;
};

/**
 * Convert GraphJson (GML format) to DocumentedGraph.
 *
 * @param json - GraphJson from file parser
 * @returns DocumentedGraph
 */
export const fromGraphJson = (json: GraphJson): DocumentedGraph => {
	// Map GML GraphMeta to CoreGraphMeta
	const meta: CoreGraphMeta = {
		title: json.meta.name,
		description: json.meta.description,
		source: json.meta.source,
		creator: json.meta.creator,
		date: json.meta.retrieved,
	};

	const nodes: CoreGraphNode[] = json.nodes.map(
		(node: GmlGraphNode): CoreGraphNode => ({
			id: node.id,
			label: node.label,
			...extractGmlNodeAttributes(node),
		})
	);

	const edges: CoreGraphEdge[] = json.edges.map(
		(edge: GmlGraphEdge): CoreGraphEdge => ({
			source: edge.source,
			target: edge.target,
			weight: edge.weight,
			directed: edge.directed,
			...extractGmlEdgeAttributes(edge),
		})
	);

	return {
		nodes,
		edges,
		directed: json.meta.directed,
		meta,
	};
};

/**
 * Convert DocumentedGraph to GraphJson (GML format).
 *
 * @param doc - DocumentedGraph to convert
 * @param document
 * @returns GraphJson for file serialization
 */
export const toGraphJson = (document: DocumentedGraph): GraphJson => {
	// Map CoreGraphMeta to GML GraphMeta (with required fields)
	const meta: GmlGraphMeta = {
		name: document.meta.title ?? "Untitled Graph",
		description: document.meta.description ?? "",
		source: document.meta.source ?? "",
		url: "", // Not available in CoreGraphMeta
		citation: {
			// Empty citation
			authors: [],
			title: document.meta.title ?? "Untitled",
			year: new Date().getFullYear(),
		},
		retrieved: document.meta.date ?? new Date().toISOString(),
		directed: document.directed ?? false,
		creator: document.meta.creator,
	};

	const nodes: GmlGraphNode[] = document.nodes.map((node) => {
		const { id, label, type, partition, ...rest } = node;
		return {
			id,
			label,
			...(type !== undefined && { type }),
			...(partition !== undefined && { partition }),
			...rest,
		};
	});

	const edges: GmlGraphEdge[] = document.edges.map((edge) => {
		const { source, target, weight, directed, type, ...rest } = edge;
		return {
			source,
			target,
			...(weight !== undefined && { weight }),
			...(directed !== undefined && { directed }),
			...(type !== undefined && { type }),
			...rest,
		};
	});

	return { meta, nodes, edges };
};

// ============================================================================
// Universal Converter
// ============================================================================

/**
 * Convert any graph type to CoreGraph.
 *
 * Supports:
 * - AnalyzerGraph
 * - TestGraph
 * - SpecifiedGraph
 * - DocumentedGraph
 * - GraphJson
 *
 * @param graph - Graph in any supported format
 * @returns CoreGraph representation
 */
export const toCoreGraph = (graph:
    | CoreGraph
    | AnalyzerGraph
    | TestGraph
    | SpecifiedGraph
    | DocumentedGraph
    | GraphJson): CoreGraph => {
	// Already CoreGraph
	if ("nodes" in graph && "edges" in graph && !("vertices" in graph)) {
		// Remove spec/meta if present

		const { spec: _spec, meta: _meta, ...core } = graph as SpecifiedGraph &
      DocumentedGraph &
      CoreGraph;
		return core;
	}

	// AnalyzerGraph
	if ("vertices" in graph) {
		return fromAnalyzerGraph(graph as AnalyzerGraph);
	}

	// TestGraph
	if ("spec" in graph && "nodes" in graph) {
		return fromTestGraph(graph as TestGraph);
	}

	// GraphJson
	if ("meta" in graph) {
		const document = fromGraphJson(graph as GraphJson);
		return fromDocumentedGraph(document);
	}

	throw new Error("Unknown graph type");
};

// ============================================================================
// Attribute Extractors
// ============================================================================

/**
 * Extract custom attributes from CoreGraphNode (excluding standard fields).
 * @param node
 */
const extractNodeAttributes = (node: CoreGraphNode): Record<string, unknown> | undefined => {
	const { id: _id, label: _label, type: _type, partition: _partition, ...rest } = node;
	return Object.keys(rest).length > 0 ? rest : undefined;
};

/**
 * Extract custom attributes from CoreGraphEdge (excluding standard fields).
 * @param edge
 */
const extractEdgeAttributes = (edge: CoreGraphEdge): Record<string, unknown> | undefined => {
	const { source: _source, target: _target, weight: _weight, directed: _directed, type: _type, ...rest } = edge;
	return Object.keys(rest).length > 0 ? rest : undefined;
};

/**
 * Extract custom attributes from GmlGraphNode (excluding standard fields).
 * @param node
 */
const extractGmlNodeAttributes = (node: GmlGraphNode): Record<string, unknown> | undefined => {
	const { id: _id, label: _label, ...rest } = node;
	return Object.keys(rest).length > 0 ? rest : undefined;
};

/**
 * Extract custom attributes from GmlGraphEdge (excluding standard fields).
 * @param edge
 */
const extractGmlEdgeAttributes = (edge: GmlGraphEdge): Record<string, unknown> | undefined => {
	const { source: _source, target: _target, weight: _weight, directed: _directed, ...rest } = edge;
	return Object.keys(rest).length > 0 ? rest : undefined;
};
