/**
 * Core graph type definitions for GraphBox
 *
 * This module provides unified graph type definitions used across analyzers,
 * generators, validators, and file I/O. All graph data should use these types
 * as a common foundation, with specialized extensions for specific use cases.
 *
 * @module types/graph-core
 */

import type { GraphSpec } from "../generation/spec.js";

/**
 * Represents a node in a graph with extensible attributes.
 *
 * @property id - Unique identifier for the node
 * @property label - Optional human-readable label
 * @property type - Optional node type for heterogeneous graphs
 * @property partition - Optional partition label for bipartite graphs ("left" or "right")
 *
 * Additional custom attributes can be added via index signature.
 */
export interface GraphNode {
	/** Unique identifier for the node */
	id: string;
	/** Optional human-readable label */
	label?: string;
	/** Optional node type for heterogeneous graphs */
	type?: string;
	/** Optional partition label for bipartite graphs */
	partition?: "left" | "right";
	/** Extensible attributes for custom node properties */
	[key: string]: unknown;
}

/**
 * Represents an edge in a graph with extensible attributes.
 *
 * @property source - ID of the source node
 * @property target - ID of the target node
 * @property directed - Optional per-edge directionality override
 * @property weight - Optional edge weight (numeric)
 * @property type - Optional edge type for heterogeneous graphs
 *
 * Additional custom attributes can be added via index signature.
 */
export interface GraphEdge {
	/** ID of the source node */
	source: string;
	/** ID of the target node */
	target: string;
	/** Optional per-edge directionality override */
	directed?: boolean;
	/** Optional edge weight */
	weight?: number;
	/** Optional edge type for heterogeneous graphs */
	type?: string;
	/** Extensible attributes for custom edge properties */
	[key: string]: unknown;
}

/**
 * Core graph structure representing a collection of nodes and edges.
 *
 * This is the fundamental graph representation used throughout GraphBox.
 * It supports both directed and undirected graphs, with optional per-edge
 * directionality overrides.
 *
 * @property nodes - Array of graph nodes
 * @property edges - Array of graph edges
 * @property directed - Default directionality for edges (true = directed, false = undirected)
 *
 * @example
 * ```typescript
 * const graph: CoreGraph = {
 *   nodes: [
 *     { id: "A", label: "Node A" },
 *     { id: "B", label: "Node B" }
 *   ],
 *   edges: [
 *     { source: "A", target: "B", weight: 1.0 }
 *   ],
 *   directed: false
 * };
 * ```
 */
export interface CoreGraph {
	/** Array of graph nodes */
	nodes: GraphNode[];
	/** Array of graph edges */
	edges: GraphEdge[];
	/** Default directionality (true = directed, false = undirected) */
	directed?: boolean;
}

/**
 * Graph with an associated specification for validation and generation.
 *
 * Used primarily in graph generation and validation workflows where
 * the graph must conform to a specific specification.
 *
 * @augments CoreGraph
 * @property spec - Graph specification defining structural constraints
 *
 * @example
 * ```typescript
 * const specGraph: SpecifiedGraph = {
 *   nodes: [...],
 *   edges: [...],
 *   directed: true,
 *   spec: {
 *     directionality: { kind: "directed" },
 *     connectivity: { kind: "connected" }
 *   }
 * };
 * ```
 */
export interface SpecifiedGraph extends CoreGraph {
	/** Graph specification defining structural constraints */
	spec: GraphSpec;
}

/**
 * Metadata for documented graphs (file I/O).
 *
 * Contains information about the graph source, creation date,
 * and optional descriptive metadata.
 */
export interface GraphMeta {
	/** Graph title or name */
	title?: string;
	/** Graph description */
	description?: string;
	/** Creator or author */
	creator?: string;
	/** Creation or modification date */
	date?: string;
	/** Source URL or reference */
	source?: string;
	/** Additional metadata fields */
	[key: string]: unknown;
}

/**
 * Graph with associated metadata for documentation and file I/O.
 *
 * Used primarily in file format parsers and serializers to preserve
 * metadata when reading/writing graph files.
 *
 * @augments CoreGraph
 * @property meta - Metadata describing the graph
 *
 * @example
 * ```typescript
 * const docGraph: DocumentedGraph = {
 *   nodes: [...],
 *   edges: [...],
 *   directed: false,
 *   meta: {
 *     title: "Zachary's Karate Club",
 *     source: "http://networkrepository.com",
 *     date: "2024-01-01"
 *   }
 * };
 * ```
 */
export interface DocumentedGraph extends CoreGraph {
	/** Metadata describing the graph */
	meta: GraphMeta;
}

/**
 * Type guard to check if a value is a CoreGraph.
 *
 * @param value - Value to check
 * @returns True if value is a CoreGraph
 */
export const isCoreGraph = (value: unknown = undefined): value is CoreGraph => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const object = value as Record<string, unknown>;

	return (
		Array.isArray(object.nodes) &&
    Array.isArray(object.edges) &&
    (object.directed === undefined || typeof object.directed === "boolean")
	);
};

/**
 * Type guard to check if a value is a SpecifiedGraph.
 *
 * @param value - Value to check
 * @returns True if value is a SpecifiedGraph
 */
export const isSpecifiedGraph = (value: unknown): value is SpecifiedGraph => {
	if (!isCoreGraph(value)) {
		return false;
	}

	const object = value as unknown as Record<string, unknown>;
	return typeof object.spec === "object" && object.spec !== null;
};

/**
 * Type guard to check if a value is a DocumentedGraph.
 *
 * @param value - Value to check
 * @returns True if value is a DocumentedGraph
 */
export const isDocumentedGraph = (value: unknown): value is DocumentedGraph => {
	if (!isCoreGraph(value)) {
		return false;
	}

	const object = value as unknown as Record<string, unknown>;
	return typeof object.meta === "object" && object.meta !== null;
};
